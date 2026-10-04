import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.140.236.16", port=22, username="root", password="jjfbol13579", timeout=30)

remote = r'''
import pymongo, re, random
src = open("/www/wwwroot/default/server/ws_server.py", encoding="utf-8").read()
m = re.search(r"mongo_url\s*=\s*['\"]([^'\"]+)['\"]", src)
url = m.group(1) if m else "mongodb://127.0.0.1:27017"
cl = pymongo.MongoClient(url, serverSelectionTimeoutMS=8000)
db = cl["jjfb"]
mb = db["MonsterBase"]

def draw(player_lv):
    lo = max(1, player_lv - 6); hi = player_lv + 10
    r = list(mb.aggregate([
        {"$match": {"MonsterExtra._nominalLevel": {"$gte": lo, "$lte": hi}}},
        {"$sample": {"size": 1}}]))
    if not r:
        r = list(mb.aggregate([
            {"$match": {"MonsterExtra._nominalLevel": {"$gte": max(1, player_lv-18), "$lte": player_lv+18}}},
            {"$sample": {"size": 1}}]))
    if not r:
        r = list(mb.aggregate([{"$sample": {"size": 1}}]))
    d = r[0]
    atk = (d.get("Melee",0) or 0) + (d.get("Shooting",0) or 0)
    return d.get("MonsterExtra",{}).get("_nominalLevel"), d.get("MaxHP"), atk, d.get("RobotName","")

for lv in [9, 20, 35, 60]:
    print(f"--- 玩家 L{lv} 抽 5 次 ---")
    for _ in range(5):
        nl, hp, atk, nm = draw(lv)
        print(f"  怪 lv={nl:>2} HP={hp:>6} atk={atk:>6}  {nm[:16]}")
'''
with ssh.open_sftp() as sftp:
    with sftp.open("/tmp/test_draw.py", "w") as f:
        f.write(remote)
stdin, stdout, stderr = ssh.exec_command("/usr/bin/python3 /tmp/test_draw.py", timeout=120)
print(stdout.read().decode("utf-8", "replace"))
e = stderr.read().decode("utf-8", "replace")
if e.strip():
    print("[err]", e[:400])
ssh.close()
