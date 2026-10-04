import ws_server, pymongo, json, datetime

cl = pymongo.MongoClient(ws_server.mongo_url, serverSelectionTimeoutMS=8000)
db = cl['jjfb']
ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')

# 1) 备份旧 MonsterBase
old = list(db['MonsterBase'].find({}))
if old:
    for d in old:
        d.pop('_id', None)
    open('/www/wwwroot/default/server/MonsterBase.bak_%s.json' % ts, 'w', encoding='utf-8').write(
        json.dumps(old, ensure_ascii=False, default=str))

# 2) 载入新 (rebalanced) 并整集重建
docs = json.load(open('/www/wwwroot/default/server/monsterbase_export.json', encoding='utf-8'))
docs = docs['docs'] if isinstance(docs, dict) else docs
for d in docs:
    d.pop('_id', None)
db['MonsterBase'].drop()
db['MonsterBase'].insert_many(docs)

print('BACKUP MonsterBase.bak_%s.json (%d docs)' % (ts, len(old)))
print('MonsterBase INSERTED', db['MonsterBase'].count_documents({}))

# 2.5) 存量字段迁移：ParticleShield -> AttackCount（RobotBase / RobotPet / MonsterBase）
#      AttackCount 默认 1；若旧 ParticleShield 值 > 0 则迁移其值（否则置 1）。
#      使用 raw 文档级 rename，避免 upsert 遗留字段。
mig_total = 0
for colname in ['RobotBase', 'RobotPet', 'MonsterBase']:
    col = db[colname]
    n = 0
    for d in col.find({'$or': [{'ParticleShield': {'$exists': True}},
                               {'CurrentParticleShield': {'$exists': True}}]}):
        ps = d.get('ParticleShield')
        newv = max(1, int(ps)) if isinstance(ps, (int, float)) and ps and ps > 0 else 1
        col.update_one({'_id': d['_id']}, {'$set': {'AttackCount': newv, 'CurrentAttackCount': newv},
                                           '$unset': {'ParticleShield': '', 'CurrentParticleShield': ''}})
        n += 1
    # 补齐完全缺失 AttackCount 的文档（默认 1）
    n2 = col.update_many({'AttackCount': {'$exists': False}},
                         {'$set': {'AttackCount': 1, 'CurrentAttackCount': 1}}).modified_count
    # 清理子文档里可能残留的旧字段
    col.update_many({'MonsterExtra.ParticleShield': {'$exists': True}},
                    {'$unset': {'MonsterExtra.ParticleShield': ''}})
    print('MIGRATE %s: rename=%d default_fill=%d' % (colname, n, n2))
    mig_total += n
print('MIGRATE_TOTAL', mig_total)

# 3) 抽样核对
for name in ['克努', '多基态狼', '饥饿腐蚀者']:
    x = db['MonsterBase'].find_one({'RobotName': name})
    if x:
        me = x.get('MonsterExtra', {})
        print('SAMPLE', name, 'lv', me.get('_nominalLevel'), 'tier', me.get('_tier'),
              'HP', x.get('MaxHP'), 'Melee', x.get('Melee'), 'Shooting', x.get('Shooting'),
              'Armor', x.get('Armor'), 'Accuracy', x.get('Accuracy'),
              'Corrosion', x.get('Corrosion'), 'Resistance', x.get('Resistance'))
# 4) 统计
import collections
lv = collections.Counter()
zero = 0
for x in db['MonsterBase'].find({}, {'MonsterExtra._nominalLevel': 1, 'Melee': 1, 'Corrosion': 1}):
    lv[x.get('MonsterExtra', {}).get('_nominalLevel')] += 1
    if (x.get('Melee') or 0) <= 0 or (x.get('Corrosion') or 0) <= 0:
        zero += 1
print('LEVEL_DIST', dict(sorted(lv.items(), key=lambda kv: (kv[0] is None, kv[0]))))
print('ZERO_ATTR_DOCS', zero)
