# -*- coding: utf-8 -*-
"""只读沙盘：按确认方案重算 MonsterBase 属性，产出 RPG vs Cocos 对照表。
不写库、不生成资源。仅打印统计 + 抽样对照，供用户核对换算比例。
规则：
  1) 写死：Enemies.json note 含 <hp 标记 -> 保留当前 raw 值
  2) 野机甲(isRobot=1) 且家族名命中 Classes.json -> calculate_attributes(level)（同 RobotBase）
  3) 非机甲且命中 Enemies.json params -> 直接用 params（8 项，缺的 7 项默认 50）
  4) 其余 -> 保留当前 raw 值（keep_raw，需关注）
"""
import json, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXPORT = os.path.join(ROOT, "tools/monster/monsterbase_export.json")
ENEMIES = r"D:/机甲风暴开发素材合集/机甲风暴2/data/Enemies.json"
CLASSES = os.path.join(ROOT, "server/data/Classes.json")

ATTRIBUTE_PAIRS = ["Melee","Shooting","Armor","Accuracy","Corrosion","Initiative",
    "Block","ArmorPenetration","Evasion","Lethality","Resistance","Counterattack"]
# Classes.json note 字母 -> cocos 字段（同 robot_upgrade.ATTRIBUTE_MAPPING）
LETTER2FIELD = {'a':'HP','b':'MP','c':'Melee','d':'Shooting','e':'Armor','f':'Evasion',
    'g':'Accuracy','h':'Lethality','i':'Corrosion','j':'Resistance','k':'Initiative',
    'l':'Counterattack','m':'Block','n':'ArmorPenetration'}
# Enemies.params 下标 -> cocos 字段
PARAMS2FIELD = {0:'HP',1:'MP',2:'Melee',3:'Shooting',4:'Armor',5:'Evasion',6:'Accuracy',7:'Lethality'}

def fam(n):
    return re.split(r'[|｜]', n)[0].strip()

def parse_formula(note):
    out = {}
    if not note:
        return out
    for part in note.split(','):
        part = part.strip()
        m = re.match(r'([a-o])\s*=\s*(.+)', part)
        if m:
            out[m.group(1)] = m.group(2).strip()
    return out

def calc_formula(formulas, level):
    res = {}
    for letter, f in formulas.items():
        try:
            f2 = f.replace('level', str(level))
            if not re.match(r'^[0-9+\-*/().\s]+$', f2):
                continue
            res[letter] = int(round(eval(f2)))
        except Exception:
            pass
    return res

