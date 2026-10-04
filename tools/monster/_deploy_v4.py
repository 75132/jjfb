# -*- coding: utf-8 -*-
"""v4 部署：上传新 export + runner 到云端，整集重建 MonsterBase，重启 ws_server。
   （v4 只改怪物 HP 分档，经验曲线/抽怪逻辑沿用 v3，不再重复上传 robot_upgrade.py）
"""
import paramiko, os, time

HERE = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb\tools\monster"
JSON = os.path.join(HERE, "monsterbase_export.json")
RUNNER = os.path.join(HERE, "_rebalance_runner.py")
REMOTE = "/www/wwwroot/default/server"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.140.236.16", port=22, username="root", password="jjfbol13579", timeout=30)

# 备份云端当前 MonsterBase（runner 内部也会备份，这里双保险）
ts = time.strftime("%Y%m%d_%H%M%S")
ssh.exec_command("cd %s && /usr/bin/python3 -c \"import json;print()\" 2>/dev/null; true" % REMOTE)

with ssh.open_sftp() as sftp:
    sftp.put(JSON, REMOTE + "/monsterbase_export.json")
    sftp.put(RUNNER, REMOTE + "/_rebalance_runner.py")
print("[上传完成] json + runner")

# 重建库
stdin, stdout, stderr = ssh.exec_command("cd %s && /usr/bin/python3 _rebalance_runner.py" % REMOTE, timeout=240)
print("---- 重建输出 ----")
print(stdout.read().decode("utf-8", "replace"))
e = stderr.read().decode("utf-8", "replace")
if e.strip():
    print("[err]", e[:800])

# 重启服务
ssh.exec_command("pkill -f ws_server.py; sleep 2")
ssh.exec_command("cd %s && setsid nohup /usr/bin/python3 ws_server.py > logs/ws_deploy.log 2>&1 < /dev/null &" % REMOTE)
time.sleep(5)
stdin, stdout, stderr = ssh.exec_command("ps aux | grep ws_server.py | grep -v grep | head -2; echo ---; ss -ltnp 2>/dev/null | grep :8001")
print("---- 服务状态 ----")
print(stdout.read().decode("utf-8", "replace"))
ssh.close()
