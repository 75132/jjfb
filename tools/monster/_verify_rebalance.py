import json, paramiko, os

HERE = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb\tools\monster"
LOCAL = os.path.join(HERE, "monsterbase_export.json")

local = json.load(open(LOCAL, encoding="utf-8"))
local = local["docs"] if isinstance(local, dict) else local
local_map = {d["RobotID"]: d for d in local}

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.140.236.16", port=22, username="root", password="jjfbol13579", timeout=30)

remote = '''
import pymongo, json, re
src = open("/www/wwwroot/default/server/ws_server.py", encoding="utf-8").read()
m = re.search(r"mongo_url\\s*=\\s*[\\'\\"]([^\\'\\"]+)[\\'\\"]", src)
url = m.group(1) if m else "mongodb://127.0.0.1:27017"
cl = pymongo.MongoClient(url, serverSelectionTimeoutMS=8000)
db = cl["jjfb"]
out = []
for d in db["MonsterBase"].find({}):
    d.pop("_id", None)
    out.append(d)
with open("/tmp/mb_dump.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, default=str)
'''
with ssh.open_sftp() as sftp:
    with sftp.open("/tmp/dump_mb.py", "w") as f:
        f.write(remote)
stdin, stdout, stderr = ssh.exec_command("/usr/bin/python3 /tmp/dump_mb.py", timeout=120)
o = stdout.read().decode("utf-8", "replace")
e = stderr.read().decode("utf-8", "replace")
if e.strip():
    print("[dump err]", e[:800])
with ssh.open_sftp() as sftp:
    with sftp.open("/tmp/mb_dump.json") as f:
        raw = f.read().decode("utf-8")
cloud = json.loads(raw)
ssh.close()

cloud_map = {d["RobotID"]: d for d in cloud}

print("本地", len(local_map), "云端", len(cloud_map))
print("RobotID 集合一致:", set(local_map) == set(cloud_map))

ATTRS = ["MaxHP", "MaxMP", "Melee", "Shooting", "Armor", "Evasion", "Accuracy",
         "Lethality", "Corrosion", "Resistance", "Initiative"]
diff = 0
for rid, ld in local_map.items():
    cd = cloud_map.get(rid)
    if not cd:
        print("云端缺失", rid); diff += 1; continue
    for a in ATTRS:
        if ld.get(a) != cd.get(a):
            if diff < 10:
                print(f"DIFF {rid} {ld.get('RobotName')} {a}: local={ld.get(a)} cloud={cd.get(a)}")
            diff += 1
print("属性差异条数:", diff)
print("校验:", "✅ 完全一致" if diff == 0 and set(local_map) == set(cloud_map) else "❌ 有差异")
