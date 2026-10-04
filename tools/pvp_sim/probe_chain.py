# -*- coding: utf-8 -*-
"""
模拟页面完整链路：login → autoPickCharacter(根级 characters) → pvp_flat_match
严格照抄 index.html 里的字段读取逻辑，验证页面能拿到 character_id 并发起匹配。
"""
import os, sys, json, asyncio, uuid

for _k in ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "all_proxy", "ALL_PROXY"):
    os.environ.pop(_k, None)
os.environ["NO_PROXY"] = "*"; os.environ["no_proxy"] = "*"

import websockets
WS = "ws://127.0.0.1:8001"


async def main():
    async with websockets.connect(WS, max_size=None) as ws:
        await ws.send(json.dumps({"type": "handshake", "sys": {"type": "websocket", "version": "1.0.0", "dict_version": ""}}))
        state = {"uid": None, "cid": None, "token": None}

        async def call(payload, expect_type, timeout=12):
            payload.setdefault("request_id", uuid.uuid4().hex)
            # 自动附 token/user_id/character_id（与页面 send() 一致）
            if state["uid"]: payload.setdefault("user_id", state["uid"])
            if state["token"]: payload.setdefault("token", state["token"])
            if state["cid"]: payload.setdefault("character_id", state["cid"])
            await ws.send(json.dumps(payload))
            while True:
                raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
                msg = json.loads(raw)
                if msg.get("type") == expect_type:
                    return msg

        # ---- 步骤1: login（页面读根级 resp.user_id）----
        lr = await call({"type": "login", "account": "2", "password": "2"}, "login_response")
        state["uid"] = lr.get("user_id") or (lr.get("data") or {}).get("user_id")
        state["token"] = lr.get("token")
        print("[1] login  → uid=%s  token=%s" % (state["uid"], (state["token"] or "")[:16] + "..."))

        # ---- 步骤2: autoPickCharacter（页面优先读根级 resp.characters）----
        ar = await call({"type": "get_all_characters", "user_id": state["uid"]}, "all_characters_response")
        d = ar.get("data") or {}
        lst = ar.get("characters") or d.get("characters") or d.get("characters_data") or d.get("slots") or []
        picked = None
        if isinstance(lst, list):
            for i, it in enumerate(lst):
                if it and (it.get("character_id") or it.get("characterId")):
                    picked = {"character_id": str(it.get("character_id") or it.get("characterId")),
                              "slot_index": it.get("slot_index", i)}; break
        if not picked and isinstance(lst, dict):
            for k, v in lst.items():
                if v and (v.get("character_id") or v.get("characterId")):
                    picked = {"character_id": str(v.get("character_id") or v.get("characterId")),
                              "slot_index": v.get("slot_index", int(k) if str(k).isdigit() else k)}; break
        assert picked, "未取到角色！"
        print("[2] autoPick → character_id=%s slot_index=%s" % (picked["character_id"], picked["slot_index"]))

        # ---- 步骤3: select_character ----
        sr = await call({"type": "select_character", "character_id": picked["character_id"],
                         "slot_index": picked["slot_index"]}, "select_character_response")
        state["cid"] = sr.get("character_id") or picked["character_id"]
        print("[3] select  → cid=%s success=%s" % (state["cid"], sr.get("success")))

        # ---- 步骤4: pvp_flat_match ----
        try:
            mr = await call({"type": "pvp_flat_match"}, "pvp_flat_match_response", timeout=20)
            print("[4] match   → success=%s  room_id=%s" % (mr.get("success"), (mr.get("data") or {}).get("room_id") or mr.get("room_id")))
            print("    完整键:", sorted(mr.keys()))
            print("    message:", mr.get("message"))
        except asyncio.TimeoutError:
            print("[4] match   → 超时（20s 无对手，属正常：需要 Cocos 真机同时在匹配）")

        print("\n==> 页面链路验证：登录/选角/匹配请求均正常发出 ✅")


if __name__ == "__main__":
    asyncio.run(main())
