# -*- coding: utf-8 -*-
"""上传并执行 RobotPet AttackCount 修复脚本到云端"""
import paramiko, os

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "_fix_pet_attackcount.py")
REMOTE = "/www/wwwroot/default/server"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.140.236.16", 22, "root", "jjfbol13579", timeout=30)

# 先备份 RobotPet
_, so, _ = ssh.exec_command(
    "cd %s && ts=$(date +%%Y%%m%%d_%%H%%M%%S) && /usr/bin/python3 -c \""
    "import sys; sys.path.insert(0,'.'); import ws_server, pymongo, json;"
    "c=pymongo.MongoClient(ws_server.mongo_url); d=list(c['jjfb']['RobotPet'].find({}));"
    "[x.pop('_id',None) for x in d];"
    "open('RobotPet.bak_'+ts+'.json','w').write(json.dumps(d,ensure_ascii=False,default=str));"
    "print('RobotPet.bak_'+ts+'.json',len(d))\" 2>/dev/null | tail -1" % REMOTE, timeout=90)
print("[备份]", so.read().decode("utf-8", "replace").strip())

with ssh.open_sftp() as sftp:
    sftp.put(SCRIPT, REMOTE + "/_fix_pet_attackcount.py")
print("[上传] _fix_pet_attackcount.py")

_, so, se = ssh.exec_command("cd %s && /usr/bin/python3 _fix_pet_attackcount.py" % REMOTE, timeout=120)
print(so.read().decode("utf-8", "replace"))
e = se.read().decode("utf-8", "replace")
if e.strip():
    print("[err]", e[:1200])
ssh.close()
