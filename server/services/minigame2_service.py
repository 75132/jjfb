"""
期货投资系统（MiniGame2）服务端权威逻辑

规则（按需求实现）：
- 使用 Asia/Shanghai（北京时间）作为唯一时间基准
- 3小时一轮开奖：在轮次 close_time 到点后开奖（即使无人也开奖）
- 全服同一套轮次：期号由本地时间向下取整到 3 小时边界得到
- 下注使用能量块（energy_blocks）
- 失败不返还：下注时立刻扣除本金；若未中奖，本金归零
- 中奖发放：只给中奖者 bet_amount * winner_multiplier（扣除本金后直接乘倍率）
- 同一角色同一期可对多个类目分别下注；同一类目多次下注会累加金额（DB 唯一键：issue_key+character_id+selected_key）
- 幂等保护：依赖 server/handlers/minigame2_handler.py 的 request_id 缓存
"""

from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore

from pymongo.errors import DuplicateKeyError
from pymongo import ReturnDocument, UpdateOne

TZ_NAME = "Asia/Shanghai"
ROUND_HOURS = 3

MAX_BET_AMOUNT = 999999999
MIN_BET_AMOUNT = 1


def _tz():
    if ZoneInfo:
        try:
            return ZoneInfo(TZ_NAME)
        except Exception:
            pass
    # 兜底：UTC+8
    return timezone(timedelta(hours=8))


def now_local() -> datetime:
    return datetime.now(_tz())


@dataclass(frozen=True)
class Category:
    key: str
    name: str
    multiplier: int


CATEGORIES = [
    Category(key="bear", name="熊市", multiplier=2),
    Category(key="bull", name="牛市", multiplier=2),
    Category(key="nano", name="纳米科技", multiplier=3),
    Category(key="quantum_mine", name="量子矿脉", multiplier=4),
    Category(key="stellar_route", name="星海航线", multiplier=5),
    Category(key="annihilation", name="湮灭能量", multiplier=7),
]

CAT_BY_KEY: Dict[str, Category] = {c.key: c for c in CATEGORIES}


def _weights_by_multiplier_inverse() -> Dict[str, float]:
    """
    “按倍数分布，总值为 1”：使用 1/miplier 作为权重（倍数越高，概率越低），且 7 倍不会极低离谱。
    """
    raw = {c.key: 1.0 / float(c.multiplier) for c in CATEGORIES}
    total = sum(raw.values()) or 1.0
    return {k: v / total for k, v in raw.items()}


WIN_WEIGHTS = _weights_by_multiplier_inverse()


_rounds_col = None
_bets_col = None
_players_col = None

_bg_task: Optional[asyncio.Task] = None
_initialized = False
_issue_locks: Dict[str, asyncio.Lock] = {}


