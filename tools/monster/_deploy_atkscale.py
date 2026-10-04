import paramiko, os

HERE = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb\tools\monster"
JSON = os.path.join(HERE, "monsterbase_export.json")
RUNNER = os.path.join(HERE, "_rebalance_runner.py")
BATTLE = os.path.join(HERE, "_cloud_battle_room.py")
REMOTE = "/www/wwwroot/default/server"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.140.236.16", port=22, username="root", password="jjfbol13579", timeout=30)

# 1) 备份云端 battle_room_handler
ssh.exec_command("cp %s/handlers/battle_room_handler.py %s/handlers/battle_room_handler.py.bak_atkscale" % (REMOTE, REMOTE))
import time; time.sleep(1)

with ssh.open_sftp() as sftp:
    sftp.put(JSON, REMOTE + "/monsterbase_export.json")
    sftp.put(RUNNER, REMOTE + "/_rebalance_runner.py")
    sftp.put(BATTLE, REMOTE + "/handlers/battle_room_handler.py")
print("[上传完成] json + runner + battle_room_handler")

# 2) 重建库
stdin, stdout, stderr = ssh.exec_command("cd %s && /usr/bin/python3 _rebalance_runner.py" % REMOTE, timeout=180)
print("---- 重建输出 ----")
print(stdout.read().decode("utf-8", "replace"))
e = stderr.read().decode("utf-8", "replace")
if e.strip():
    print("[err]", e[:600])

# 3) 重启服务
ssh.exec_command("pkill -f ws_server.py; sleep 2")
stdin, stdout, stderr = ssh.exec_command(
    "cd %s && setsid nohup /usr/bin/python3 ws_server.py > logs/ws_deploy.log 2>&1 < /dev/null &" % REMOTE)
time.sleep(4)
stdin, stdout, stderr = ssh.exec_command("ps aux | grep ws_server.py | grep -v grep | head -2; ss -ltnp 2>/dev/null | grep :8001")
print("---- 服务状态 ----")
print(stdout.read().decode("utf-8", "replace"))
ssh.close()
