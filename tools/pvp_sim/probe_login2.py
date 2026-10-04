# -*- coding: utf-8 -*-
"""
实测探针：验证 login → get_all_characters → select_character 的真实返回结构。
目的：确认 autoPickCharacter 应该从哪个层级取角色列表。
"""
import os, sys, json, asyncio, uuid

# 清代理（本机有全局代理会拦 websockets）
for _k in ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "all_proxy", "ALL_PROXY"):
    os.environ.pop(_k, None)
os.environ["NO_PROXY"] = "*"
os.environ["no_proxy"] = "*"

import websockets

WS = "ws://127.0.0.1:8001"


async def main():
    account, password = "2", "2"
    async with websockets.connect(WS, max_size=None) as ws:
        # 握手
        await ws.send(json.dumps({"type": "handshake", "sys": {"type": "websocket", "version": "1.0.0", "dict_version": ""}}))
        # 收 handshake_ack（可能夹带其它消息）
        rid_login = uuid.uuid4().hex
        await ws.send(json.dumps({"type": "login", "account": account, "password": password, "request_id": rid_login}))

        login_resp = None
        for _ in range(30):
            raw = await asyncio.wait_for(ws.recv(), timeout=10)
            msg = json.loads(raw)
            t = msg.get("type", "")
            if t == "login_response":
                login_resp = msg
                break
        if not login_resp:
            print("!! 未收到 login_response")
            return
        print("== login_response 全部键 ==")
        print(sorted(login_resp.keys()))
        print("user_id(根级) =", login_resp.get("user_id"))
        print("data 字段      =", login_resp.get("data"))
        uid = login_resp.get("user_id")
        token = login_resp.get("token")

        # get_all_characters
        rid2 = uuid.uuid4().hex
        req = {"type": "get_all_characters", "user_id": uid, "token": token, "request_id": rid2}
        await ws.send(json.dumps(req))
        all_resp = None
        for _ in range(30):
            raw = await asyncio.wait_for(ws.recv(), timeout=10)
            msg = json.loads(raw)
            if msg.get("type") == "all_characters_response":
                all_resp = msg
                break
        if not all_resp:
            print("!! 未收到 all_characters_response")
            return
        print("\n== all_characters_response 全部键 ==")
        print(sorted(all_resp.keys()))
        print("根级 characters 类型 =", type(all_resp.get("characters")).__name__)
        print("根级 characters 内容 =", json.dumps(all_resp.get("characters"), ensure_ascii=False)[:600])
        print("data 字段            =", json.dumps(all_resp.get("data"), ensure_ascii=False)[:300])

        chars = all_resp.get("characters") or {}
        picked = None
        if isinstance(chars, dict):
            for k in sorted(chars.keys(), key=lambda x: (len(str(x)), str(x))):
                v = chars[k]
                if v and (v.get("character_id") or v.get("characterId")):
                    picked = v
                    break
        print("\n>> 页面 autoPickCharacter 将选中:", json.dumps(picked, ensure_ascii=False)[:300] if picked else "None")

        if picked:
            rid3 = uuid.uuid4().hex
            await ws.send(json.dumps({
                "type": "select_character",
                "user_id": uid, "token": token,
                "character_id": picked.get("character_id"),
                "slot_index": picked.get("slot_index"),
                "request_id": rid3,
            }))
            for _ in range(30):
                raw = await asyncio.wait_for(ws.recv(), timeout=10)
                msg = json.loads(raw)
                if msg.get("type") == "select_character_response":
                    print("\n== select_character_response ==")
                    print(json.dumps({k: v for k, v in msg.items() if k != "request_id"}, ensure_ascii=False)[:400])
                    break


if __name__ == "__main__":
    asyncio.run(main())
