import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.140.236.16", port=22, username="root", password="jjfbol13579", timeout=20)
for cmd in [
    "ps aux | grep ws_server.py | grep -v grep | head -3",
    "ss -ltnp 2>/dev/null | grep -E ':8001|:27017' || netstat -ltnp 2>/dev/null | grep -E ':8001|:27017'",
    "ls -la /www/wwwroot/default/server/logs/ws_deploy.log 2>/dev/null && tail -5 /www/wwwroot/default/server/logs/ws_deploy.log",
]:
    print(f"### $ {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode("utf-8","replace").strip() or "(空)")
    err = stderr.read().decode("utf-8","replace").strip()
    if err:
        print("[err]", err)
ssh.close()