def main():
    docs = json.load(open(EXPORT, encoding='utf-8'))['docs']
    enemies = json.load(open(ENEMIES, encoding='utf-8'))
    classes = json.load(open(CLASSES, encoding='utf-8'))

    en_by_name = {}
    en_by_fam = {}
    hp_names = set()
    hp_fams = set()
    for e in enemies:
        if not e or not e.get('name'):
            continue
        en_by_name.setdefault(e['name'], e)
        en_by_fam.setdefault(fam(e['name']), e)
        if re.search(r'<hp\b', e.get('note') or ''):
            hp_names.add(e['name'])
            hp_fams.add(fam(e['name']))
    cls_fam = {}
    for i, e in enumerate(classes):
        if e:
            cls_fam.setdefault(fam(e.get('name','')), i)

    strat = {'keep_hardcoded':0,'formula':0,'enemies_params':0,'keep_raw':0,'baseatt':0}
    hardcoded_names = []
    keep_raw_names = []
    rows = []
    for d in docs:
        nm = d['RobotName']
        me = d['MonsterExtra']
        level = d.get('Level', 1)
        en = en_by_name.get(nm) or en_by_fam.get(fam(nm))
        note = (en.get('note') or '') if en else ''
        # 1) 写死（Enemies 里带 <hp 标记的家族/名字）
        if nm in hp_names or fam(nm) in hp_fams:
            strat['keep_hardcoded'] += 1
            hardcoded_names.append(nm)
            rows.append((nm, 'keep_hardcoded', None, None))
            continue
        # 2) 野机甲 -> 公式
        if me.get('isRobot') == 1 and fam(nm) in cls_fam:
            idx = cls_fam[fam(nm)]
            formulas = parse_formula(classes[idx].get('note','') if classes[idx] else '')
            letter_vals = calc_formula(formulas, level)
            cocos = {}
            for L, v in letter_vals.items():
                fld = LETTER2FIELD.get(L)
                if fld and fld not in ('HP','MP'):
                    cocos[fld] = v
            # HP/MP
            if 'a' in letter_vals: cocos['MaxHP'] = letter_vals['a']
            if 'b' in letter_vals: cocos['MaxMP'] = letter_vals['b']
            # 缺的 7 项默认 50
            for fld in ATTRIBUTE_PAIRS:
                cocos.setdefault(fld, 50)
            strat['formula'] += 1
            rpg = [en['params'][0], en['params'][2]] if en and en.get('params') else [None,None]
            rows.append((nm, 'formula', rpg, [cocos.get('MaxHP'), cocos.get('Melee')]))
            continue
        # 3) 非机甲 -> Enemies params
        if en and en.get('params'):
            params = en['params']
            cocos = {}
            for i, fld in PARAMS2FIELD.items():
                if i < len(params) and fld not in ('HP','MP'):
                    cocos[fld] = params[i]
                elif i < len(params) and fld == 'HP':
                    cocos['MaxHP'] = params[i]
                elif i < len(params) and fld == 'MP':
                    cocos['MaxMP'] = params[i]
            for fld in ATTRIBUTE_PAIRS:
                cocos.setdefault(fld, 50)
            strat['enemies_params'] += 1
            rpg = [params[0], params[2]] if len(params) > 2 else [None,None]
            rows.append((nm, 'enemies_params', rpg, [cocos.get('MaxHP'), cocos.get('Melee')]))
            continue
        # 4) 兜底：用 monster@monster.txt 的 raw baseAtt（非机甲类解包即为成品值）
        rb = me.get('raw_baseAtt','').split(',')
        def _i(x, d=50):
            try: return int(x)
            except: return d
        cocos = {}
        cocos['MaxHP'] = _i(rb[0]) if len(rb) > 0 else 50
        cocos['MaxMP'] = _i(rb[1]) if len(rb) > 1 else 40
        flds = ['Melee','Shooting','Armor','Evasion','Accuracy','Lethality','Corrosion',
                'Resistance','Initiative','Counterattack','Block','ArmorPenetration','AttackCount']
        for k, f in enumerate(flds):
            cocos[f] = _i(rb[k+2]) if len(rb) > k+2 else 50
        strat['baseatt'] += 1
        cur = [d.get('MaxHP'), d.get('Melee')]
        rows.append((nm, 'baseatt', cur, [cocos.get('MaxHP'), cocos.get('Melee')]))

    print("=== 策略分布（共 %d 只）===" % len(docs))
    for k, v in strat.items():
        print("  %-16s %d" % (k, v))
    print("\n=== 写死(保留)怪物 ===")
    print("  ", hardcoded_names)
    print("\n=== keep_raw（无数据兜底，需关注）前20 ===")
    for n in keep_raw_names[:20]:
        print("  ", n)
    print("  共 %d 只" % len(keep_raw_names))

    print("\n=== 抽样对照（RPG值[HP,Melee] -> Cocos值[HP,Melee]）===")
    shown = 0
    for nm, st, rpg, coc in rows:
        if st in ('keep_raw',):
            continue
        if shown >= 30:
            break
        rpg_s = "%s" % (rpg if rpg else [None,None])
        coc_s = "%s" % (coc if coc else [None,None])
        print("  %-22s %-14s RPG=%-18s Cocos=%s" % (nm[:22], st, rpg_s, coc_s))
        shown += 1

    # 输出完整对照表（markdown）
    out = os.path.join(ROOT, "docs/怪物属性换算对照表.md")
    with open(out, "w", encoding="utf-8") as f:
        f.write("# 怪物属性换算对照表（RPG → Cocos）\n\n")
        f.write("> 只读沙盘产出，未写库。规则：写死(<hp>)=保留；野机甲=Classes.json公式；非机甲命中Enemies=params；其余=解包baseAtt。\n\n")
        f.write("| # | 怪物名 | 策略 | RPG[HP,Melee] | Cocos[HP,Melee] |\n")
        f.write("|---|---|---|---|---|\n")
        for i, (nm, st, rpg, coc) in enumerate(rows, 1):
            rpg_s = "%s" % (rpg if rpg else [None,None])
            coc_s = "%s" % (coc if coc else [None,None])
            f.write("| %d | %s | %s | %s | %s |\n" % (i, nm, st, rpg_s, coc_s))
    print("\n完整对照表已写出:", out)

if __name__ == "__main__":
    main()
