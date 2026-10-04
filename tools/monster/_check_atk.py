import paramiko, os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.140.236.16", port=22, username="root", password="jjfbol13579", timeout=30)

remote = r'''
import pymongo, re, collections
src = open("/www/wwwroot/default/server/ws_server.py", encoding="utf-8").read()
m = re.search(r"mongo_url\s*=\s*['\"]([^'\"]+)['\"]", src)
url = m.group(1) if m else "mongodb://127.0.0.1:27017"
cl = pymongo.MongoClient(url, serverSelectionTimeoutMS=8000)
db = cl["jjfb"]
c = db["MonsterBase"]
n = c.count_documents({})
rebalanced = c.count_documents({"MonsterExtra._rebalanced": 1})
print("MonsterBase 总数", n, " 已重建(_rebalanced=1)", rebalanced)
# 抽样 3万血怪的 atk
for d in c.find({"MaxHP": {"$gte": 26000, "$lte": 34000}}).limit(6):
    me = d.get("MonsterExtra", {})
    atk = (d.get("Melee", 0) or 0) + (d.get("Shooting", 0) or 0)
    print("  %-18s HP=%6d lv=%s T%s atk=%5d armor=%5d" % (
        d.get("RobotName", "")[:18], d.get("MaxHP", 0),
        me.get("_nominalLevel"), me.get("_tier"), atk, d.get("Armor", 0)))
# 统计攻击分布
import statistics
atks = []
for d in c.find({}, {"Melee": 1, "Shooting": 1}):
    atks.append((d.get("Melee", 0) or 0) + (d.get("Shooting", 0) or 0))
atks.sort()
print("攻击分布 min=%d p25=%d med=%d p75=%d max=%d" % (
    atks[0], atks[len(atks)//4], atks[len(atks)//2], atks[len(atks)*3//4], atks[-1]))
# ENEMY_POOL 环境变量/配置
env = re.findall(r"ENEMY_POOL[^\n]*", src)
print("ENEMY_POOL 相关:", env[:3])
'''
with ssh.open_sftp() as sftp:
    with sftp.open("/tmp/chk_atk.py", "w") as f:
        f.write(remote)
stdin, stdout, stderr = ssh.exec_command("cd /www/wwwroot/default/server && /usr/bin/python3 /tmp/chk_atk.py", timeout=120)
print(stdout.read().decode("utf-8", "replace"))
e = stderr.read().decode("utf-8", "replace")
if e.strip():
    print("[err]", e[:500])
ssh.close()
