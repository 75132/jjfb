# -*- coding: utf-8 -*-
"""云内执行：整集重建 jjfb.MonsterBase（凭证取自 ws_server.mongo_url，不落地明文）。
用法: python3 _cloud_import_runner.py
- 先备份现有 MonsterBase 到 MonsterBase.bak_<ts>.json
- 再 col.drop() + insert_many(export docs)
"""
import sys, json, datetime
sys.path.insert(0, '/www/wwwroot/default/server')
import ws_server
import pymongo

uri = ws_server.mongo_url
cl = pymongo.MongoClient(uri, serverSelectionTimeoutMS=8000)
db = cl['jjfb']
col = db['MonsterBase']

exp = json.load(open('/www/wwwroot/default/server/monsterbase_export.json', encoding='utf-8'))
docs = exp['docs']
print('EXPORT_DOCS', len(docs))

# 备份现有
ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
bak = list(col.find())
if bak:
    json.dump(bak, open('/www/wwwroot/default/server/MonsterBase.bak_%s.json' % ts, 'w'), default=str)
print('BACKUP_DOCS', len(bak), '-> MonsterBase.bak_%s.json' % ts)

col.drop()
col.insert_many(docs)
print('IMPORTED', col.count_documents({}))

# 抽样校验
for nm in ['铁臂', '枯骨魔龙', '多基态狼', '暗夜潜伏蝎', '山猫-RT·土著死士', '水银怪']:
    d = col.find_one({'RobotName': nm})
    if d:
        print('CHECK', nm, 'MaxHP=', d.get('MaxHP'), 'Melee=', d.get('Melee'), 'Shooting=', d.get('Shooting'))
    else:
        print('CHECK_MISSING', nm)
