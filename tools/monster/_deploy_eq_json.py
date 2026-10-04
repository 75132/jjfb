# -*- coding: utf-8 -*-
"""上传本地已修复的装备 JSON（attackCount）到云端 server/data，并校验。"""
import paramiko, os, json

HERE = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb"
LOCAL_DATA = os.path.join(HERE, "server", "data")
REMOTE = "/www/wwwroot/default/server"
FILES = ["Weapon.json", "Gun.json", "Wing.json", "Dun.json", "Armor.json"]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.140.236.16", 22, "root", "jjfbol13579", timeout=30)

# 1) 备份云端旧 data
ts_cmd = 'cd %s && ts=$(date +%%Y%%m%%d_%%H%%M%%S) && for f in Weapon Gun Wing Dun Armor; do cp data/$f.json data/$f.json.bak_$ts 2>/dev/null; done && echo BACKUP_OK_$ts' % REMOTE
_, so, _ = ssh.exec_command(ts_cmd, timeout=60)
print("[备份]", so.read().decode("utf-8", "replace").strip())

# 2) 上传
with ssh.open_sftp() as sftp:
    for fn in FILES:
        sftp.put(os.path.join(LOCAL_DATA, fn), REMOTE + "/data/" + fn)
print("[上传完成]", FILES)

# 3) 校验
code = r'''
import json
for fn in ["Weapon.json","Gun.json","Wing.json","Dun.json","Armor.json"]:
    d = json.load(open("data/"+fn, encoding="utf-8"))
    d = d if isinstance(d, list) else d.get("items", [])
    n = sum(1 for x in d if (x.get("attackCount") or 0) > 0)
    ps = sum(1 for x in d if "particleShield" in x)
    print("CHECK %-12s total=%d attackCount>0=%d particleShield=%d" % (fn, len(d), n, ps))
w = json.load(open("data/Weapon.json", encoding="utf-8"))
for it in w:
    if "郎基努斯" in str(it.get("name","")):
        print("郎基努斯 attackCount =", it.get("attackCount"))
'''
with ssh.open_sftp() as sftp:
    with sftp.open(REMOTE + "/_verify_eq.py", "w") as f:
        f.write(code)
_, so, se = ssh.exec_command("cd %s && /usr/bin/python3 _verify_eq.py" % REMOTE, timeout=60)
print(so.read().decode("utf-8", "replace"))
e = se.read().decode("utf-8", "replace")
if e.strip():
    print("[err]", e[:600])
ssh.close()
