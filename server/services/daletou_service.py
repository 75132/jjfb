"""
每日大乐透 - 服务端权威逻辑
- 按 Asia/Shanghai 自然日结算
- 当日在线满 3 小时可领取参与资格（每日一次）
- 每日 24:00（即次日 0:00）开奖：从当日已领取资格的角色中随机一名头奖 1000 能量块
"""
from __future__ import annotations

import random
import re
import time
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None  # type: ignore

from datetime import timedelta, timezone

from bson import ObjectId

try:
    from pymongo.errors import DuplicateKeyError
except ImportError:
    DuplicateKeyError = Exception  # type: ignore

TZ_NAME = 'Asia/Shanghai'
REQUIRED_ONLINE_SECONDS = 3 * 60 * 60  # 3 小时
PRIZE_ENERGY = 1000

daletou_draws_col = None


def init_daletou_service(draws_collection):
    global daletou_draws_col
    daletou_draws_col = draws_collection


def _tz():
    if ZoneInfo:
        try:
            return ZoneInfo(TZ_NAME)
        except Exception:
            pass
    return timezone(timedelta(hours=8))


def now_local() -> datetime:
    return datetime.now(_tz())


def today_key() -> str:
    return now_local().strftime('%Y-%m-%d')


def issue_key_from_day(day_str: str) -> str:
    """自然日 YYYY-MM-DD → 期号 YYYYMMDD（与客户端 MiniGame issueNum 一致）。"""
    d = str(day_str).strip()
    if len(d) == 10 and d[4] == '-' and d[7] == '-':
        return d.replace('-', '')
    return ''


