import paramiko, os, sys

HERE = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb\tools\monster"
LOCAL_JSON = os.path.join(HERE, "monsterbase_export.json")
LOCAL_RUNNER = os.path.join(HERE, "_rebalance_runner.py")
REMOTE_DIR = "/www/wwwroot/default/server"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.140.236.16", port=22, username="root", password="jjfbol13579", timeout=30)

with ssh.open_sftp() as sftp:
    sftp.put(LOCAL_JSON, REMOTE_DIR + "/monsterbase_export.json")
    sftp.put(LOCAL_RUNNER, REMOTE_DIR + "/_rebalance_runner.py")
print("[上传完成]")

cmd = "cd %s && /usr/bin/python3 _rebalance_runner.py" % REMOTE_DIR
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=180)
out = stdout.read().decode("utf-8", "replace")
err = stderr.read().decode("utf-8", "replace")
print("---- 云端输出 ----")
print(out)
if err.strip():
    print("---- 云端错误 ----")
    print(err)
ssh.close()
