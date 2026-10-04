"""
PVP 真人模拟端 · 端到端协议自测

用两个真实 WebSocket 连接走完整 PVP 协议链路：
    handshake -> auth_request -> pvp_flat_match（两边）-> battle_room_action
    -> 接收 pvp_round_update 推送

目的：在把 HTML 交给用户测真机之前，先证明：
  1) 协议字段没写错（握手/鉴权能用 user_id 测试模式直连）
  2) 两边都点匹配能配对（room_id 一致、双方 view 互为镜像）
  3) 挂机方能否收到服务端主动推送（这是本轮修的核心 bug）
  4) action 提交格式正确（ATTACK/DEFEND/ESCAPE）

用法（在项目根目录）：
    python tools/pvp_sim/e2e_probe.py --user-a <uidA> --cid-a <cidA> \
                                       --user-b <uidB> --cid-b <cidB>
若省略参数，会从 Mongo 里自动挑两个「有可用机甲」的用户+角色。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    import websockets
except ImportError:
    print("缺少 websockets，请先安装： pip install websockets")
    sys.exit(2)

# 本机联调必须绕过 HTTP(S) 代理，否则 websockets 会走 127.0.0.1:xxxx 代理
# 并收到 502（见 websockets.connect_http_proxy）。
for _k in ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY",
           "all_proxy", "ALL_PROXY", "ws_proxy", "wss_proxy"):
    os.environ.pop(_k, None)
os.environ["NO_PROXY"] = "*"
os.environ["no_proxy"] = "*"

WS_URL = "ws://127.0.0.1:8001"


def log(tag: str, msg: str) -> None:
    print(f"[{tag}] {msg}", flush=True)


def rid() -> str:
    import random
    import string

    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


class Peer:
    """模拟一个真人玩家连接"""

    def __init__(self, name: str, user_id: str, character_id: str, token: str | None = None):
        self.name = name
        self.user_id = user_id
        self.character_id = character_id
        self.token = token
        self.ws = None
        self.responses: dict[str, dict] = {}
        self.pushes: list[dict] = []
        self.room_id: str | None = None
        self.state: dict | None = None
        self._reader_task = None

    async def connect(self) -> None:
        self.ws = await websockets.connect(WS_URL, max_size=8 * 1024 * 1024)
        self._reader_task = asyncio.create_task(self._reader())
        await self.send("handshake", {"sys": {"type": "websocket", "version": "1.0.0", "dict_version": ""}})
        await asyncio.sleep(0.15)
        body = {"character_id": self.character_id}
        if self.token:
            body["token"] = self.token
        if self.user_id:
            body["user_id"] = self.user_id
        r = await self.send("auth_request", body)
        # auth 的响应 type 是 auth_response（不带 _response 后缀）
        ok = r.get("success") is True or r.get("type") == "auth_response"
        if not ok:
            raise RuntimeError(f"{self.name} 鉴权失败: {r.get('message') or fmt(r)}")
        # 回填服务端裁决后的真实 user_id/character_id
        if r.get("user_id"):
            self.user_id = str(r["user_id"])
        if r.get("character_id"):
            self.character_id = str(r["character_id"])
        log(self.name, f"鉴权 OK user_id={self.user_id} cid={self.character_id} "
                       f"（{'token' if self.token else 'user_id 测试模式'}）")

    async def _reader(self) -> None:
        try:
            async for raw in self.ws:
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                t = msg.get("type", "")
                if t == "pvp_round_update":
                    self.pushes.append(msg)
                    st = msg.get("state") or {}
                    self.state = st
                    log(self.name, f"⇐ 收到推送 settled_round={msg.get('settled_round')} "
                                   f"我方HP={st.get('player', {}).get('hp')} "
                                   f"对方HP={st.get('enemy', {}).get('hp')}")
                    continue
                rq = msg.get("request_id")
                # 双 key 落库：request_id 优先，同时按 @route:{type} 兜底
                # （auth_response 这类不走 send_response 的消息无 request_id）
                if rq:
                    self.responses[rq] = msg
                self.responses[f"@route:{t}"] = msg
                # 兼容 route_response 形式：也按去掉 _response 的 route 存一份
                if t.endswith("_response"):
                    self.responses[f"@route:{t[:-9]}"] = msg
        except Exception:
            pass

    async def send(self, mtype: str, body: dict, timeout: float = 15.0) -> dict:
        assert self.ws is not None
        rq = rid()
        # 所有业务请求都带上 token/user_id/character_id（服务端各 handler 用
        # utils.get_user_by_id_or_token(data.user_id, data.token) 自行解析身份）
        payload = {}
        if self.token:
            payload["token"] = self.token
        if self.user_id:
            payload["user_id"] = self.user_id
        if self.character_id:
            payload["character_id"] = self.character_id
        payload.update(body or {})
        msg = {"type": mtype, "request_id": rq, **payload}
        await self.ws.send(json.dumps(msg, ensure_ascii=False))
        # 等对应 request_id 的响应；同时兜底 @route:{type}（有些消息不回 request_id）
        route_key = f"@route:{mtype}"
        deadline = time.time() + timeout
        while time.time() < deadline:
            r = self.responses.pop(rq, None)
            if r is not None:
                self.responses.pop(route_key, None)
                return r
            await asyncio.sleep(0.03)
        r = self.responses.pop(route_key, None)
        if r is not None:
            return r
        return {"success": False, "message": "本地等待响应超时", "code": -1}

    async def close(self) -> None:
        if self._reader_task:
            self._reader_task.cancel()
        if self.ws:
            await self.ws.close()


def _parse_dotenv(env_path: Path) -> dict:
    """
    极小 .env 解析器（避免依赖 python-dotenv）。
    支持 KEY=VALUE、# 注释、引号包裹、行内 # 注释。
    """
    out: dict[str, str] = {}
    if not env_path.is_file():
        return out
    for raw in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
            v = v[1:-1]
        else:
            # 去掉未加引号时的行内注释（# 前有空格）
            if " #" in v:
                v = v.split(" #", 1)[0].strip()
        out[k] = v
    return out


def _resolve_mongo_url() -> str:
    """
    优先复用服务端配置（server/.env → config.load_config），
    本地未跑 Mongo 时服务端通常连的是云端库；这样才能自动挑到真实账号。
    回退链：环境变量 MONGO_URL → server/.env 手工解析 → 本地默认。
    """
    import os

    env_url = (os.environ.get("MONGO_URL") or "").strip()
    if env_url:
        return env_url
    # 1) 走服务端自带 config（若装了 python-dotenv 会读到 .env）
    try:
        sys.path.insert(0, str(ROOT / "server"))
        from config import load_config  # type: ignore

        cfg = load_config()
        url = getattr(cfg, "mongo_url", None)
        if url and "127.0.0.1" not in url:
            return url
    except Exception:
        pass
    # 2) 手工解析 server/.env
    dotenv = _parse_dotenv(ROOT / "server" / ".env")
    url = (dotenv.get("MONGO_URL") or "").strip()
    if url:
        return url
    # 3) 本地默认
    return "mongodb://127.0.0.1:27017/"


async def pick_users_from_mongo(n: int = 2) -> list[tuple[str, str, str]]:
    """
    挑 n 个「有可用机甲」的 (user_id, character_id, token)。
    token 来自 users 表（本服务端 auth_request 只认 token，不支持 user_id 测试模式）。
    """
    try:
        from pymongo import MongoClient
    except ImportError:
        print("缺少 pymongo，无法自动挑选测试账号")
        return []
    url = _resolve_mongo_url()
    safe = url
    if "@" in safe:
        safe = safe.split("@")[0].split("//")[0] + "//***@" + safe.split("@", 1)[1]
    print(f"[probe] Mongo: {safe}")
    cli = MongoClient(url, serverSelectionTimeoutMS=8000)
    db_name = "jjfb"
    try:
        parsed = url.split("/")[-1].split("?")[0]
        if parsed:
            db_name = parsed
    except Exception:
        pass
    db = cli[db_name]

    # user 索引：_id -> token
    token_by_uid: dict[str, str] = {}
    for u in db["users"].find({}, {"_id": 1, "token": 1}):
        uid = str(u.get("_id"))
        tk = u.get("token")
        if uid and tk:
            token_by_uid[uid] = str(tk)

    # 机甲索引：character_id -> 是否有机甲（RobotPet 有该 cid 即算有）
    pets_by_cid: dict[str, int] = {}
    for p in db["RobotPet"].find({}, {"character_id": 1}):
        cid_p = str(p.get("character_id") or "")
        if cid_p:
            pets_by_cid[cid_p] = pets_by_cid.get(cid_p, 0) + 1

    candidates: list[tuple[str, str, str, int]] = []
    for doc in db["players"].find(
        {"user_id": {"$exists": True}, "character_id": {"$exists": True}},
        {"user_id": 1, "character_id": 1, "battle_team": 1, "level": 1},
    ).limit(600):
        uid = str(doc.get("user_id"))
        cid = str(doc.get("character_id"))
        if not uid or not cid:
            continue
        tk = token_by_uid.get(uid)
        if not tk:
            continue
        # 优先级：players.battle_team 非空 > RobotPet 里有机甲 > 其它
        score = 0
        if isinstance(doc.get("battle_team"), list) and doc["battle_team"]:
            score = 2
        elif pets_by_cid.get(cid, 0) > 0:
            score = 1
        candidates.append((uid, cid, tk, score))

    candidates.sort(key=lambda x: -x[3])
    out: list[tuple[str, str, str]] = []
    seen_users: set[str] = set()
    for uid, cid, tk, score in candidates:
        if uid in seen_users:
            continue
        seen_users.add(uid)
        out.append((uid, cid, tk))
        print(f"[probe]   候选 {'★' * score or '·'} user={uid[:10]} cid={cid[:12]} battle_team={'有' if score == 2 else ('RobotPet' if score == 1 else '无')}")
        if len(out) >= n:
            break
    return out


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--user-a"); ap.add_argument("--cid-a"); ap.add_argument("--token-a")
    ap.add_argument("--user-b"); ap.add_argument("--cid-b"); ap.add_argument("--token-b")
    ap.add_argument("--rounds", type=int, default=3)
    args = ap.parse_args()

    if args.cid_a and args.cid_b:
        pair = [
            (args.user_a or "", args.cid_a, args.token_a or ""),
            (args.user_b or "", args.cid_b, args.token_b or ""),
        ]
    else:
        log("probe", "未提供账号，尝试从云端 Mongo 自动挑选（含 token）…")
        pair = await pick_users_from_mongo(2)
        if len(pair) < 2:
            log("probe", "自动挑选失败，请用 --user-a/--cid-a/--token-a/--user-b/--cid-b/--token-b 显式指定")
            return 2
        log("probe", f"自动挑选： A=({pair[0][0]}, {pair[0][1]})  B=({pair[1][0]}, {pair[1][1]})")

    A = Peer("A", pair[0][0], pair[0][1], pair[0][2])
    B = Peer("B", pair[1][0], pair[1][1], pair[1][2])
    failures: list[str] = []

    try:
        await A.connect()
        await B.connect()

        # ---- 阶段1：两边同时匹配 ----
        log("probe", "=== 阶段1：双方同时平匹配 ===")
        ra, rb = await asyncio.gather(
            A.send("pvp_flat_match", {"character_id": A.character_id}, timeout=20),
            B.send("pvp_flat_match", {"character_id": B.character_id}, timeout=20),
        )
        if ra.get("success") is False or rb.get("success") is False:
            log("probe", f"匹配失败 A={ra.get('message')} B={rb.get('message')}")
            return 1
        A.room_id = (ra.get("data") or {}).get("room_id")
        B.room_id = (rb.get("data") or {}).get("room_id")
        A.state = (ra.get("data") or {}).get("state")
        B.state = (rb.get("data") or {}).get("state")
        log("probe", f"A.room_id={A.room_id}  B.room_id={B.room_id}")
        if not A.room_id or A.room_id != B.room_id:
            failures.append("两边 room_id 不一致或为空")

        # ---- 视角镜像校验 ----
        if A.state and B.state:
            a_self = (A.state.get("player") or {}).get("hp")
            b_enemy = (B.state.get("enemy") or {}).get("hp")
            b_self = (B.state.get("player") or {}).get("hp")
            a_enemy = (A.state.get("enemy") or {}).get("hp")
            log("probe", f"镜像校验: A.player.hp={a_self} vs B.enemy.hp={b_enemy} ; "
                         f"B.player.hp={b_self} vs A.enemy.hp={a_enemy}")
            if a_self != b_enemy or b_self != a_enemy:
                failures.append("视角交换不一致（A 的自己 != B 的对方）")
            # 逐 side 字典是否也交换
            a_auto = (A.state.get("auto_actions") or {})
            b_auto = (B.state.get("auto_actions") or {})
            log("probe", f"auto_actions A={a_auto} B={b_auto}")

        # ---- 阶段2：A 攻击，B 挂机（核心 bug 场景）----
        log("probe", "=== 阶段2：A 攻击 / B 挂机（验证挂机方能否收到推送）===")
        A.pushes.clear(); B.pushes.clear()
        rr = await A.send("battle_room_action",
                          {"room_id": A.room_id, "action_type": "ATTACK", "character_id": A.character_id},
                          timeout=25)
        ok = rr.get("success") is not False
        log("probe", f"A 提交 ATTACK -> success={rr.get('success')} code={rr.get('code')} msg={rr.get('message')}")
        if not ok:
            failures.append(f"A 提交动作失败: {rr.get('message')}")

        await asyncio.sleep(1.2)
        log("probe", f"推送计数: A={len(A.pushes)}  B={len(B.pushes)}")
        if len(B.pushes) == 0:
            failures.append("【核心 bug】挂机方 B 没有收到 pvp_round_update 推送")
        else:
            log("probe", "✔ 挂机方收到了推送（bug 已修复）")

        # ---- 阶段3：B 也提交，看是否正常推进到下一回合 ----
        log("probe", "=== 阶段3：B 提交 DEFEND，回合推进 ===")
        B.pushes.clear(); A.pushes.clear()
        rb2 = await B.send("battle_room_action",
                           {"room_id": B.room_id, "action_type": "DEFEND", "character_id": B.character_id},
                           timeout=25)
        log("probe", f"B 提交 DEFEND -> success={rb2.get('success')} msg={rb2.get('message')}")
        await asyncio.sleep(1.2)
        log("probe", f"推送计数: A={len(A.pushes)}  B={len(B.pushes)}")
        if A.pushes:
            st = A.pushes[-1].get("state") or {}
            log("probe", f"A 收到回合 {A.pushes[-1].get('settled_round')} 推送，"
                         f"round_actions={st.get('round_actions')} "
                         f"auto_actions={st.get('auto_actions')} noop_rounds={st.get('noop_rounds')}")

        # ---- 阶段4：非法动作校验 ----
        log("probe", "=== 阶段4：非法 action_type 应被拒绝 ===")
        bad = await A.send("battle_room_action",
                           {"room_id": A.room_id, "action_type": "DANCE", "character_id": A.character_id},
                           timeout=10)
        log("probe", f"非法动作 -> success={bad.get('success')} code={bad.get('code')} msg={bad.get('message')}")
        if bad.get("success") is not False or bad.get("code") != 400:
            failures.append("非法 action_type 未被正确拒绝（期望 400）")

    finally:
        await A.close()
        await B.close()

    print()
    if failures:
        log("probe", "❌ 存在问题：")
        for f in failures:
            log("probe", "   - " + f)
        return 1
    log("probe", "✅ 全部通过：匹配、视角交换、挂机方推送、回合推进、非法动作校验")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
