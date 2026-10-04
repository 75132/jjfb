/**
 * SkillData.ts 客户端自测（纯逻辑，Node 直接跑）
 *   先编译：node node_modules/typescript/bin/tsc assets/Script/Game/SkillData.ts \
 *             --outDir tools/_preview/sd --target es2017 --module commonjs --skipLibCheck
 *   再运行：node tools/_test_skilldata_client.cjs
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const S = require('./_preview/sd/SkillData.js');

let pass = 0, fail = 0;
function ck(name, cond, extra) {
    if (cond) { pass++; return; }
    fail++;
    console.log('  ✗ ' + name + (extra === undefined ? '' : '  → ' + JSON.stringify(extra)));
}
function section(t) { console.log('\n[' + t + ']'); }

section('1) 职业线解析');
ck('Class=1 → fighter', S.resolveClassLine(1) === 'fighter');
ck('Class=2 → shooter', S.resolveClassLine(2) === 'shooter');
ck('Class=3 → universal', S.resolveClassLine(3) === 'universal');
ck('中文「射击」→ shooter', S.resolveClassLine('射击') === 'shooter');
ck('英文 shooter → shooter', S.resolveClassLine('shooter') === 'shooter');
ck('未知值 → fighter（兜底）', S.resolveClassLine(undefined) === 'fighter');

section('2) 枪械判定（武器 id 28-51）');
ck('27 不是枪', S.isGunItemId(27) === false);
ck('28 是枪', S.isGunItemId(28) === true);
ck('51 是枪', S.isGunItemId(51) === true);
ck('52 不是枪', S.isGunItemId(52) === false);
ck('{Gun:{item_id:30}} → 持枪', S.hasGunEquipped({ Gun: { item_id: 30 } }) === true);
ck('{gun:{itemId:51}} → 持枪', S.hasGunEquipped({ gun: { itemId: 51 } }) === true);
ck('{Gun:{item_id:5}} → 不持枪', S.hasGunEquipped({ Gun: { item_id: 5 } }) === false);
ck('null → 不持枪', S.hasGunEquipped(null) === false);
ck('其他槽位持枪也算', S.hasGunEquipped({ Hand: { item_id: 40 } }) === true);
ck('Level=30 不误判成枪', S.hasGunEquipped({ Level: 30 }) === false);
ck('裸 id 30 → 持枪', S.hasGunEquipped(30) === true);

section('3) 普攻三职业三公式');
ck('格斗不持枪 → 格斗', S.resolveNormalAttack(1, false).classes === 'fighter');
ck('格斗持枪 → 仍是格斗（格斗不吃枪）', S.resolveNormalAttack(1, true).classes === 'fighter');
ck('射击不持枪 → 退回格斗', S.resolveNormalAttack(2, false).classes === 'fighter');
ck('射击持枪 → 射击', S.resolveNormalAttack(2, true).classes === 'shooter');
ck('全能不持枪 → 退回格斗', S.resolveNormalAttack(3, false).classes === 'fighter');
ck('全能持枪 → 全能', S.resolveNormalAttack(3, true).classes === 'universal');
ck('缩放式已就位(格斗)', S.resolveNormalAttack(1, false).formulaScaled === '(a.atk / 3) * 3 - b.def * 1');

section('4) 公式求值（口径 A：a.atk÷3 + 去尾常数）');
// 缩放后：格斗 = (100/3)*3 - 50 = 50；射击 = (100/3)*2.5 - 50 = 33.33→33；全能 = (100/3)*3.5 - 50 = 66.67→66
const g = S.calcNormalAttackDamage(1, false, 100, 50);
ck('格斗 atk100 def50 → 50', g.damage === 50, g.damage);
const sh = S.calcNormalAttackDamage(2, true, 100, 50);
ck('射击 atk100 def50 → 33', sh.damage === 33, sh.damage);
const u = S.calcNormalAttackDamage(3, true, 100, 50);
ck('全能 atk100 def50 → 66', u.damage === 66, u.damage);
ck('口径A ≡ 攻击−装甲（满配 17272/3000）',
    S.evalSkillFormula('(a.atk / 3) * 3 - b.def * 1', 17272, 3000) === 14272);
ck('固定值 2500', S.evalSkillFormula('2500', 1, 1) === 2500);
ck('缩放固定值 833', S.evalSkillFormula('833', 1, 1) === 833);
ck('公式 0', S.evalSkillFormula('0', 99, 99) === 0);
ck('旧形兼容 a.atk*3-b.def*1+1000', S.evalSkillFormula('a.atk * 3 - b.def * 1 + 1000', 100, 50) === 1250);
ck('缩放+尾常数 (a.atk/3)*4-b.def*1+10', S.evalSkillFormula('(a.atk / 3) * 4 - b.def * 1 + 10', 300, 20) === 390);
ck('缩放无def项 (a.atk/3)*3', S.evalSkillFormula('(a.atk / 3) * 3', 300, 999) === 300);
ck('多段/未知公式 → null（不猜）', S.evalSkillFormula('a.atk * 2 - b.def * 1 + 400 * 3', 1, 1) === null);
ck('null 公式 → null', S.evalSkillFormula(null, 1, 1) === null);
ck('伤害下限为 1', S.calcNormalAttackDamage(1, false, 0, 99999).damage === 1);

section('5) 技能等级倍率');
ck('Lv1 ×1.0', S.skillLevelMultiplier(1) === 1.0);
ck('Lv2 ×1.2', S.skillLevelMultiplier(2) === 1.2);
ck('Lv3 ×1.3', S.skillLevelMultiplier(3) === 1.3);
ck('Lv4 ×1.5', S.skillLevelMultiplier(4) === 1.5);
ck('越界按 Lv1', S.skillLevelMultiplier(9) === 1.0);
ck('floor(100×1.3)=130', S.applySkillLevel(100, 3) === 130);
ck('floor(101×1.5)=151', S.applySkillLevel(101, 4) === 151);
ck('上限 4 级', S.SKILL_LEVEL_MAX === 4);
ck('悟性40 → 4%', Math.abs(S.autoUpgradeChance(40) - 0.04) < 1e-12, S.autoUpgradeChance(40));
ck('悟性100 → 10%', Math.abs(S.autoUpgradeChance(100) - 0.1) < 1e-12, S.autoUpgradeChance(100));

section('6) 自动升级（概率 = 悟性/100×0.1）');
ck('悟性40 → 4%：rng 0.039 命中', S.rollAutoUpgrade(40, 1, () => 0.039) === true);
ck('悟性40 → 4%：rng 0.041 不中', S.rollAutoUpgrade(40, 1, () => 0.041) === false);
ck('悟性100 → 10%：rng 0.099 命中', S.rollAutoUpgrade(100, 1, () => 0.099) === true);
ck('悟性100 → 10%：rng 0.101 不中', S.rollAutoUpgrade(100, 1, () => 0.101) === false);
ck('满级不再判定', S.rollAutoUpgrade(100, 4, () => 0) === false);
ck('悟性 0 → 永不升', S.rollAutoUpgrade(0, 1, () => 0) === false);

section('7) 手动升级条件（书数 + 等级）');
ck('Lv1→2 无书 → 拒绝', S.checkManualUpgrade(1, 0, 25, true).ok === false);
ck('Lv1→2 等级 24 → 拒绝', S.checkManualUpgrade(1, 1, 24, true).ok === false);
ck('Lv1→2 1本+25级 → 通过', S.checkManualUpgrade(1, 1, 25, true).ok === true);
ck('Lv2→3 1本 → 拒绝', S.checkManualUpgrade(2, 1, 40, true).ok === false);
ck('Lv2→3 2本+40级 → 通过', S.checkManualUpgrade(2, 2, 40, true).ok === true);
ck('Lv3→4 3本+50级 → 通过', S.checkManualUpgrade(3, 3, 50, true).ok === true);
ck('Lv3→4 只2本 → 拒绝', S.checkManualUpgrade(3, 2, 50, true).ok === false);
ck('已满级 → 拒绝', S.checkManualUpgrade(4, 9, 99, true).ok === false);
ck('无对应技能书 → 拒绝', S.checkManualUpgrade(1, 9, 99, false).ok === false);

// ---------------------------------------------------------------------------
// 8) 目录注入 + 与服务端权威数据对齐
// ---------------------------------------------------------------------------
section('8) 技能目录注入');
const REPO = path.resolve(__dirname, '..');
const SERVER_JSON = path.join(REPO, 'server', 'data', 'Skills.json');
const CLIENT_JSON = path.join(REPO, 'assets', 'resources', 'json', 'Skills.json');
const catalog = JSON.parse(fs.readFileSync(SERVER_JSON, 'utf8'));

ck('未注入时 getSkillCatalog 为 null', S.getSkillCatalog() === null);
ck('未注入时 allSkillDefs 为空', S.allSkillDefs().length === 0);
S.setSkillCatalog(catalog);
ck('注入后 version=6', S.getSkillCatalog().version === 6);
ck('注入后技能数 34', S.allSkillDefs().length === 34);
ck('注入非法目录 → 清空', (S.setSkillCatalog({}), S.getSkillCatalog()) === null);
S.setSkillCatalog(catalog);

section('9) 目录驱动普攻（与服务端 normal_attack 同源）');
const naF = S.resolveNormalAttack(1, false);
ck('目录格斗普攻缩放式一致', naF.formulaScaled === '(a.atk / 3) * 3 - b.def * 1', naF.formulaScaled);
ck('目录带出 variance=20', naF.variance === 20);
ck('目录带出 critical=true', naF.critical === true);
const naS = S.resolveNormalAttack(2, true);
ck('目录射击普攻缩放式一致', naS.formulaScaled === '(a.atk / 3) * 2.5 - b.def * 1', naS.formulaScaled);
ck('目录射击需持枪', naS.requiresGun === true);
ck('不持枪仍回落格斗', S.resolveNormalAttack(2, false).formulaScaled === '(a.atk / 3) * 3 - b.def * 1');

section('10) 技能引用归一（key/名称/书/技能id）');
ck('key: roubo', S.resolveSkillRef('roubo') === 'roubo');
ck('名称: 肉搏攻击', S.resolveSkillRef('肉搏攻击') === 'roubo');
ck('技能书 id: 36', S.resolveSkillRef(36) === 'roubo');
ck('RPG skill id: 3', S.resolveSkillRef(3) === 'roubo');
ck('对象 {key}', S.resolveSkillRef({ key: 'leiting' }) === 'leiting');
ck('认不出 → null（不猜）', S.resolveSkillRef('不存在的技能') === null);

section('11) 计算用式 / damage 码 / scope / 职业匹配');
const roubo = S.getSkillDef('roubo');
ck('formulaOf 取 formula_scaled', S.formulaOf(roubo) === '(a.atk / 3) * 5 - b.def * 1', S.formulaOf(roubo));
ck('formula_scaled 缺失时回落 formula',
    S.formulaOf({ key: 'x', name: 'x', scope: 1, damage_type: 'hp_damage', formula: 'a.atk * 2 - b.def * 1' }) === 'a.atk * 2 - b.def * 1');
ck('damageCode hp_damage=1', S.damageCodeOf(roubo) === 1);
ck('damageCode hp_drain=3', S.damageCodeOf(S.getSkillDef('shengmingshequ')) === 3);
ck('damageCode mp_drain=4', S.damageCodeOf(S.getSkillDef('zhaqu')) === 4);
ck('damageCode none=0', S.damageCodeOf(S.getSkillDef('xiuli')) === 0);
ck('scope1 → single/enemy', (() => { const r = S.resolveScope(1); return r.target === 'single' && r.side === 'enemy' && !r.is_all; })());
ck('scope2 → all/enemy', (() => { const r = S.resolveScope(2); return r.target === 'all' && r.side === 'enemy' && r.is_all; })());
ck('scope7 → single/ally', (() => { const r = S.resolveScope(7); return r.target === 'single' && r.side === 'ally' && r.is_ally; })());
ck('scope11 → self', (() => { const r = S.resolveScope(11); return r.is_self && r.side === 'self'; })());
ck('roubo 属格斗线', S.skillMatchesClass(roubo, 'fighter') === true);
ck('roubo 不属射击线', S.skillMatchesClass(roubo, 'shooter') === false);
ck('通用技能全职业可学', S.skillMatchesClass(S.getSkillDef('xiuli'), 'shooter') === true);

section('12) 能量消耗 / 可施放判定');
ck('roubo 25% × 800 = 200', S.mpCostOf(roubo, 800) === 200);
ck('roubo 25% × 3 → 保底 1', S.mpCostOf(roubo, 3) === 1);
ck('无消耗技能 → 0', S.mpCostOf(S.getSkillDef('life_recover'), 800) === 0);
ck('undefined 技能 → 0', S.mpCostOf(null, 800) === 0);
ck('蓝够 → ok', S.canCastSkill(roubo, { mp: 200, maxMp: 800 }).ok === true);
ck('蓝少 1 → 能量不足', S.canCastSkill(roubo, { mp: 199, maxMp: 800 }).reason === '能量不足');
ck('自动触发技不可主动施放',
    S.canCastSkill(S.getSkillDef('life_recover'), { mp: 999, maxMp: 800 }).reason === '该技能为自动触发技，不能主动施放');
// reference_only 分支保留但当前**无数据**（纳米侵蚀 2026-10-01 起已开放）→ 用假技能验证
ck('仅参考项不可施放（假技能 → 分支仍生效）',
    S.canCastSkill({ key: 'x_ref', name: '假参考技', scope: 1, damage_type: 'hp_damage',
        category: 'skill_1', mp_cost_percent: 0, reference_only: true },
        { mp: 999, maxMp: 800 }).reason === '该技能仅为参考项，未实装');
ck('★纳米侵蚀已开放 → 不再是参考项，可正常施放',
    S.canCastSkill(S.getSkillDef('nami_qinshi'), { mp: 9999, maxMp: 9999 }).ok === true &&
    !S.getSkillDef('nami_qinshi').reference_only);
ck('未学会 → 拒绝',
    S.canCastSkill(roubo, { mp: 999, maxMp: 800, learned: ['leiting'] }).reason === '尚未学会该技能');
ck('已学会（按名称）→ ok',
    S.canCastSkill(roubo, { mp: 999, maxMp: 800, learned: ['肉搏攻击'] }).ok === true);

section('13) 可施放技能列表（供 UI 接入）');
// ⚠ 默认只列「已学」（learnedOnly 默认 true）：机甲初始 / 获得时没有技能（`Skills`
//   字段都没有），只有用技能书学会才写入 —— 所以新机甲面板为空是**预期行为**。
//   与服务端 skill_list 完全同口径（2026-09-30 用户拍板）。
const noFieldList = S.listCastableSkills({ mp: 999, maxMp: 800 });
ck('★无「已学」字段 → 默认空列表（机甲初始没技能）', noFieldList.length === 0, noFieldList.length);

const castList = S.listCastableSkills({ mp: 999, maxMp: 800, learned: ['roubo', 'leiting'] });
ck('★已学 2 个 → 只列 2 条', castList.length === 2, castList.map((x) => x.key));
ck('含 roubo', castList.some((x) => x.key === 'roubo'));
ck('排除自动触发技 life_recover', !castList.some((x) => x.key === 'life_recover'));
ck('未学技能不进列表（nami_qinshi 已开放但未学）', !castList.some((x) => x.key === 'nami_qinshi'));
ck('条目带 mp_cost=200', (castList.find((x) => x.key === 'roubo') || {}).mp_cost === 200);
ck('条目带 level 默认 1', (castList.find((x) => x.key === 'roubo') || {}).level === 1);
ck('条目带 learned=true', (castList.find((x) => x.key === 'roubo') || {}).learned === true);
ck('输出按技能表顺序（已学优先排序）',
    JSON.stringify(castList.map((x) => x.key)) === '["roubo","leiting"]', castList.map((x) => x.key));
ck('等级表生效 → Lv3',
    S.listCastableSkills({ mp: 999, maxMp: 800, learned: ['roubo'] },
        { levels: { roubo: 3 } })[0].level === 3);
ck('蓝不足 → usable=false',
    S.listCastableSkills({ mp: 0, maxMp: 800, learned: ['roubo'] })[0].usable === false);
ck('已学写法兼容技能书 id',
    S.listCastableSkills({ mp: 999, maxMp: 800, learned: [36] })[0].key === 'roubo');
ck('学习后再次列出会带上新技能（Skills 数组驱动）',
    S.listCastableSkills({ mp: 999, maxMp: 800, learned: ['roubo', 'guangrenzhan'] }).length === 2);

// —— 技能图鉴模式（learnedOnly=false）：按职业线列全量，供 UI 备用 ——
const allList = S.listCastableSkills({ mp: 99999, maxMp: 9999 }, { learnedOnly: false });
// ⚠ 2026-10-01 起 纳米侵蚀开放所有职业可学 → 图鉴 31 → **32 条**（不再有参考项）
ck('learnedOnly=false → 排除 skill_3 后 32 条', allList.length === 32, allList.length);
const fList = S.listCastableSkills({ mp: 999, maxMp: 800, classLine: 1 }, { learnedOnly: false });
ck('图鉴·格斗线 → 只拿 fighter + all',
    fList.every((x) => x.classes === 'fighter' || x.classes === 'all'),
    [...new Set(fList.map((x) => x.classes))]);
ck('图鉴·格斗线不含射击专属（ruodian 属 shooter）', !fList.some((x) => x.key === 'ruodian'));
const sList = S.listCastableSkills({ mp: 999, maxMp: 800, classLine: 2 }, { learnedOnly: false });
ck('图鉴·射击线含 ruodian', sList.some((x) => x.key === 'ruodian'));
ck('图鉴·射击线不含格斗专属（roubo 属 fighter）', !sList.some((x) => x.key === 'roubo'));
const uList = S.listCastableSkills({ mp: 999, maxMp: 800, classLine: 3 }, { learnedOnly: false });
ck('图鉴·全能线 → 全部 universal + all',
    uList.every((x) => x.classes === 'universal' || x.classes === 'all'),
    [...new Set(uList.map((x) => x.classes))]);
ck('classLine 兼容字符串写法',
    S.listCastableSkills({ mp: 999, maxMp: 800, classLine: 'shooter' }, { learnedOnly: false })
        .length === sList.length);
// ★2026-10-01 用户拍板：纳米侵蚀开放所有职业可学 → 三线图鉴都要有它，且不再是参考项
const namiOf = (l) => l.find((x) => x.key === 'nami_qinshi');
ck('★纳米侵蚀已纳入图鉴（默认带出）', !!namiOf(allList) && !namiOf(allList).reference_only);
ck('★纳米侵蚀 = classes all（三职业通用）', namiOf(allList).classes === 'all');
ck('★格斗线图鉴含纳米侵蚀', !!namiOf(fList));
ck('★射击线图鉴含纳米侵蚀', !!namiOf(sList));
ck('★全能线图鉴含纳米侵蚀', !!namiOf(uList));
ck('includeReference 开关保留（当前无参考项 → 条数不变）',
    S.listCastableSkills({ mp: 999, maxMp: 800, classLine: 2 },
        { learnedOnly: false, includeReference: true }).length === sList.length);
ck('★书 56（纳米侵蚀）三职业都能学会（skillMatchesClass 不拦 all）',
    S.skillMatchesClass(S.getSkillDef('nami_qinshi'), 'fighter') &&
    S.skillMatchesClass(S.getSkillDef('nami_qinshi'), 'shooter') &&
    S.skillMatchesClass(S.getSkillDef('nami_qinshi'), 'universal'));
ck('图鉴模式下已学排最前',
    S.listCastableSkills({ mp: 999, maxMp: 800, learned: ['roubo'], classLine: 1 },
        { learnedOnly: false })[0].key === 'roubo');
ck('图鉴模式下未学也带 learned=false',
    S.listCastableSkills({ mp: 999, maxMp: 800, learned: ['roubo'], classLine: 1 },
        { learnedOnly: false }).some((x) => x.learned === false));

section('14) 动作构造 / 归一化（发给服务端的结构）');
ck('buildSkillAction → {SKILL, key}', JSON.stringify(S.buildSkillAction('roubo')) === '{"type":"SKILL","skill_key":"roubo"}');
ck('buildSkillAction 归一名称', S.buildSkillAction('肉搏攻击').skill_key === 'roubo');
ck('"ATTACK" → ATTACK', S.normalizeAction('ATTACK').type === 'ATTACK');
ck('"SKILL:roubo" → SKILL/roubo',
    (() => { const a = S.normalizeAction('SKILL:roubo'); return a.type === 'SKILL' && a.skill_key === 'roubo'; })());
ck('{type:SKILL, skill_key} → 归一', S.normalizeAction({ type: 'SKILL', skill_key: 'leiting' }).skill_key === 'leiting');
ck('{skill_key} 无 type → SKILL', S.normalizeAction({ skill_key: 'roubo' }).type === 'SKILL');
ck('技能名直接给 → SKILL', S.normalizeAction('火焰风暴').skill_key === 'kuangnu');
ck('null → null', S.normalizeAction(null) === null);
ck('actionTypeOf 兼容字符串', S.actionTypeOf('defend') === 'DEFEND');
ck('actionTypeOf 兼容对象', S.actionTypeOf({ type: 'skill' }) === 'SKILL');

section('15) 服务端回合事件读取');
ck('技能名优先', S.roundEventLabel({ side: 'player', type: 'SKILL', skill_key: 'roubo', skill_name: '肉搏攻击' }) === '肉搏攻击');
ck('无 skill_name 时查目录', S.roundEventLabel({ side: 'player', type: 'SKILL', skill_key: 'leiting' }) === '纳米攻击');
ck('普攻 → 普通攻击', S.roundEventLabel({ side: 'enemy', type: 'ATTACK' }) === '普通攻击');
ck('防御 → 防御', S.roundEventLabel({ side: 'player', type: 'DEFEND' }) === '防御');

section('16) 两份 Skills.json 一致性');
const bufS = fs.readFileSync(SERVER_JSON);
const bufC = fs.readFileSync(CLIENT_JSON);
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
ck('server/data 与 resources/json md5 一致', md5(bufS) === md5(bufC), md5(bufS) + ' vs ' + md5(bufC));

section('17) 跨端契约：服务端真实 round_events → 客户端读取层');
const FIXTURE = path.join(__dirname, '_fixtures', 'round_events_sample.json');
ck('样例文件存在（先跑 tools/_gen_round_events_fixture.py）', fs.existsSync(FIXTURE));
let fixes = null;
if (fs.existsSync(FIXTURE)) fixes = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
ck('样例 skills_version=6', fixes && fixes.skills_version === 6, fixes && fixes.skills_version);
ck('样例 9 个场景', fixes && fixes.scenarios.length === 9, fixes && fixes.scenarios.length);

const SIDES = ['player', 'enemy'];
const ACTIONS = ['ATTACK', 'SKILL', 'DEFEND', 'ESCAPE'];
let evTotal = 0, evBadSide = 0, evBadAction = 0, evNoLabel = 0, evBadTarget = 0, evBadSkill = 0, evBadHeal = 0;
const byName = {};
for (const sc of (fixes ? fixes.scenarios : [])) {
    byName[sc.name] = sc;
    for (const ev of sc.events) {
        evTotal++;
        if (SIDES.indexOf(ev.side) < 0) evBadSide++;
        if (ACTIONS.indexOf(String(ev.action || '').toUpperCase()) < 0) evBadAction++;
        if (!S.roundEventLabel(ev)) evNoLabel++;
        for (const t of (Array.isArray(ev.targets) ? ev.targets : [])) {
            if (SIDES.indexOf(t.side) < 0 || !Number.isFinite(Number(t.hp_after))) evBadTarget++;
        }
        for (const h of (Array.isArray(ev.heals) ? ev.heals : [])) {
            if (['hp', 'mp'].indexOf(String(h.attr || '')) < 0 || !(Number(h.value) > 0)) evBadHeal++;
        }
        if (String(ev.action).toUpperCase() === 'SKILL' && ev.skill_key) {
            const k = S.resolveSkillRef(ev.skill_key);
            const d = k ? S.getSkillDef(k) : null;
            if (!k || !d) evBadSkill++;
            else if (ev.skill_name && d.name !== ev.skill_name) evBadSkill++;
            else if (ev.anim && String(d.anim) !== String(ev.anim)) evBadSkill++;
        }
    }
}
ck('事件总数 18', evTotal === 18, evTotal);
ck('每条的 side 合法', evBadSide === 0, evBadSide);
ck('每条的 action 合法', evBadAction === 0, evBadAction);
ck('每条都能读出展示名', evNoLabel === 0, evNoLabel);
ck('每个 target 都带 hp_after', evBadTarget === 0, evBadTarget);
ck('每个 heal 的 attr/value 合法', evBadHeal === 0, evBadHeal);
ck('SKILL 事件的 key/名称/anim 与目录一致', evBadSkill === 0, evBadSkill);

// 关键场景的语义断言（保证样例真的覆盖到了各条链路）
const evsOf = (n) => (byName[n] ? byName[n].events : []);
const hasHeal = (n, attr, from) => evsOf(n).some((e) => (e.heals || []).some(
    (h) => h.attr === attr && (from === undefined || h.from === from)));
ck('普攻场景：双方各一次 ATTACK', evsOf('attack').filter((e) => e.action === 'ATTACK').length === 2);
ck('技能伤害场景：带 anim=quan01',
    evsOf('skill_damage').some((e) => e.action === 'SKILL' && e.anim === 'quan01' && e.skill_key === 'roubo'));
ck('技能伤害场景：targets 有伤害值',
    evsOf('skill_damage').some((e) => (e.targets || []).some((t) => Number(t.damage) > 0)));
ck('吸血场景：HP 汲取产生 heals(from=drain)', hasHeal('skill_drain_hp', 'hp', 'drain'));
ck('吸蓝场景：MP 汲取产生 heals(from=drain)', hasHeal('skill_drain_mp', 'mp', 'drain'));
ck('治疗场景：比例治疗产生 heals(hp)', hasHeal('skill_heal', 'hp'));
ck('治疗场景：effects 记录 hp_recover_ratio',
    evsOf('skill_heal').some((e) => (e.effects || []).some((x) => x.kind === 'hp_recover_ratio')));
ck('护盾场景：SKILL 事件存在且无伤害（纯 buff）', evsOf('skill_shield').some(
    (e) => e.action === 'SKILL' && String(e.skill_key) === 'nenglianghudun'
        && !(e.targets || []).some((t) => Number(t.damage) > 0)));
ck('护盾场景：额外效果进 pending_effects（待口径）', evsOf('skill_shield').some(
    (e) => (e.pending_effects || []).length > 0));
ck('防御场景：player 的 DEFEND 事件无 targets',
    evsOf('defend').some((e) => e.side === 'player' && e.action === 'DEFEND' && !(e.targets || []).length));
ck('能量不足场景：failed=能量不足',
    evsOf('failed_mp').some((e) => e.failed === '能量不足'));
ck('未学会场景：failed=尚未学会该技能',
    evsOf('failed_unknown').some((e) => e.failed === '尚未学会该技能'));
ck('技能事件都带 mp_after（客户端据此落蓝）',
    evsOf('skill_damage').some((e) => Number.isFinite(Number(e.mp_after))));

section('18) 技能图标：必须取自 SkillIcon 图集（口径 tools/skill_category_todo.md）');
const ICON_META = path.join(REPO, 'assets', 'resources', 'SkillIcon', 'SkillIcon.plist.meta');
const ICON_PNG = path.join(REPO, 'assets', 'resources', 'SkillIcon', 'SkillIcon.png');
ck('SkillIcon 图集已移入 resources', fs.existsSync(ICON_META) && fs.existsSync(ICON_PNG));
let iconFrames = [];
if (fs.existsSync(ICON_META)) {
    let raw = fs.readFileSync(ICON_META, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const meta = JSON.parse(raw);
    iconFrames = Object.values(meta.subMetas || {}).map((v) => v.name);
}
ck('图集含 skill_1..skill_5', [1, 2, 3, 4, 5].every((i) => iconFrames.indexOf('skill_' + i) >= 0), iconFrames);
ck('图集就 5 帧（分类图标）', iconFrames.length === 5, iconFrames.length);
ck('SKILL_ICON_ATLAS_PATH = SkillIcon/SkillIcon', S.SKILL_ICON_ATLAS_PATH === 'SkillIcon/SkillIcon');
ck('DEFAULT_SKILL_ICON = skill_1', S.DEFAULT_SKILL_ICON === 'skill_1');
ck('图集加载路径在 resources 下真实存在',
    fs.existsSync(path.join(REPO, 'assets', 'resources', S.SKILL_ICON_ATLAS_PATH + '.plist')));

// 每条技能的 iconIndex 必须命中图集帧；且**绝不能是背包图集 IconSet2**
const badIconFrames = [];
const usedIconSet2 = [];
for (const s of (catalog.skills || [])) {
    const ic = s.iconIndex === undefined || s.iconIndex === null ? '' : String(s.iconIndex);
    if (!ic) { badIconFrames.push(s.key + '(空)'); continue; }
    if (ic.indexOf('IconSet2') >= 0) usedIconSet2.push(s.key + '=' + ic);
    else if (iconFrames.indexOf(ic) < 0) badIconFrames.push(s.key + '=' + ic);
}
ck('全部技能都有 iconIndex 且命中图集', badIconFrames.length === 0, badIconFrames);
ck('没有任何技能误用背包图集 IconSet2', usedIconSet2.length === 0, usedIconSet2);
ck('skillIconOf 缺省回落 skill_1', S.skillIconOf(null) === 'skill_1');
ck('skillIconOf 读 iconIndex', S.skillIconOf({ key: 'x', name: 'x', scope: 1, damage_type: 'hp_damage', iconIndex: 'skill_3' }) === 'skill_3');

// 分类口径（tools/skill_category_todo.md 的用户填表）逐条核对
const ICON_EXPECT = {
    life_recover: 'skill_2', energy_recover: 'skill_2',
    leiting: 'skill_3', ruodian: 'skill_3',
};
const iconMismatch = [];
for (const s of (catalog.skills || [])) {
    const want = ICON_EXPECT[s.key] || 'skill_1';
    if (String(s.iconIndex) !== want) iconMismatch.push(s.key + ':' + s.iconIndex + '≠' + want);
}
ck('分类分配与文档表一致（1→skill_1 / 2→skill_2 / 3→skill_3）', iconMismatch.length === 0, iconMismatch);
ck('表里没列的纳米侵蚀沿用 skill_1',
    String((catalog.skills.find((s) => s.key === 'nami_qinshi') || {}).iconIndex) === 'skill_1');
ck('catalog 带 icon_atlas 块', !!(catalog.icon_atlas && catalog.icon_atlas.path === 'SkillIcon/SkillIcon'));
ck('listCastableSkills 带出 iconIndex',
    S.listCastableSkills({ mp: 999, maxMp: 800, learned: ['roubo'] })[0].iconIndex === 'skill_1');

section('19) 出招方式 range（口径 tools/skill_range_todo.md，2026-10-01 定稿）');
ck('catalog 带 range 块', !!(catalog.range && catalog.range.values && catalog.range.values.melee));
ck('range 计数 = 近身7/远程24/条件1/无2',
    JSON.stringify(catalog.range.counts) === JSON.stringify({ melee: 7, ranged: 24, dynamic: 1, none: 2 }),
    catalog.range.counts);
const byKey = new Map(catalog.skills.map((s) => [s.key, s]));
ck('roubo=melee', S.skillRangeOf(byKey.get('roubo')) === 'melee');
ck('kuangnu(格斗全体)=ranged（按用户填表，非按职业线推断）',
    S.skillRangeOf(byKey.get('kuangnu')) === 'ranged');
ck('lizijiguang=ranged', S.skillRangeOf(byKey.get('lizijiguang')) === 'ranged');
ck('jisu=dynamic + rule=gun',
    S.skillRangeOf(byKey.get('jisu')) === 'dynamic'
    && byKey.get('jisu').range_rule && byKey.get('jisu').range_rule.rule === 'gun');
ck('life_recover=none（被动不判距离）', S.skillRangeOf(byKey.get('life_recover')) === 'none');
ck('缺省/非法值兜底 ranged',
    S.skillRangeOf(null) === 'ranged' && S.skillRangeOf({ range: 'warp' }) === 'ranged');

// isRangedSkill：dynamic 按「是否持枪」求值（与普攻同一份 gun id 表）
ck('急速攻击 未持枪 → 近身', S.isRangedSkill(byKey.get('jisu'), false) === false);
ck('急速攻击 持枪 → 远程', S.isRangedSkill(byKey.get('jisu'), true) === true);
ck('近身技给枪也仍是近身', S.isRangedSkill(byKey.get('roubo'), true) === false);
ck('远程技无枪仍是远程', S.isRangedSkill(byKey.get('lizijiguang'), false) === true);
ck('被动(none) → false', S.isRangedSkill(byKey.get('life_recover'), true) === false);
// ⚠ 2026-10-01 事故回归：技能目录读不到定义（key 未命中 / 目录加载失败）时必须按普攻口径兜底，
//   否则近身技会被当成远程而原地出招。
ck('无定义 未持枪 → 近身（普攻口径）', S.isRangedSkill(null, false) === false);
ck('无定义 持枪 → 远程（普攻口径）', S.isRangedSkill(null, true) === true);
ck('无定义 undefined 同口径', S.isRangedSkill(undefined, false) === false);
ck('有定义但 range 非法 → 仍按远程（数据侧保证已登记）',
    S.isRangedSkill({ range: 'warp' }, false) === true);
const rangeList = S.listCastableSkills({ mp: 999, maxMp: 800, learned: ['roubo', 'lizijiguang', 'jisu'] });
const rangeMap = {};
for (const r of rangeList) rangeMap[r.key] = r.range;
ck('listCastableSkills 带出 range（roubo/lizijiguang/jisu）',
    rangeMap.roubo === 'melee' && rangeMap.lizijiguang === 'ranged' && rangeMap.jisu === 'dynamic',
    rangeMap);

console.log('\nSkillData 自测：通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);
