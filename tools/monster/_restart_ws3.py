# -*- coding: utf-8 -*-
import paramiko, time
HOST='8.140.236.16'; USER='root'; PWD='jjfbol13579'
cli=paramiko.SSHClient(); cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
cli.connect(HOST,22,USER,PWD,timeout=20)
def run(cmd, t=30, read=True):
    si,so,se=cli.exec_command(cmd,timeout=t)
    if not read:
        return '', ''
    return so.read().decode('utf-8','replace'), se.read().decode('utf-8','replace')
# 1) 先杀掉
run("pkill -f ws_server.py", read=False)
time.sleep(2)
# 2) 启动：用 sh -c 包裹，彻底断开 stdio
start = "cd /www/wwwroot/default/server && setsid /usr/bin/python3 ws_server.py > logs/ws_deploy.log 2>&1 < /dev/null & disown; exit 0"
si,so,se=cli.exec_command(start)
so.channel.settimeout(3)
try:
    so.read()
except Exception:
    pass
time.sleep(6)
o,e=run("ps -ef | grep ws_server.py | grep -v grep")
print('--- AFTER ---'); print(o.strip() or '(no process)')
o,e=run("tail -30 /www/wwwroot/default/server/logs/ws_deploy.log")
print('--- LOG ---'); print(o.strip())
o,e=run("ss -lntp 2>/dev/null | grep 8001")
print('--- PORT ---'); print(o.strip() or '(no listener)')
cli.close()
