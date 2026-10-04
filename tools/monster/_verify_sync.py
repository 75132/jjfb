import json, paramiko, sys

HERE = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb\tools\monster"
LOCAL_MB = HERE + r"\monsterbase_export.json"

# ---- 1. 本地导出文件状态 ----
with open(LOCAL_MB, encoding="utf-8") as f:
    raw = json.load(f)
local_mb = raw["docs"] if isinstance(raw, dict) and "docs" in raw else raw
print(f"[本地] monsterbase_export.json 条数 = {len(local_mb)}")
has_kind = sum(1 for d in local_mb if "Kind" in d)
has_cap = sum(1 for d in local_mb if "Capturable" in d)
print(f"  含 Kind 字段条数 = {has_kind} / 含 Capturable 字段条数 = {has_cap}")
kind_local = {}
cap_local = {}
for d in local_mb:
    k = d.get("Kind", "<无>")
    kind_local[k] = kind_local.get(k, 0) + 1
    c = d.get("Capturable", "<无>")
    cap_local[c] = cap_local.get(c, 0) + 1
print("  Kind分布:", kind_local)
print("  Capturable分布:", cap_local)

# ---- 2. 云端 MongoDB 核查 ----
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.140.236.16", port=22, username="root", password="jjfbol13579", timeout=20)

remote = '''
import json
try:
    import pymongo
except Exception as e:
    print("PYMONGO_ERR", e); raise SystemExit(1)
from pymongo import MongoClient
import re
src = open("/www/wwwroot/default/server/ws_server.py", encoding="utf-8").read()
m = re.search(r"mongo_url\\s*=\\s*['\\"]([^'\\"]+)['\\"]", src)
url = m.group(1) if m else "mongodb://127.0.0.1:27017"
cli = MongoClient(url, serverSelectionTimeoutMS=5000)
db = cli["jjfb"]
for col in ["MonsterBase", "RobotBase", "RobotPet"]:
    c = db[col]
    n = c.count_documents({})
    kinds = {}
    caps = {}
    for d in c.find({}, {"Kind":1, "Capturable":1}):
        k = d.get("Kind", "<无>")
        kinds[k] = kinds.get(k,0)+1
        cp = d.get("Capturable", "<无>")
        caps[cp] = caps.get(cp,0)+1
    print(f"[云端] {col} 条数={n}  Kind={kinds}  Capturable={caps}")
rb_fams = set()
for d in db["RobotBase"].find({}, {"Family":1, "RobotName":1}):
    rb_fams.add(d.get("Family"))
dup = 0
for d in db["MonsterBase"].find({"isRobot":1}, {"Family":1}):
    if d.get("Family") in rb_fams:
        dup += 1
print(f"[云端] MonsterBase 中与 RobotBase 家族重复的野生机甲数 = {dup} (应为0)")
'''
with ssh.open_sftp() as sftp:
    with sftp.open("/tmp/verify_mb.py", "w") as rf:
        rf.write(remote)
stdin, stdout, stderr = ssh.exec_command("python3 /tmp/verify_mb.py")
out = stdout.read().decode("utf-8", "replace")
err = stderr.read().decode("utf-8", "replace")
print("---- 云端输出 ----")
print(out)
if err.strip():
    print("---- 云端错误 ----")
    print(err)
ssh.close()
