# -*- coding: utf-8 -*-
"""
云端 handlers 字段补丁：ParticleShield → AttackCount（最小改动，保留云端旧骨架）
==================================================================================
仅做字段名替换 + 默认值调整，不改动任何其它逻辑。
幂等：若该文件已无 ParticleShield 且含 AttackCount 则跳过。
自动备份为 .bak_attackcount。
"""
import paramiko

REMOTE = "/www/wwwroot/default/server"

FILES = [
    "handlers/robot_handler.py",
    "handlers/equipment_handler.py",
    "handlers/item_effect.py",
    "handlers/character_handler.py",
    "handlers/battle_handler.py",
    "handlers/admin_handler.py",
    "handlers/robot_upgrade.py",
    "handlers/utils.py",
    "ws_server.py",
]

# 顺序很重要：先长后短，避免 CurrentParticleShield 被 ParticleShield 先命中
REPLACEMENTS = [
    ("CurrentParticleShield", "CurrentAttackCount"),
    ("ParticleShield", "AttackCount"),
    ("particleShield", "attackCount"),
    ("粒子护盾", "攻击次数"),
    ("get('AttackCount', 35)", "get('AttackCount', 1)"),
    ('get("AttackCount", 35)', 'get("AttackCount", 1)'),
    ("pet.get('AttackCount', 0) or 0", "pet.get('AttackCount', 1) or 1"),
    ("get('AttackCount', 0)", "get('AttackCount', 1)"),
]

REMOTE_TEMPLATE = '''# -*- coding: utf-8 -*-
import io, os, shutil
files = __FILES__
reps = __REPS__
changed_any = False
for rel in files:
    p = os.path.join("/www/wwwroot/default/server", rel)
    if not os.path.exists(p):
        print("SKIP(not exist)", rel); continue
    s = io.open(p, encoding="utf-8").read()
    if "AttackCount" in s and "ParticleShield" not in s and "particleShield" not in s:
        print("ALREADY", rel); continue
    orig = s
    for a, b in reps:
        s = s.replace(a, b)
    if s == orig:
        print("NOCHANGE", rel); continue
    shutil.copy2(p, p + ".bak_attackcount")
    io.open(p, "w", encoding="utf-8").write(s)
    print("PATCHED", rel, "ps_hits=", orig.count("ParticleShield") + orig.count("particleShield"))
    changed_any = True
print("DONE", changed_any)
'''

script = REMOTE_TEMPLATE.replace("__FILES__", repr(FILES)).replace("__REPS__", repr(REPLACEMENTS))

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.140.236.16", 22, "root", "jjfbol13579", timeout=30)
with ssh.open_sftp() as sftp:
    with sftp.open(REMOTE + "/_patch_handlers.py", "w") as f:
        f.write(script)
_, so, se = ssh.exec_command("cd %s && /usr/bin/python3 _patch_handlers.py" % REMOTE, timeout=120)
print(so.read().decode("utf-8", "replace"))
e = se.read().decode("utf-8", "replace")
if e.strip():
    print("[err]", e[:1200])

print("\n--- py_compile 校验 ---")
_, so, se = ssh.exec_command(
    "cd %s && /usr/bin/python3 -m py_compile %s && echo COMPILE_OK" % (REMOTE, " ".join(FILES)), timeout=120)
print(so.read().decode("utf-8", "replace"))
e = se.read().decode("utf-8", "replace")
if e.strip():
    print("[compile err]", e[:1500])
ssh.close()