def issue_key_for_dt(dt: datetime) -> Tuple[str, datetime, datetime]:
    """
    将 dt 向下取整到 3 小时边界，返回 (issue_key, round_start, close_time)

    issue_key 格式：YYYYMMDDHH
    """
    # 确保时区一致（dt 应为 local）
    base_hour = (dt.hour // ROUND_HOURS) * ROUND_HOURS
    start = dt.replace(hour=base_hour, minute=0, second=0, microsecond=0)
    close = start + timedelta(hours=ROUND_HOURS)
    issue_key = start.strftime("%Y%m%d%H")
    return issue_key, start, close


def parse_issue_key(issue_key: str) -> Optional[datetime]:
    """
    issue_key: YYYYMMDDHH
    返回 round_start 的 datetime（带 Asia/Shanghai 时区）
    """
    try:
        start_naive = datetime.strptime(issue_key, "%Y%m%d%H")
        return start_naive.replace(tzinfo=_tz())
    except Exception:
        return None


def get_close_time_for_issue_key(issue_key: str) -> Optional[datetime]:
    st = parse_issue_key(issue_key)
    if st is None:
        return None
    return st + timedelta(hours=ROUND_HOURS)


def categories_payload():
    return [{"key": c.key, "name": c.name, "multiplier": c.multiplier} for c in CATEGORIES]


def winner_pick_key(rnd: Optional[random.Random] = None) -> str:
    rnd = rnd or random
    keys = [c.key for c in CATEGORIES]
    # keys 是字符串列表（cat.key），直接用字符串去索引权重表
    weights = [WIN_WEIGHTS[k] for k in keys]
    # random.choices 返回列表
    return rnd.choices(keys, weights=weights, k=1)[0]


def _get_issue_lock(issue_key: str) -> asyncio.Lock:
    lock = _issue_locks.get(issue_key)
    if lock is None:
        lock = asyncio.Lock()
        _issue_locks[issue_key] = lock
    return lock


def _safe_int(v: Any, default: int = 0) -> int:
    try:
        return int(float(v))
    except Exception:
        return default


def place_holder_payload_error(message: str) -> Dict[str, Any]:
    return {"error": message}


def resolve_now(dt_local: Optional[datetime] = None) -> datetime:
    return dt_local or now_local()


def build_issue_time_payload(now_dt: datetime) -> Dict[str, Any]:
    issue_key, _, close_dt = issue_key_for_dt(now_dt)
    seconds_until_close = max(0, int((close_dt - now_dt).total_seconds()))
    return {
        "issue_key": issue_key,
        "seconds_until_close": seconds_until_close,
        "close_time": close_dt.strftime("%Y-%m-%d %H:%M:%S"),
    }


def _round_doc(issue_key: str) -> Optional[Dict[str, Any]]:
    if _rounds_col is None:
        return None
    return _rounds_col.find_one({"issue_key": issue_key})


async def ensure_round_finalized(issue_key: str, now_dt: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
    """
    确保某期已开奖并结算（包含无人也写入记录）
    返回 round_doc（已包含 winner_* 字段）
    若尚未到点，返回 None 或者一个 pending 状态文档（这里返回 None 表示未 finalize）
    """
    if _rounds_col is None or _bets_col is None or _players_col is None:
        return None

    now_dt = resolve_now(now_dt)
    close_dt = get_close_time_for_issue_key(issue_key)
    if close_dt is None:
        return None
    if now_dt < close_dt:
        return None

    lock = _get_issue_lock(issue_key)
    async with lock:
        doc = _round_doc(issue_key)
        if doc and doc.get("drawn"):
            return doc

        winner_key = winner_pick_key()
        winner_cat = CAT_BY_KEY.get(winner_key)
        winner_multiplier = winner_cat.multiplier if winner_cat else 1

        drawn_at = time.time()
        # upsert：若并发到点只允许最终写入一次（unique index 负责幂等）
        try:
            _rounds_col.update_one(
                {"issue_key": issue_key},
                {
                    "$set": {
                        "issue_key": issue_key,
                        "drawn": True,
                        "winner_key": winner_key,
                        "winner_multiplier": winner_multiplier,
                        "drawn_at": drawn_at,
                        "close_time": close_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    }
                },
                upsert=True,
            )
        except Exception:
            # 如果写入冲突等，直接再取一次
            doc = _round_doc(issue_key)
            if doc and doc.get("drawn"):
                return doc
            raise

        # 结算：遍历 bets_col
        # 失败不返还：bets 已在下注时扣除本金，因此仅给赢家发放
        bets_cursor = _bets_col.find(
            {"issue_key": issue_key, "selected_key": winner_key},
            {"character_id": 1, "bet_amount": 1},
        )
        ops = []
        for b in bets_cursor:
            cid = str(b.get("character_id", "")).strip()
            bet_amount = _safe_int(b.get("bet_amount"), 0)
            if not cid or bet_amount <= 0:
                continue
            prize = bet_amount * int(winner_multiplier)
            ops.append(UpdateOne({"character_id": cid}, {"$inc": {"energy_blocks": prize}}))

        if ops:
            # ordered=False：尽可能提高吞吐
            _players_col.bulk_write(ops, ordered=False)

        return _round_doc(issue_key)


def _get_player_balance(character_id: str) -> int:
    if _players_col is None:
        return 0
    doc = _players_col.find_one({"character_id": str(character_id)}, {"energy_blocks": 1})
    if not doc:
        return 0
    return _safe_int(doc.get("energy_blocks"), 0)


def _get_player_my_bets(issue_key: str, character_id: str) -> list[Dict[str, Any]]:
    if _bets_col is None:
        return []
    cursor = _bets_col.find(
        {"issue_key": issue_key, "character_id": str(character_id)},
        {"selected_key": 1, "bet_amount": 1},
    )
    out: list[Dict[str, Any]] = []
    for doc in cursor:
        sk = str(doc.get("selected_key", "")).strip()
        amt = _safe_int(doc.get("bet_amount"), 0)
        if not sk or amt <= 0:
            continue
        out.append({"selected_key": sk, "bet_amount": amt})
    # 约定：按金额从大到小排一下，客户端展示更直观
    out.sort(key=lambda x: _safe_int(x.get("bet_amount"), 0), reverse=True)
    return out


def _validate_selected_key(selected_key: Any) -> Optional[Category]:
    if not selected_key:
        return None
    sk = str(selected_key).strip()
    return CAT_BY_KEY.get(sk)


def _validate_bet_amount(bet_amount: Any) -> Tuple[bool, int]:
    amt = _safe_int(bet_amount, -1)
    if amt < MIN_BET_AMOUNT:
        return False, amt
    if amt > MAX_BET_AMOUNT:
        return False, amt
    return True, amt


async def place_bet(
    user_id: str,
    character_id: str,
    selected_key: Any,
    bet_amount: Any,
    now_dt: Optional[datetime] = None,
) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    下单并立即扣除本金（能量块）
    返回 (ok, reason, payload)
    """
    if _rounds_col is None or _bets_col is None or _players_col is None:
        return False, "service_not_ready", None

    now_dt = resolve_now(now_dt)
    issue_key, _, close_dt = issue_key_for_dt(now_dt)
    if now_dt >= close_dt:
        return False, "betting_closed", None

    cat = _validate_selected_key(selected_key)
    if not cat:
        return False, "invalid_selected_key", None

    ok_amt, amt = _validate_bet_amount(bet_amount)
    if not ok_amt:
        return False, "invalid_bet_amount", None

    cid = str(character_id).strip()
    uid = str(user_id).strip()
    if not cid or not uid:
        return False, "invalid_character", None

    lock = _get_issue_lock(issue_key)
    async with lock:
        doc = _round_doc(issue_key)
        if doc and doc.get("drawn"):
            return False, "round_drawn", None

        # 原子扣除本金：energy_blocks >= amt
        upd = _players_col.update_one(
            {"character_id": cid, "energy_blocks": {"$gte": amt}},
            {"$inc": {"energy_blocks": -amt}},
        )
        if upd.matched_count != 1:
            return False, "insufficient_energy", None

        # 多类目下注：同一期、同角色、同类目累加（用 upsert + $inc，避免并发下 insert 冲突）
        try:
            _bets_col.update_one(
                {"issue_key": issue_key, "character_id": cid, "selected_key": cat.key},
                {
                    "$inc": {"bet_amount": amt},
                    "$setOnInsert": {
                        "issue_key": issue_key,
                        "user_id": uid,
                        "character_id": cid,
                        "selected_key": cat.key,
                        "created_at": time.time(),
                    },
                },
                upsert=True,
            )
        except DuplicateKeyError:
            # 仍然冲突：通常是数据库里残留旧的唯一索引（issue_key, character_id）
            # 回滚本次扣款并提示重试/清理索引
            _players_col.update_one({"character_id": cid}, {"$inc": {"energy_blocks": amt}})
            return False, "concurrent_bet_conflict", None

        balance = _get_player_balance(cid)
        my_bets = _get_player_my_bets(issue_key, cid)
        payload = {
            "issue_key": issue_key,
            "selected_key": cat.key,  # 本次请求投的类目（方便客户端提示）
            "bet_amount": amt,        # 本次请求投的金额（不是累计）
            "energy_blocks": balance,
            "my_bets": my_bets,       # 本期我投了哪些类目以及各自累计金额
            "my_bet_total": sum(_safe_int(x.get("bet_amount"), 0) for x in my_bets),
        }
        return True, "ok", payload


async def build_sync_payload(user_id: str, character_id: str, now_dt: Optional[datetime] = None) -> Dict[str, Any]:
    if _players_col is None or _bets_col is None:
        return {"error": "service_not_ready"}

    now_dt = resolve_now(now_dt)
    issue_key, _, close_dt = issue_key_for_dt(now_dt)
    seconds_until_close = max(0, int((close_dt - now_dt).total_seconds()))

    # 若已到点且尚未 finalize，则在 sync 时兜底 finalize（加锁保障一致）
    doc = _round_doc(issue_key)
    if doc is None and now_dt >= close_dt:
        doc = await ensure_round_finalized(issue_key, now_dt)
    elif doc and not doc.get("drawn") and now_dt >= close_dt:
        doc = await ensure_round_finalized(issue_key, now_dt)

    round_drawn = bool(doc and doc.get("drawn"))

    # 已开奖后不再展示“距封盘剩余秒数”，避免与「禁止继续下注」冲突（运维立即开奖时常见）
    if round_drawn:
        seconds_until_close = 0

    # 即使已经开奖，也保留玩家本期下注信息，方便客户端展示“我投了什么”（以及后续回报面板复用）
    my_bets = _get_player_my_bets(issue_key, character_id)
    balance = _get_player_balance(character_id)

    payload: Dict[str, Any] = {
        "issue_key": issue_key,
        "seconds_until_close": seconds_until_close,
        "round_drawn": round_drawn,
        "energy_blocks": balance,
        "categories": categories_payload(),
        "my_bets": my_bets,
        "my_bet_total": sum(_safe_int(x.get("bet_amount"), 0) for x in my_bets),
        "server_time": now_dt.strftime("%Y-%m-%d %H:%M:%S"),
    }
    if round_drawn and doc:
        payload["winner_key"] = doc.get("winner_key")
        payload["winner_multiplier"] = doc.get("winner_multiplier")
    return payload


def _hhmm_from_close_time(close_time: Any) -> str:
    """
    close_time: "YYYY-MM-DD HH:mm:ss"
    return: "HH:mm"
    """
    s = str(close_time or '').strip()
    if len(s) >= 16:
        # 12-based: "YYYY-MM-DD " (11) + "HH:mm" (5)
        return s[11:16]
    return ''


async def get_today_return_history(
    character_id: str,
    now_dt: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    获取玩家最近若干期（最多 7 期）的开奖记录与总收益。

    设计目标（参考市面成熟做法）：
    - 面板展示“最近 N 期”的列表，而不是严格按自然日切割，避免 21:00 与 03:00 之间看起来像“隔了 6 小时”的困惑。
    - 始终按“最近已生成的期次”向前回溯补齐，最多 7 条，时间间隔等于 ROUND_HOURS（当前为 3 小时）。
    - 每条记录包含：
        * close_time_hm：开奖时间（HH:mm），玩家一眼能看懂时间节奏
        * winner_category_name：中奖类目（未开奖则为“未开奖”）
        * profit：本期盈亏，未下注/未开奖视为 0

    收益定义（与客户端示例一致）：
    - 未中奖：收益 = -bet_amount（因为已在下注时扣除本金，不返还）
    - 中奖：收益 = bet_amount * winner_multiplier - bet_amount = bet_amount * (winner_multiplier - 1)
    """
    if _players_col is None or _bets_col is None or _rounds_col is None:
        return {"error": "service_not_ready"}

    now_dt = resolve_now(now_dt)

    cid = str(character_id).strip()
    if not cid:
        return {"error": "invalid_character"}

    # day_key 仍返回“今天”的日期，便于客户端显示或后续扩展
    day_key = now_dt.strftime("%Y-%m-%d")

    # 1. 先根据当前时间定位“当前期次”
    #    issue_key_for_dt 会把 now_dt 向下取整到最近的轮次开始时间。
    current_issue_key, current_start, current_close = issue_key_for_dt(now_dt)

    # 2. 从当前期次开始，向前回溯最多 9 期（不跨多天也没关系，客户端只关心时间点节奏）
    max_rounds = 9
    candidate_issue_keys: list[str] = []
    issue_to_close: Dict[str, datetime] = {}
    issue_to_start: Dict[str, datetime] = {}
    for i in range(0, max_rounds):
        # 第 0 次：当前期次；第 1 次：上一期；以此类推
        start_dt = current_start - timedelta(hours=i * ROUND_HOURS)
        close_dt = start_dt + timedelta(hours=ROUND_HOURS)
        issue_key = start_dt.strftime("%Y%m%d%H")
        candidate_issue_keys.append(issue_key)
        issue_to_close[issue_key] = close_dt
        issue_to_start[issue_key] = start_dt

    # 对于“已到开奖时间”的轮次，确保已经 finalize（无人也开奖/写入）
    for ik, close_dt in issue_to_close.items():
        if now_dt >= close_dt:
            doc = _round_doc(ik)
            if doc is None or not doc.get("drawn"):
                await ensure_round_finalized(ik, now_dt)

    # 取出数据库中已有的轮次结果
    rounds_cursor = _rounds_col.find(
        {"issue_key": {"$in": candidate_issue_keys}},
        {"issue_key": 1, "winner_key": 1, "winner_multiplier": 1, "close_time": 1, "drawn": 1},
    )
    round_by_issue: Dict[str, Dict[str, Any]] = {}
    for r in rounds_cursor:
        ik = str(r.get("issue_key", "")).strip()
        if not ik:
            continue
        round_by_issue[ik] = r

    # 候选期次按时间从早到晚排序，便于后面再整体反转为“最近在上”
    issue_keys: list[str] = sorted(candidate_issue_keys)
    if not issue_keys:
        return {"day_key": day_key, "total_profit": 0, "history": []}

    bets_cursor = _bets_col.find(
        {"character_id": cid, "issue_key": {"$in": issue_keys}},
        {"issue_key": 1, "selected_key": 1, "bet_amount": 1},
    )
    # issue_key -> {selected_key -> bet_amount}
    bets_by_issue: Dict[str, Dict[str, int]] = {}
    for b in bets_cursor:
        ik = str(b.get("issue_key", "")).strip()
        if not ik:
            continue
        sk = str(b.get("selected_key", "")).strip()
        if not sk:
            continue
        amt = _safe_int(b.get("bet_amount"), 0)
        if amt <= 0:
            continue
        m = bets_by_issue.get(ik)
        if m is None:
            m = {}
            bets_by_issue[ik] = m
        m[sk] = m.get(sk, 0) + amt

    total_profit = 0
    history: list[Dict[str, Any]] = []

    # 按时间从早到晚遍历 issue_keys
    for ik in issue_keys:
        r = round_by_issue.get(ik) or {}
        close_dt = issue_to_close.get(ik, start_dt)
        round_start_dt = issue_to_start.get(ik)
        drawn = bool(r.get("drawn"))
        winner_key = str(r.get("winner_key", "")).strip() if drawn else ""
        winner_multiplier = _safe_int(r.get("winner_multiplier"), 1) if drawn else 0

        bet_map = bets_by_issue.get(ik)
        if not bet_map or not drawn or not winner_key:
            profit = 0
        else:
            # 多类目下注：赢家类目按倍率盈利，其余类目本金亏损
            p_sum = 0
            for sk, bet_amount in bet_map.items():
                if bet_amount <= 0:
                    continue
                if sk == winner_key:
                    p_sum += bet_amount * max(int(winner_multiplier) - 1, 0)
                else:
                    p_sum -= bet_amount
            profit = p_sum

        total_profit += profit

        if drawn and winner_key:
            winner_cat = CAT_BY_KEY.get(winner_key)
            category_name = winner_cat.name if winner_cat else winner_key
        else:
            category_name = "未开奖"

        # 开奖时间键：直接使用期次编号 issue_key（YYYYMMDDHH = 轮次开始时间）
        # 例如：2026033000 表示当日 00:00-03:00 这一期，2026033021 表示当日 21:00-24:00 这一期。
        # 这样每天最多 8 个“整点”，语义最直观，不会产生“同一天又是 21 又是 00”的混淆。
        close_time_key = ik

        history.append(
            {
                "issue_key": ik,
                # 新字段：客户端用于展示与排序（避免“21 点到 3 点像隔 6 小时”的困惑）
                "close_time_key": close_time_key,
                # 兼容字段：仍保留 HH:mm，便于旧显示或调试
                "close_time_hm": _hhmm_from_close_time(r.get("close_time")) or close_dt.strftime("%H:%M"),
                "winner_category_name": category_name,
                "profit": profit,
            }
        )

    # 前端展示更符合“历史列表”：最新在上
    history.sort(key=lambda x: x.get("close_time_key", "") or x.get("close_time_hm", ""), reverse=True)
    return {"day_key": day_key, "total_profit": total_profit, "history": history}


async def _background_finalize_loop(poll_interval: float = 0.5):
    """
    后台循环：到点就开奖并结算（即便无人触发 sync）
    """
    global _rounds_col
    while True:
        try:
            now_dt = now_local()
            issue_key, _, close_dt = issue_key_for_dt(now_dt)

            # 若当前轮还没到点则睡眠到下个 close
            if now_dt < close_dt:
                sleep_sec = (close_dt - now_dt).total_seconds()
                # 最大不要睡太久（避免时间漂移导致落后）
                await asyncio.sleep(min(max(sleep_sec, 0.1), 30.0))
                continue

            # 到点：finalize 当前轮
            await ensure_round_finalized(issue_key, now_dt)

            # 再快速尝试 finalize 一轮前（防止服务重启/调度漂移导致错过）
            # 注意：这里传入真实 now_dt，避免 ensure_round_finalized 内再次比较 close_time 时误判
            prev_issue_key, _, _ = issue_key_for_dt(now_dt - timedelta(hours=ROUND_HOURS))
            await ensure_round_finalized(prev_issue_key, now_dt)

            await asyncio.sleep(poll_interval)
        except asyncio.CancelledError:
            raise
        except Exception:
            # 不中断后台：记录后继续
            await asyncio.sleep(1.0)


async def _catchup_past_rounds(now_dt: datetime):
    """
    服务启动后：补齐最近几轮可能漏掉的 finalize
    """
    for i in range(0, 6):
        past = now_dt - timedelta(hours=i * ROUND_HOURS)
        issue_key, _, close_dt = issue_key_for_dt(past)
        if now_dt >= close_dt:
            await ensure_round_finalized(issue_key, now_dt)


def admin_meta(now_dt: Optional[datetime] = None) -> Dict[str, Any]:
    """
    HTTP 运维：当前轮次元信息（只读，不改变状态）。
    """
    now_dt = resolve_now(now_dt)
    issue_key, _round_start, close_dt = issue_key_for_dt(now_dt)
    doc = _round_doc(issue_key)
    seconds_until_close = max(0, int((close_dt - now_dt).total_seconds()))
    return {
        "server_now": now_local().strftime("%Y-%m-%d %H:%M:%S"),
        "tz": TZ_NAME,
        "issue_key": issue_key,
        "close_time": close_dt.strftime("%Y-%m-%d %H:%M:%S"),
        "seconds_until_close": seconds_until_close,
        "round_doc": doc or None,
        "categories": categories_payload(),
    }


def admin_list_rounds(limit: int = 20) -> list[Dict[str, Any]]:
    """最近若干期开奖记录（issue_key 降序）。"""
    if _rounds_col is None:
        return []
    lim = max(1, min(int(limit), 200))
    cur = _rounds_col.find({}).sort("issue_key", -1).limit(lim)
    out: list[Dict[str, Any]] = []
    for doc in cur:
        row = dict(doc)
        if row.get("_id") is not None:
            row["_id"] = str(row["_id"])
        out.append(row)
    return out


def admin_list_bets(issue_key: str, limit: int = 500) -> list[Dict[str, Any]]:
    """指定期号下的下注明细（只读）。"""
    if _bets_col is None:
        return []
    ik = str(issue_key or "").strip()
    if not ik:
        return []
    lim = max(1, min(int(limit), 2000))
    cur = _bets_col.find({"issue_key": ik}).sort("bet_amount", -1).limit(lim)
    out: list[Dict[str, Any]] = []
    for doc in cur:
        row = dict(doc)
        if row.get("_id") is not None:
            row["_id"] = str(row["_id"])
        out.append(row)
    return out


def _serialize_round_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    row = dict(doc)
    if row.get("_id") is not None:
        row["_id"] = str(row["_id"])
    return row


def _payout_winners_for_issue(issue_key: str, winner_key: str, winner_multiplier: int) -> int:
    """对已标记开奖的期号，按中奖类目发放能量（与 ensure_round_finalized 逻辑一致）。返回发放笔数。"""
    if _bets_col is None or _players_col is None:
        return 0
    bets_cursor = _bets_col.find(
        {"issue_key": issue_key, "selected_key": winner_key},
        {"character_id": 1, "bet_amount": 1},
    )
    ops: list[UpdateOne] = []
    for b in bets_cursor:
        cid = str(b.get("character_id", "")).strip()
        bet_amount = _safe_int(b.get("bet_amount"), 0)
        if not cid or bet_amount <= 0:
            continue
        prize = bet_amount * int(winner_multiplier)
        ops.append(UpdateOne({"character_id": cid}, {"$inc": {"energy_blocks": prize}}))
    if ops:
        _players_col.bulk_write(ops, ordered=False)
    return len(ops)


def _resolve_admin_winner_key(issue_key: str, winner_key: Optional[str]) -> Tuple[Optional[str], str]:
    """
    决定运维强制开奖的类目：显式 winner_key > 随机有筹码类目 > 全表随机。
    返回 (key 或 None, reason_code)
    """
    if winner_key:
        wk = str(winner_key).strip()
        if wk not in CAT_BY_KEY:
            return None, "invalid_winner_key"
        return wk, "explicit_winner_key"

    sums: Dict[str, int] = {}
    if _bets_col:
        for doc in _bets_col.find({"issue_key": issue_key}, {"selected_key": 1, "bet_amount": 1}):
            sk = str(doc.get("selected_key", "")).strip()
            if not sk:
                continue
            sums[sk] = sums.get(sk, 0) + _safe_int(doc.get("bet_amount"), 0)
    staked = [(k, v) for k, v in sums.items() if v > 0 and k in CAT_BY_KEY]
    if staked:
        staked.sort(key=lambda kv: kv[1], reverse=True)
        top = [kv for kv in staked if kv[1] == staked[0][1]]
        return random.choice(top)[0], "random_among_staked_categories"
    return winner_pick_key(), "random_global"


def admin_force_draw(
    issue_key: str,
    immediate: bool = True,
    winner_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    运维强制开奖（HTTP 测试用）。immediate=False 时须已到本期 close_time。
    与线上下注结算规则一致：仅中奖类目下的注单按倍率发放。
    """
    if _rounds_col is None or _bets_col is None or _players_col is None:
        return {"success": False, "message": "service_not_ready"}

    ik = str(issue_key or "").strip()
    if not ik:
        return {"success": False, "message": "issue_key_required"}

    close_dt = get_close_time_for_issue_key(ik)
    if close_dt is None:
        return {"success": False, "message": "invalid_issue_key"}

    close_time_str = close_dt.strftime("%Y-%m-%d %H:%M:%S")
    now_dt = now_local()
    if not immediate and now_dt < close_dt:
        return {
            "success": False,
            "message": "betting_not_closed",
            "seconds_until_close": max(0, int((close_dt - now_dt).total_seconds())),
        }

    doc = _round_doc(ik)
    if doc and doc.get("drawn"):
        return {
            "success": True,
            "already_drawn": True,
            "draw": _serialize_round_doc(doc),
            "message": "already_drawn",
        }

    wk, reason = _resolve_admin_winner_key(ik, winner_key)
    if not wk:
        return {"success": False, "message": reason}

    cat = CAT_BY_KEY[wk]
    mult = int(cat.multiplier)
    drawn_at = time.time()
    patch: Dict[str, Any] = {
        "issue_key": ik,
        "drawn": True,
        "winner_key": wk,
        "winner_multiplier": mult,
        "drawn_at": drawn_at,
        "close_time": close_time_str,
        "admin_forced": True,
        "admin_force_reason": reason,
    }

    # 原子写入：避免仅依赖 modified_count 在部分驱动/数据形态下误判为 0 导致「开奖无效」
    did_write = False
    after = _rounds_col.find_one_and_update(
        {"issue_key": ik, "drawn": {"$ne": True}},
        {"$set": patch},
        return_document=ReturnDocument.AFTER,
    )
    if after is not None and after.get("drawn"):
        did_write = True
    else:
        d2 = _round_doc(ik)
        if d2 and d2.get("drawn"):
            return {
                "success": True,
                "already_drawn": True,
                "draw": _serialize_round_doc(d2),
                "message": "race_already_drawn",
            }
        try:
            _rounds_col.insert_one(patch)
            did_write = True
        except DuplicateKeyError:
            d3 = _round_doc(ik)
            if d3 and d3.get("drawn"):
                return {
                    "success": True,
                    "already_drawn": True,
                    "draw": _serialize_round_doc(d3),
                    "message": "race_already_drawn",
                }
            after2 = _rounds_col.find_one_and_update(
                {"issue_key": ik, "drawn": {"$ne": True}},
                {"$set": patch},
                return_document=ReturnDocument.AFTER,
            )
            if after2 is not None and after2.get("drawn"):
                did_write = True
            else:
                return {
                    "success": False,
                    "message": "round_write_contended",
                    "draw": _serialize_round_doc(_round_doc(ik)),
                }

    payout_rows = _payout_winners_for_issue(ik, wk, mult) if did_write else 0
    final = _round_doc(ik)
    return {
        "success": True,
        "already_drawn": False,
        "winner_key": wk,
        "winner_multiplier": mult,
        "winner_pick_reason": reason,
        "payout_rows": payout_rows,
        "draw": _serialize_round_doc(final),
    }


def admin_clear_round_draw_record(issue_key: str) -> Dict[str, Any]:
    """
    运维：删除 minigame2_rounds 中该期的开奖记录（视为「未开奖」）。

    不修改 players.energy_blocks、不删 minigame2_bets。
    注意：若之后再次 force_draw，可能对同一笔下注重复派奖，仅用于本机复测。
    """
    if _rounds_col is None:
        return {"success": False, "message": "service_not_ready"}
    ik = str(issue_key or "").strip()
    if not ik:
        return {"success": False, "message": "issue_key_required"}
    r = _rounds_col.delete_one({"issue_key": ik})
    return {"success": True, "deleted_count": int(r.deleted_count)}


def init_minigame2_service(rounds_col, bets_col, players_col):
    """
    初始化服务并启动后台开奖循环
    """
    global _rounds_col, _bets_col, _players_col, _initialized, _bg_task
    _rounds_col = rounds_col
    _bets_col = bets_col
    _players_col = players_col

    if _initialized:
        return
    _initialized = True

    # 在后台循环中兜底“无人也开奖”
    loop = asyncio.get_event_loop()
    _bg_task = loop.create_task(_background_finalize_loop())
    loop.create_task(_catchup_past_rounds(now_local()))


__all__ = [
    "init_minigame2_service",
    "build_sync_payload",
    "place_bet",
    "ensure_round_finalized",
    "categories_payload",
    "get_today_return_history",
    "admin_meta",
    "admin_list_rounds",
    "admin_list_bets",
    "admin_force_draw",
    "admin_clear_round_draw_record",
]