def normalize_to_day_key(raw: Optional[str]) -> Optional[str]:
    """
    管理接口：接受 YYYY-MM-DD 或 YYYYMMDD（期数），统一为 YYYY-MM-DD。
    无法解析则返回 None。
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if re.fullmatch(r'\d{8}', s):
        return f'{s[0:4]}-{s[4:6]}-{s[6:8]}'
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', s):
        return s
    return None


def resolve_admin_day_from_request(data: Dict[str, Any], default_day: Optional[str] = None) -> str:
    """
    从管理/HTTP 请求体解析「操作日」（Mongo 中奖池、开奖记录均以该键区分）。
    优先级：day → issue / issue_num / period / issueNum（均可为期数 YYYYMMDD）。
    """
    for key in ('day',):
        nd = normalize_to_day_key(data.get(key))
        if nd:
            return nd
    for key in ('issue', 'issue_num', 'period', 'issueNum'):
        nd = normalize_to_day_key(data.get(key))
        if nd:
            return nd
    return str(default_day or today_key())


def day_start_local(day_str: str) -> datetime:
    """自然日 0:00（本地时区）。"""
    tz = _tz()
    d = datetime.strptime(day_str, '%Y-%m-%d')
    return d.replace(tzinfo=tz)


def draw_deadline_for_day(day_str: str) -> datetime:
    """day D 的奖在 D+1 日 00:00:00（本地）开出，即「每日 24 点」。"""
    return day_start_local(day_str) + timedelta(days=1)


def is_draw_deadline_passed_for_day(day_str: str) -> bool:
    return now_local() >= draw_deadline_for_day(day_str)


def _as_oid(v) -> Optional[ObjectId]:
    if v is None:
        return None
    if isinstance(v, ObjectId):
        return v
    try:
        return ObjectId(str(v))
    except Exception:
        return None


def _display_role_name(doc: Optional[Dict[str, Any]]) -> str:
    """玩家文档里角色展示名：兼容 role_name / name。"""
    if not doc:
        return ''
    return str(doc.get('role_name') or doc.get('name') or '').strip()


def _resolve_winner_display_name(players_col, draw_doc: Optional[Dict[str, Any]]) -> str:
    """开奖记录里的中奖展示名；若历史记录未写入名字，则按 winner_character_id 回查。"""
    if not draw_doc or not draw_doc.get('drawn'):
        return ''
    name = str(draw_doc.get('winner_role_name') or '').strip()
    if name:
        return name
    cid = draw_doc.get('winner_character_id')
    if not cid:
        return ''
    p = players_col.find_one({'character_id': str(cid)}, {'role_name': 1, 'name': 1})
    return _display_role_name(p)


def accumulate_online_seconds(players_col, user_id, character_id) -> Tuple[int, str]:
    """
    根据「上次累计时刻」与本次调用的间隔累加当日在线秒数（上限每跳 45s，防刷）。
    last_acc_at 落库，避免 ws_server 重启/进程丢内存导致首包 delta=0；客户端需定期 daletou_sync 才会累加。
    返回 (online_seconds, day_key)
    """
    uid = _as_oid(user_id)
    cid = character_id
    if uid is None or not cid:
        return 0, today_key()

    day = today_key()
    now = time.time()

    doc = players_col.find_one({'user_id': uid, 'character_id': cid})
    if not doc:
        return 0, day

    daletou = doc.get('daletou') or {}
    if daletou.get('day') != day:
        old_day = daletou.get('day')
        if old_day:
            _maybe_finalize_draw_for_day(players_col, str(old_day))
        players_col.update_one(
            {'_id': doc['_id']},
            {'$set': {
                'daletou.day': day,
                'daletou.online_seconds': 0,
                'daletou.claimed': False,
                'daletou.last_acc_at': now,
            }}
        )
        daletou = {'day': day, 'online_seconds': 0, 'claimed': False, 'last_acc_at': now}

    last_acc_raw = daletou.get('last_acc_at')
    try:
        last_acc = float(last_acc_raw) if last_acc_raw is not None else now
    except Exception:
        last_acc = now
    if last_acc > now:
        last_acc = now
    # 无 last_acc_at 的老数据：不补历史缺口，从本次起算，避免一次性灌入超大秒数
    if last_acc_raw is None:
        last_acc = now

    delta = max(0.0, min(now - last_acc, 45.0))
    if delta < 0.25:
        delta = 0.0

    update_doc: Dict[str, Any] = {'$set': {'daletou.last_acc_at': now}}
    if delta > 0:
        update_doc['$inc'] = {'daletou.online_seconds': int(delta)}
    players_col.update_one({'_id': doc['_id']}, update_doc)

    doc2 = players_col.find_one({'_id': doc['_id']})
    d2 = (doc2 or {}).get('daletou') or {}
    return int(d2.get('online_seconds', 0)), day


def _maybe_finalize_draw_for_day(players_col, day: str) -> None:
    """跨日时先尝试为「上一自然日」开奖（若已过 24 点对应时刻）。"""
    if not day:
        return
    if is_draw_deadline_passed_for_day(day):
        _ensure_draw(players_col, day, force=False)


def _ensure_draw(
    players_col,
    day: str,
    force: bool = False,
    winner_character_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    D+1 日 0:00 后执行开奖；force=True 为测试立即开奖（幂等：按 day 唯一插入）。
    winner_character_id：若提供则按该角色作为中奖者（仅允许其存在于当日已领取奖池中）。
    """
    global daletou_draws_col
    if daletou_draws_col is None:
        return {'drawn': False, 'error': 'no_collection'}

    existing = daletou_draws_col.find_one({'day': day})
    if existing and existing.get('drawn'):
        return existing

    if not force and not is_draw_deadline_passed_for_day(day):
        return {'drawn': False, 'day': day, 'pending': True}

    cur = players_col.find(
        {'daletou.day': day, 'daletou.claimed': True},
        {'character_id': 1, 'role_name': 1, 'name': 1}
    )
    participants = list(cur)
    winner_cid = None
    winner_name = ''

    if participants:
        if winner_character_id:
            target = None
            for p in participants:
                if str(p.get('character_id')) == str(winner_character_id):
                    target = p
                    break
            if not target:
                return {
                    'drawn': False,
                    'day': day,
                    'error': 'winner_not_in_participants',
                    'pending': False,
                }

            winner_cid = target.get('character_id')
            winner_name = _display_role_name(target)
            if not winner_name and winner_cid:
                full = players_col.find_one(
                    {'character_id': winner_cid},
                    {'role_name': 1, 'name': 1},
                )
                winner_name = _display_role_name(full)
        else:
            w = random.choice(participants)
            winner_cid = w.get('character_id')
            winner_name = _display_role_name(w)
            if not winner_name and winner_cid:
                full = players_col.find_one(
                    {'character_id': winner_cid},
                    {'role_name': 1, 'name': 1},
                )
                winner_name = _display_role_name(full)

    try:
        daletou_draws_col.insert_one({
            'day': day,
            'drawn': True,
            'winner_character_id': winner_cid,
            'winner_role_name': winner_name,
            'participant_count': len(participants),
            'prize_energy': PRIZE_ENERGY,
            'drawn_at': time.time(),
        })
    except DuplicateKeyError:
        return daletou_draws_col.find_one({'day': day}) or {}

    if winner_cid:
        players_col.update_one(
            {'character_id': winner_cid},
            {'$inc': {'energy_blocks': PRIZE_ENERGY}}
        )

    return daletou_draws_col.find_one({'day': day}) or {}


def compute_result_tip_code(
    online_seconds: int,
    claimed: bool,
    draw_result_visible: bool,
    draw_doc: Optional[Dict[str, Any]],
    character_id: str,
) -> int:
    """
    1 未获得参与资格 2 已获得资格但未参与 3 未中奖 4 中奖 5 未到开奖时间
    draw_result_visible：已到自然开奖时刻，或管理端已强制写入开奖记录。
    """
    if not draw_result_visible:
        return 5

    if not claimed:
        if online_seconds < REQUIRED_ONLINE_SECONDS:
            return 1
        return 2

    # 已领取 = 已参与奖池
    if not draw_doc or not draw_doc.get('drawn'):
        return 5

    wc = draw_doc.get('winner_character_id')
    if wc and str(wc) == str(character_id):
        return 4
    return 3


