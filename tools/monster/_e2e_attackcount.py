# -*- coding: utf-8 -*-
"""端到端校验：模拟 GET_ROBOT_PET_INFO 的 AttackCount 计算路径"""
import paramiko

REMOTE = r'''
import sys, json
sys.path.insert(0, "/www/wwwroot/default/server")
import os
os.chdir("/www/wwwroot/default/server")

# 1) 装备配置里的 attackCount
cfg = {}
for fn in ["Weapon.json", "Gun.json", "Wing.json", "Dun.json", "Armor.json"]:
    d = json.load(open("data/" + fn, encoding="utf-8"))
    d = d if isinstance(d, list) else d.get("items", [])
    for it in d:
        if it.get("id") is not None:
            cfg[it["id"]] = int(it.get("attackCount") or 0)

import ws_server, pymongo
cl = pymongo.MongoClient(ws_server.mongo_url, serverSelectionTimeoutMS=8000)
db = cl["jjfb"]

print("=== 各机甲 AttackCount 与服务端返回一致性 ===")
for p in db["RobotPet"].find({}):
    eq = p.get("equipment") or {}
    eq_sum = sum(cfg.get((it or {}).get("item_id"), 0) for it in eq.values() if isinstance(it, dict))
    expect = 1 + eq_sum
    actual = p.get("AttackCount")
    cac = p.get("CurrentAttackCount")
    flag = "OK" if (actual == expect and cac == expect) else "MISMATCH"
    if eq:
        print("  %-20s equip_sum=%d expect=%d AC=%s CAC=%s  [%s]" % (p.get("RobotName"), eq_sum, expect, actual, cac, flag))

# 2) 验证响应构造里含 CurrentAttackCount
import inspect
src = open("handlers/robot_handler.py", encoding="utf-8").read()
print("robot_handler 含 'CurrentAttackCount':", "CurrentAttackCount" in src)
print("robot_handler 含 'AttackCount':", "'AttackCount'" in src)
'''

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.140.236.16", 22, "root", "jjfbol13579", timeout=30)
with ssh.open_sftp() as sftp:
    with sftp.open("/www/wwwroot/default/server/_e2e_ac.py", "w") as f:
        f.write(REMOTE)
_, so, se = ssh.exec_command("cd /www/wwwroot/default/server && /usr/bin/python3 _e2e_ac.py", timeout=90)
print(so.read().decode("utf-8", "replace"))
e = se.read().decode("utf-8", "replace")
if e.strip():
    print("[err]", e[:800])
ssh.close()
