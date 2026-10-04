#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成统一属性对比 HTML：
- 机甲(RobotBase)：实际游戏值 + 满级L60设计值(Classes公式×系数) 可切换，Kind=robot/Capturable=1
- 怪物/虫族(MonsterBase)：实际游戏值，Kind 来自 doc，Capturable 来自 doc，⚠估算标记
数据来源 = 云端真实落库（本地 clean = 云端已校验一致）。"""
import json, re, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RB_FULL = os.path.join(HERE, "_robotbase_full.json")
MB_CLEAN = os.path.join(HERE, "monsterbase_export.json")
CLASSES = os.path.join(ROOT, "server", "data", "Classes.json")
COEFF = os.path.join(ROOT, "server", "data", "ClassCoefficient.json")
OUT = os.path.join(ROOT, "docs", "全量生物机甲属性对比_L60.html")

FIELDS = [("HP", "MaxHP"), ("MP", "MaxMP"), ("近战", "Melee"), ("射击", "Shooting"),
          ("装甲", "Armor"), ("闪避", "Evasion"), ("命中", "Accuracy"), ("致命", "Lethality"),
          ("侵蚀", "Corrosion"), ("抗性", "Resistance"), ("先制", "Initiative")]
LETTER = {"HP": "a", "MP": "b", "近战": "c", "射击": "d", "装甲": "e",
          "闪避": "f", "命中": "g", "致命": "h", "侵蚀": "i", "抗性": "j",
          "先制": "k", "反击": "l", "格挡": "m", "破甲": "n", "粒子盾": "o"}


def fam(n):
    return re.split(r"[|｜]", n)[0].strip() if n else ""


def _safe_eval(s):
    if not re.fullmatch(r"[0-9./\s()+\-]+", s):
        return None
    try:
        return eval(s, {"__builtins__": {}}, {})
    except Exception:
        return None


def parse_formula(note):
    out = {}
    if not note:
        return out
    for part in note.split(","):
        part = part.strip()
        # 支持 level * (506/2) + 300 这类带括号/除法的乘数表达式
        m = re.match(r"([a-o])\s*=\s*level\s*\*\s*(\(?[0-9./\s]+\)?)\s*\+\s*([\-0-9.]+)", part)
        if m:
            coef = _safe_eval(m.group(2))
            if coef is not None:
                out[m.group(1)] = (float(coef), float(m.group(3)))
    return out


def l60_value(coef, const, level=60):
    return int(round(coef * level + const))


# ---- 加载 ----
rb_full = json.load(open(RB_FULL, encoding="utf-8"))
mb_clean = json.load(open(MB_CLEAN, encoding="utf-8"))["docs"]
classes = json.load(open(CLASSES, encoding="utf-8"))
coeff = json.load(open(COEFF, encoding="utf-8"))

cls_fam = {}
for i, e in enumerate(classes):
    if e and e.get("name"):
        cls_fam.setdefault(fam(e["name"]), i)

# ---- 机甲数据（实际 + L60）----
mechs = []
for d in rb_full:
    name = d.get("RobotName", "")
    actual = {}
    for label, key in FIELDS:
        actual[label] = d.get(key, 0)
    # L60 设计值
    idx = cls_fam.get(fam(name))
    l60 = {}
    if idx is not None:
        cf = parse_formula(classes[idx].get("note", "")) if classes[idx] else {}
        cobj = coeff[idx] if idx < len(coeff) else {}
        for label, key in FIELDS:
            L = LETTER[label]
            if L in cf:
                base = l60_value(*cf[L])
                mult = cobj.get(L, 1) if isinstance(cobj, dict) else 1
                l60[label] = int(round(base * mult))
            else:
                l60[label] = actual[label]
    else:
        l60 = dict(actual)
    mechs.append({"name": name, "level": d.get("Level", 1), "actual": actual, "l60": l60,
                  "kind": d.get("Kind", "robot"), "capturable": d.get("Capturable", 1)})

# ---- 怪物/虫族数据 ----
monsters = []
for d in mb_clean:
    name = d.get("RobotName", "")
    actual = {}
    for label, key in FIELDS:
        actual[label] = d.get(key, 0)
    me = d.get("MonsterExtra") or {}
    est = int(me.get("estimated", 0) or 0)
    monsters.append({"name": name, "level": me.get("_nominalLevel", d.get("Level", 1)),
                     "actual": actual, "rawLevel": d.get("Level", 1),
                     "tier": me.get("_tier", 0), "rebalanced": int(me.get("_rebalanced", 0) or 0),
                     "kind": d.get("Kind", "monster"), "capturable": d.get("Capturable", 0),
                     "eliteClass": me.get("_eliteClass", "normal"),
                     "est": est})

# ---- HTML ----
def row_html(item, mode, maxmap, kind_label):
    est = item.get("est", 0)
    warn = ' <span class="est" title="游戏原无此怪数据，按通用公式估算">⚠估算</span>' if est else ""
    cap = item.get("capturable", 0)
    cap_tag = '<span class="cap1">可捕捉</span>' if cap == 1 else '<span class="cap0">不可捕捉</span>'
    cells = ""
    for label, _ in FIELDS:
        v = item[mode][label]
        mx = maxmap[label] or 1
        pct = min(100, int(v / mx * 100))
        cells += f'<td><div class="bar"><div class="fill" style="width:{pct}%"></div></div>{v}</td>'
    kind = item.get("kind", "monster")
    ktag = '<span class="k-robot">机甲</span>' if kind == "robot" else '<span class="k-mon">怪物</span>'
    ecls = item.get("eliteClass", "normal")
    etag = {"normal": "", "elite": '<span class="ec-elite">精英</span>',
            "boss": '<span class="ec-boss">BOSS</span>'}.get(ecls, "")
    return (f'<tr><td class="nm">{item["name"]}{warn}</td><td>{ktag}</td>'
            f'<td>{etag}{cap_tag}</td><td>{item.get("level",1)}</td>{cells}</tr>')


def maxmap_of(items, mode):
    mm = {}
    for label, _ in FIELDS:
        mm[label] = max((it[mode][label] for it in items), default=1)
    return mm


mm_mech = maxmap_of(mechs, "actual")
mm_mon = maxmap_of(monsters, "actual")

mech_rows = "\n".join(row_html(m, "actual", mm_mech, "robot") for m in mechs)
mon_rows = "\n".join(row_html(m, "actual", mm_mon, "mon") for m in monsters)

heads = "".join(f"<th data-f='{l}'>{l}</th>" for l, _ in FIELDS)

# ---- 量级对比（怪物分档中位数 vs 满配玩家参考线）----
def _med(vals):
    v = sorted(vals)
    return v[len(v) // 2] if v else 0

# 满配玩家参考线（用户口径，2026-09-28）
TOP_ATK = 17272        # 顶配普攻（弗雷萨双修 + 昆古尼尔 + 月光微波炮 + 霸者之翼）
TOP_SKILL_SINGLE = 32000   # 顶配单体技能最强
TOP_SKILL_AOE = 23000      # 顶配群攻满伤
NORMAL_HP_CAP = 17500      # 普通怪 HP 上限（满配 1 刀秒）
ELITE_HP_CAP = 26000       # 精英 HP 上限（技能可秒）

# 分档统计（普通/精英/BOSS）
grp = {"normal": [], "elite": [], "boss": []}
for x in monsters:
    grp.setdefault(x.get("eliteClass", "normal"), []).append(x)

cls_rows = ""
for key, label in (("normal", "普通怪"), ("elite", "精英"), ("boss", "BOSS")):
    rs = grp.get(key, [])
    if not rs:
        continue
    hp = [x["actual"]["HP"] for x in rs]
    atk = [x["actual"]["近战"] + x["actual"]["射击"] for x in rs]
    hp_med = _med(hp)
    cls_rows += (f"<tr><td class='nm'>{label}</td><td>{len(rs)}</td>"
                 f"<td>{min(hp)} ~ {max(hp)}</td><td>{hp_med}</td>"
                 f"<td>{hp_med/TOP_ATK:.2f} 刀</td><td>{hp_med/TOP_SKILL_SINGLE:.2f} 刀</td>"
                 f"<td>{_med(atk)}</td></tr>")

cmp_rows = ""
for label, _ in FIELDS:
    mmon = _med([x["actual"][label] for x in monsters])
    mmech60 = _med([x["l60"][label] for x in mechs])
    ratio = (mmon / mmech60) if mmech60 else 0
    ratio_s = "—" if not mmech60 else f"{ratio*100:.0f}%"
    cls = "ok" if (not mmech60) or (0.3 <= ratio <= 1.2) else "warn"
    cmp_rows += (f"<tr><td class='nm'>{label}</td><td>{mmon}</td><td>{mmech60}</td>"
                 f"<td class='{cls}'>{ratio_s}</td></tr>")

HTML = f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>全量生物/机甲属性对比</title>
<style>
*{{box-sizing:border-box}}
body{{font-family:-apple-system,"Microsoft YaHei",sans-serif;margin:0;background:#0f1320;color:#e6e9f0}}
header{{padding:18px 22px;background:#171c2e;border-bottom:1px solid #2a3350}}
h1{{margin:0 0 6px;font-size:20px}}
.sub{{font-size:13px;color:#9aa3bf;line-height:1.6}}
.controls{{padding:14px 22px;display:flex;gap:14px;flex-wrap:wrap;align-items:center;background:#131829;border-bottom:1px solid #2a3350}}
.controls input,.controls select{{background:#0f1320;color:#e6e9f0;border:1px solid #2a3350;border-radius:6px;padding:7px 10px;font-size:13px}}
.tabs button{{background:#0f1320;color:#9aa3bf;border:1px solid #2a3350;border-radius:6px 6px 0 0;padding:8px 16px;cursor:pointer;font-size:14px}}
.tabs button.on{{background:#2a3350;color:#fff}}
.toggle{{display:flex;align-items:center;gap:6px;color:#9aa3bf;font-size:13px;margin-left:auto}}
table{{border-collapse:collapse;width:100%;font-size:13px}}
th,td{{padding:7px 10px;border-bottom:1px solid #222a42;text-align:right;white-space:nowrap}}
th{{position:sticky;top:0;background:#1b2236;color:#b9c2e0;cursor:pointer;user-select:none;z-index:2}}
th.nm,td.nm{{text-align:left;position:sticky;left:0;background:#171c2e;z-index:1;min-width:180px}}
td.nm{{background:#131829}}
.bar{{height:5px;background:#222a42;border-radius:3px;margin-bottom:3px;overflow:hidden}}
.fill{{height:100%;background:linear-gradient(90deg,#4f8cff,#7b5cff)}}
.k-robot{{color:#ffcf6b;font-weight:700}} .k-mon{{color:#6bdcff}}
.cap1{{color:#5be39a;font-weight:700}} .cap0{{color:#ff7b7b}}
.est{{color:#ff9b4f;font-weight:700}}
.cmp{{margin-top:10px;background:#131829;border:1px solid #2a3350;border-radius:8px;padding:8px 12px}}
.cmp summary{{cursor:pointer;color:#9aa3bf;font-size:13px}}
table.ct{{margin-top:8px;font-size:12px;max-width:520px}}
table.ct th,table.ct td{{padding:5px 10px}}
td.ok{{color:#5be39a}} td.warn{{color:#ff9b4f}}
.tier-badge{{color:#b9a2ff;font-weight:700}}
.ec-elite{{background:#3a2b52;color:#d9b8ff;border-radius:4px;padding:1px 5px;font-size:11px;margin-right:4px}}
.ec-boss{{background:#54232a;color:#ff9b9b;border-radius:4px;padding:1px 5px;font-size:11px;margin-right:4px;font-weight:700}}
.wrap{{overflow:auto;max-height:78vh}}
.count{{color:#9aa3bf;font-size:12px;margin-left:8px}}
</style></head>
<body>
<header>
<h1>全量生物 / 机甲 属性对比</h1>
<div class="sub">
机甲 = <b>RobotBase</b>（Kind=robot，可捕捉）；怪物/虫族 = <b>MonsterBase</b>（Kind=monster 不可捕捉 / 特殊野生机甲 Kind=robot 可捕捉）。
字段与机甲完全同构（42 属性 + Kind + Capturable）。<span class="est">⚠估算</span> = 游戏原无数据、按通用公式估算填入。
单元格背景条长度 = 该列最大值占比，便于横向对比。<br>
<b>怪物属性按「机甲公式(level) × 每只怪独立随机系数」重建（v4）</b>：每只怪一套独立公式，
HP/MP 先按比例降级再按公式长回；命中/致命/侵蚀/抗性为怪物专属非零公式（机甲该四项恒为 0，靠装备补）。
战斗伤害 = max(1, 攻击(近战+射击) − 防御(装甲))。<br>
<b>v4 基准校正</b>：以<b>满配玩家</b>为参照系（普攻 <b>{TOP_ATK}</b> / 单体技能 <b>{TOP_SKILL_SINGLE}</b> / 群攻 <b>{TOP_SKILL_AOE}</b>）——
普通怪 HP ≤ {NORMAL_HP_CAP}（满配 1 刀秒）、精英 ≈ {ELITE_HP_CAP} 内（技能可秒）、BOSS 更高（需技能+多回合）。
<b>抽怪按玩家等级匹配</b>（_nominalLevel 在玩家等级 −6~+10 区间）。
数据 = 云端真实落库值（已校验 383/383 一致）。
</div>
<details class="cmp" open>
<summary>满配刀数推演：分档中位 HP ÷ 满配攻击（点开）</summary>
<table class="ct">
<thead><tr><th class="nm">分档</th><th>数量</th><th>HP 区间</th><th>HP 中位</th><th>满配普攻</th><th>满配技能</th><th>攻击中位</th></tr></thead>
<tbody>{cls_rows}</tbody>
</table>
<div style="margin-top:6px;color:#9aa3bf;font-size:12px">参照：满配普攻 {TOP_ATK} ／ 单体技能 {TOP_SKILL_SINGLE} ／ 群攻 {TOP_SKILL_AOE}；&lt;1.00 刀 = 1 刀秒。</div>
</details>
<details class="cmp">
<summary>量级对比：怪物中位数 vs 机甲 L60 设计值（点开）</summary>
<table class="ct">
<thead><tr><th class="nm">属性</th><th>怪物中位</th><th>机甲L60中位</th><th>比值</th></tr></thead>
<tbody>{cmp_rows}</tbody>
</table>
</details>
</header>
<div class="controls">
  <div class="tabs">
    <button id="tabMech" class="on" onclick="switchTab('mech')">机甲 RobotBase（{len(mechs)}）</button>
    <button id="tabMon" onclick="switchTab('mon')">怪物/虫族 MonsterBase（{len(monsters)}）</button>
  </div>
  <input id="q" placeholder="搜索名称…" oninput="render()">
  <select id="kindF" onchange="render()">
    <option value="">全部 Kind</option><option value="robot">robot（机甲）</option><option value="monster">monster（怪物）</option>
  </select>
  <label class="toggle"><input type="checkbox" id="l60" onchange="render()"> 机甲显示满级 L60 设计值</label>
</div>
<div class="wrap">
<table id="tbl">
<thead><tr><th class="nm" onclick="sortBy('nm')">名称</th><th onclick="sortBy('kind')">Kind</th><th onclick="sortBy('cap')">类型/可捕捉</th><th onclick="sortBy('lv')">等级</th>{heads}</tr></thead>
<tbody id="tbody"></tbody>
</table>
</div>
<script>
const MECH={json.dumps(mechs,ensure_ascii=False)};
const MON={json.dumps(monsters,ensure_ascii=False)};
let cur='mech', sortKey='nm', sortAsc=true;
const FIELDS={json.dumps([l for l,_ in FIELDS],ensure_ascii=False)};
function switchTab(t){{cur=t;document.getElementById('tabMech').classList.toggle('on',t==='mech');document.getElementById('tabMon').classList.toggle('on',t==='mon');render();}}
function sortBy(k){{if(sortKey===k)sortAsc=!sortAsc;else{{sortKey=k;sortAsc=true;}}render();}}
function maxOf(arr,mode){{const m={{}};FIELDS.forEach(f=>m[f]=Math.max(1,...arr.map(x=>x[mode][f])));return m;}}
function render(){{
  const q=document.getElementById('q').value.trim();
  const kf=document.getElementById('kindF').value;
  const l60=document.getElementById('l60').checked;
  const src=cur==='mech'?MECH:MON;
  const mode=(cur==='mech'&&l60)?'l60':'actual';
  let rows=src.filter(x=>(!q||x.name.includes(q))&&(!kf||x.kind===kf));
  rows.sort((a,b)=>{{
    let va,vb;
    if(sortKey==='nm'){{va=a.name;vb=b.name;}}
    else if(sortKey==='kind'){{va=a.kind;vb=b.kind;}}
    else if(sortKey==='cap'){{va=a.capturable;vb=b.capturable;}}
    else if(sortKey==='lv'){{va=a.level;vb=b.level;}}
    else{{va=a[mode][sortKey];vb=b[mode][sortKey];}}
    if(typeof va==='string')return sortAsc?va.localeCompare(vb,'zh'):vb.localeCompare(va,'zh');
    return sortAsc?va-vb:vb-va;
  }});
  const mm=maxOf(rows,mode);
  const tb=document.getElementById('tbody');tb.innerHTML='';
  rows.forEach(x=>{{
    const est=x.est? ' <span class="est" title="游戏原无此怪数据，按通用公式估算">⚠估算</span>':'';
    const cap=x.capturable==1?'<span class="cap1">可捕捉</span>':'<span class="cap0">不可捕捉</span>';
    const ktag=x.kind==='robot'?'<span class="k-robot">机甲</span>':'<span class="k-mon">怪物</span>';
    let cells='';
    FIELDS.forEach(f=>{{const v=x[mode][f];const pct=Math.min(100,Math.round(v/mm[f]*100));cells+=`<td><div class="bar"><div class="fill" style="width:${{pct}}%"></div></div>${{v}}</td>`;}});
    const tierB=(x.tier?` <span class="tier-badge" title="公式档位（决定系数区间）">T${{x.tier}}</span>`:'');
    tb.insertAdjacentHTML('beforeend',`<tr><td class="nm">${{x.name}}${{est}}</td><td>${{ktag}}</td><td>${{cap}}</td><td>${{x.level}}${{tierB}}</td>${{cells}}</tr>`);
  }});
}}
render();
</script>
</body></html>"""

open(OUT, "w", encoding="utf-8").write(HTML)
print("写出", OUT)
print("机甲", len(mechs), " 怪物/虫族", len(monsters))
print("机甲 L60 样本(铁臂):", mechs[0]["name"] if mechs else "", mechs[0]["l60"] if mechs else "")