def build_sync_payload(
    players_col,
    user_id,
    character_id: str,
) -> Dict[str, Any]:
    uid = _as_oid(user_id)
    if uid is None or not character_id:
        return {'error': 'no_character'}

    online_seconds, day = accumulate_online_seconds(players_col, uid, character_id)

    doc = players_col.find_one({'user_id': uid, 'character_id': character_id})
    if not doc:
        return {'error': 'player_not_found'}

    role_name = _display_role_name(doc)
    raw_e = doc.get('energy_blocks', doc.get('points', 0))
    try:
        energy = int(float(raw_e))
    except Exception:
        energy = 0

    daletou = doc.get('daletou') or {}
    if daletou.get('day') != day:
        daletou = {'day': day, 'online_seconds': online_seconds, 'claimed': False}

    claimed = bool(daletou.get('claimed', False))
    sec_need = max(0, REQUIRED_ONLINE_SECONDS - int(online_seconds))

    local_now = now_local()
    after_draw = is_draw_deadline_passed_for_day(day)

    # 始终走 _ensure_draw：若库中已有「已开奖」记录（含管理端立刻开奖），会直接返回，不受自然日截止限制
    raw_draw = _ensure_draw(players_col, day, force=False)
    draw_doc: Optional[Dict[str, Any]] = None
    if raw_draw and raw_draw.get('drawn'):
        draw_doc = raw_draw

    draw_finished = bool(draw_doc and draw_doc.get('drawn'))
    # 自然时刻已过 24:00，或已有开奖落库，客户端才展示开奖结果/中奖名
    draw_result_visible = bool(after_draw or draw_finished)

    tip_code = compute_result_tip_code(
        int(online_seconds),
        claimed,
        draw_result_visible,
        draw_doc,
        character_id,
    )

    winner_name = _resolve_winner_display_name(players_col, draw_doc)

    return {
        'day': day,
        'issue': issue_key_from_day(day),
        'role_name': role_name,
        'energy_blocks': int(energy or 0),
        'online_seconds': int(online_seconds),
        'seconds_until_eligible': int(sec_need),
        'claimed': claimed,
        'after_draw_time': after_draw,
        'draw_finished': draw_finished,
        'is_winner': bool(
            draw_doc
            and draw_doc.get('winner_character_id')
            and str(draw_doc.get('winner_character_id')) == str(character_id)
        ),
        'winner_display_name': winner_name,
        'result_tip_code': tip_code,
        'server_time': local_now.strftime('%Y-%m-%d %H:%M:%S'),
    }


