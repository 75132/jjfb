import paramiko, os, time

HERE = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb\tools\monster"
JSON = os.path.join(HERE, "monsterbase_export.json")
RUNNER = os.path.join(HERE, "_rebalance_runner.py")
LOCAL_UPGRADE = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb\server\handlers\robot_upgrade.py"
REMOTE = "/www/wwwroot/default/server"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.140.236.16", port=22, username="root", password="jjfbol13579", timeout=30)

# 备份云端 robot_upgrade.py
ssh.exec_command("cp %s/handlers/robot_upgrade.py %s/handlers/robot_upgrade.py.bak_expv3 2>/dev/null; true" % (REMOTE, REMOTE))
time.sleep(1)

with ssh.open_sftp() as sftp:
    sftp.put(JSON, REMOTE + "/monsterbase_export.json")
    sftp.put(RUNNER, REMOTE + "/_rebalance_runner.py")
    sftp.put(LOCAL_UPGRADE, REMOTE + "/handlers/robot_upgrade.py")
print("[上传完成] json + runner + robot_upgrade.py")

# 重建库
stdin, stdout, stderr = ssh.exec_command("cd %s && /usr/bin/python3 _rebalance_runner.py" % REMOTE, timeout=180)
print("---- 重建输出 ----")
print(stdout.read().decode("utf-8", "replace"))
e = stderr.read().decode("utf-8", "replace")
if e.strip():
    print("[err]", e[:500])

# 重启服务
ssh.exec_command("pkill -f ws_server.py; sleep 2")
ssh.exec_command("cd %s && setsid nohup /usr/bin/python3 ws_server.py > logs/ws_deploy.log 2>&1 < /dev/null &" % REMOTE)
time.sleep(4)
stdin, stdout, stderr = ssh.exec_command("ps aux | grep ws_server.py | grep -v grep | head -2; echo ---; ss -ltnp 2>/dev/null | grep :8001")
print("---- 服务状态 ----")
print(stdout.read().decode("utf-8", "replace"))
ssh.close()
