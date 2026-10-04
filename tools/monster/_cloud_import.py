# -*- coding: utf-8 -*-
"""本地编排：paramiko 上传修正后的导出 JSON 与导入脚本到云端，并在云内执行整集重建。
凭证不离开云端（runner 读取 ws_server.mongo_url）。"""
import paramiko, os, io, sys

HOST, PORT, USER, PW = "8.140.236.16", 22, "root", "jjfbol13579"
LOCAL_EXPORT = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb\tools\monster\monsterbase_export.json"
LOCAL_RUNNER = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb\tools\monster\_cloud_import_runner.py"
REMOTE_EXPORT = "/www/wwwroot/default/server/monsterbase_export.json"
REMOTE_RUNNER = "/www/wwwroot/default/server/_cloud_import_runner.py"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, port=PORT, username=USER, password=PW, timeout=25)
sftp = c.open_sftp()

print("[1] 上传导出 JSON ->", REMOTE_EXPORT)
sftp.put(LOCAL_EXPORT, REMOTE_EXPORT)
print("    大小", os.path.getsize(LOCAL_EXPORT), "bytes")

print("[2] 上传导入脚本 ->", REMOTE_RUNNER)
sftp.put(LOCAL_RUNNER, REMOTE_RUNNER)

sftp.close()
print("[3] 云内执行导入（整集重建 + 备份 + 抽样校验）...")
stdin, stdout, stderr = c.exec_command(
    "cd /www/wwwroot/default/server && python3 _cloud_import_runner.py 2>&1", timeout=120)
out = stdout.read().decode(errors="replace")
err = stderr.read().decode(errors="replace")
print(out)
if err.strip():
    print("STDERR:", err[:1000])
c.close()
print("[done]")
