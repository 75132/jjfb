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

# 2) 载入清理版并插入（strip _id 防重复）
clean = json.load(open('/www/wwwroot/default/server/monsterbase_export.clean.json', encoding='utf-8'))['docs']
for d in clean:
    d.pop('_id', None)
db['MonsterBase'].drop()
db['MonsterBase'].insert_many(clean)

# 3) RobotBase / RobotPet 加 Kind + Capturable
r = db['RobotBase'].update_many({}, {'$set': {'Kind': 'robot', 'Capturable': 1}})
p = db['RobotPet'].update_many({}, {'$set': {'Kind': 'pet', 'Capturable': 1}})

print('BACKUP MonsterBase.bak_%s.json (%d docs)' % (ts, len(old)))
print('MonsterBase INSERTED', db['MonsterBase'].count_documents({}))
print('RobotBase tagged', r.modified_count, ' RobotPet tagged', p.modified_count)
m_robot = db['MonsterBase'].find_one({'Kind': 'robot'})
print('MonsterBase 特殊野生机甲样本:', (m_robot['RobotName'] if m_robot else None),
      'Capturable', (m_robot.get('Capturable') if m_robot else None))
m_mon = db['MonsterBase'].find_one({'Kind': 'monster'})
print('MonsterBase 怪物样本:', (m_mon['RobotName'] if m_mon else None),
      'Capturable', (m_mon.get('Capturable') if m_mon else None))
rb = db['RobotBase'].find_one({})
print('RobotBase 样本 Kind/Capturable:', rb.get('Kind'), rb.get('Capturable'), 'name', rb.get('RobotName'))
print('MonsterBase 铁臂(应删除):', db['MonsterBase'].find_one({'RobotName': '铁臂'}) is not None)