def claim_participation(players_col, user_id, character_id: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    uid = _as_oid(user_id)
    if uid is None or not character_id:
        return False, 'no_character', None

    day = today_key()
    online_seconds, _ = accumulate_online_seconds(players_col, uid, character_id)

    doc = players_col.find_one({'user_id': uid, 'character_id': character_id})
    if not doc:
        return False, 'player_not_found', None

    daletou = doc.get('daletou') or {}
    if daletou.get('day') != day:
        daletou = {'day': day, 'online_seconds': online_seconds, 'claimed': False}

    if daletou.get('claimed'):
        payload = build_sync_payload(players_col, uid, character_id)
        return True, 'already_claimed', payload

    if int(online_seconds) < REQUIRED_ONLINE_SECONDS:
        return False, 'not_enough_online', None

    players_col.update_one(
        {'_id': doc['_id']},
        {'$set': {
            'daletou.day': day,
            'daletou.claimed': True,
            'daletou.online_seconds': int(online_seconds),
        }}
    )

    payload = build_sync_payload(players_col, uid, character_id)
    return True, 'ok', payload


# ---------- 管理 / HTML 测试页 API ----------


def admin_list_participants(players_col, day: str) -> list:
    """已领取资格（已参与奖池）的玩家列表。"""
    cur = players_col.find(
        {'daletou.day': day, 'daletou.claimed': True},
        {'character_id': 1, 'role_name': 1, 'name': 1, 'daletou': 1, 'user_id': 1}
    )
    out = []
    for p in cur:
        dt = p.get('daletou') or {}
        out.append({
            'character_id': str(p.get('character_id', '')),
            'role_name': _display_role_name(p),
            'user_id': str(p.get('user_id', '')),
            'online_seconds': int(dt.get('online_seconds', 0)),
            'claimed': bool(dt.get('claimed', False)),
        })
    return out


def admin_list_all_players(players_col, limit: int = 500, for_day: Optional[str] = None) -> list:
    """全部角色列表（测试页选中后改在线等）；按角色名排序。
    for_day：若传入 YYYY-MM-DD，仅列出 daletou.day 与该日一致的角色（便于按「本期」筛选）。
    """
    lim = max(1, min(int(limit), 2000))
    q: Dict[str, Any] = {}
    if for_day:
        q['daletou.day'] = str(for_day)
    cur = players_col.find(
        q,
        {'character_id': 1, 'role_name': 1, 'name': 1, 'daletou': 1, 'user_id': 1}
    ).limit(lim)
    out = []
    for p in cur:
        dt = p.get('daletou') or {}
        out.append({
            'character_id': str(p.get('character_id', '')),
            'role_name': _display_role_name(p),
            'user_id': str(p.get('user_id', '')),
            'daletou_day': dt.get('day'),
            'online_seconds': int(dt.get('online_seconds', 0)),
            'claimed': bool(dt.get('claimed', False)),
        })
    out.sort(key=lambda x: (x.get('role_name') or '', x.get('character_id') or ''))
    return out


def admin_set_online_seconds(players_col, character_id: str, day: str, online_seconds: int) -> bool:
    """测试用：直接修改某角色当日累计在线（秒）。"""
    if not character_id:
        return False
    res = players_col.update_one(
        {'character_id': character_id},
        {'$set': {
            'daletou.day': day,
            'daletou.online_seconds': max(0, int(online_seconds)),
            'daletou.last_acc_at': time.time(),
        }}
    )
    return res.matched_count > 0


def admin_run_draw(
    players_col,
    day: str,
    immediate: bool,
    winner_character_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    immediate=True：立刻开奖（测试，无视是否到 24 点）
    immediate=False：仅当已过 D+1 日 0:00 时开奖（与线上一致）
    """
    return _ensure_draw(players_col, day, force=bool(immediate), winner_character_id=winner_character_id)


def admin_draw_status(players_col, day: str) -> Optional[Dict[str, Any]]:
    global daletou_draws_col
    if daletou_draws_col is None:
        return None
    return daletou_draws_col.find_one({'day': day})


def admin_meta(players_col, day: Optional[str] = None) -> Dict[str, Any]:
    """测试页：服务器时间、开奖截止、是否已过截止、当前开奖记录。"""
    day = str(day or today_key())
    dl = draw_deadline_for_day(day)
    now = now_local()
    dr = admin_draw_status(players_col, day)
    return {
        'tz': TZ_NAME,
        'server_now': now.strftime('%Y-%m-%d %H:%M:%S'),
        'today_key': today_key(),
        'query_day': day,
        'issue': issue_key_from_day(day),
        'required_online_seconds': REQUIRED_ONLINE_SECONDS,
        'draw_deadline': dl.strftime('%Y-%m-%d %H:%M:%S'),
        'deadline_passed': is_draw_deadline_passed_for_day(day),
        'natural_draw_ready': is_draw_deadline_passed_for_day(day),
        'draw_record': dr,
        'prize_energy': PRIZE_ENERGY,
    }


def admin_set_claimed(players_col, character_id: str, day: str, claimed: bool) -> bool:
    """测试用：直接标记是否已领取资格（进奖池）。"""
    if not character_id:
        return False
    res = players_col.update_one(
        {'character_id': character_id},
        {'$set': {
            'daletou.day': day,
            'daletou.claimed': bool(claimed),
        }}
    )
    return res.matched_count > 0


def admin_list_recent_draws(limit: int = 14) -> list:
    """最近若干期的开奖摘要（按期数字符串倒序）。"""
    global daletou_draws_col
    if daletou_draws_col is None:
        return []
    lim = max(1, min(int(limit), 90))
    cur = daletou_draws_col.find({}).sort('day', -1).limit(lim)
    out = []
    for doc in cur:
        d = doc.get('day')
        ds = str(d) if d is not None else ''
        out.append({
            'day': ds,
            'issue': issue_key_from_day(ds) if ds else '',
            'drawn': bool(doc.get('drawn')),
            'winner_role_name': doc.get('winner_role_name'),
            'winner_character_id': str(doc.get('winner_character_id') or ''),
            'participant_count': doc.get('participant_count'),
            'prize_energy': doc.get('prize_energy', PRIZE_ENERGY),
        })
    return out


def admin_delete_draw_record(day: str) -> Dict[str, Any]:
    """
    仅测试：删除某日开奖记录，便于重复测「立刻开奖」。
    注意：若已发过奖，能量块不会自动扣回，仅删 Mongo 记录。
    """
    global daletou_draws_col
    if daletou_draws_col is None:
        return {'ok': False, 'error': 'no_collection'}
    r = daletou_draws_col.delete_one({'day': str(day)})
    return {'ok': r.deleted_count > 0, 'deleted_count': r.deleted_count}
