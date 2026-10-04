# -*- coding: utf-8 -*-
"""创建 RobotPet 备份 + 校验修复结果（幂等脚本，可反复跑）"""
import paramiko

REMOTE_SCRIPT = r'''
import sys; sys.path.insert(0, "/www/wwwroot/default/server")
import ws_server, pymongo, json, datetime
cl = pymongo.MongoClient(ws_server.mongo_url, serverSelectionTimeoutMS=8000)
db = cl["jjfb"]
ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
docs = list(db["RobotPet"].find({}))
for d in docs:
    d.pop("_id", None)
fn = "/www/wwwroot/default/server/RobotPet.bak_%s.json" % ts
open(fn, "w", encoding="utf-8").write(json.dumps(docs, ensure_ascii=False, default=str))
print("BACKUP", fn, len(docs))
for p in db["RobotPet"].find({}, {"RobotName": 1, "AttackCount": 1, "CurrentAttackCount": 1}):
    print("PET", p.get("RobotName"), "AC=", p.get("AttackCount"), "CAC=", p.get("CurrentAttackCount"))
'''

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.140.236.16", 22, "root", "jjfbol13579", timeout=30)
with ssh.open_sftp() as sftp:
    with sftp.open("/www/wwwroot/default/server/_backup_pet.py", "w") as f:
        f.write(REMOTE_SCRIPT)
_, so, se = ssh.exec_command("cd /www/wwwroot/default/server && /usr/bin/python3 _backup_pet.py", timeout=90)
print(so.read().decode("utf-8", "replace"))
e = se.read().decode("utf-8", "replace")
if e.strip():
    print("[err]", e[:600])
ssh.close()
