/**
 * SkillSelectPanel 挂载位置自检（Node 直接跑，不需要编译）。
 *
 * 背景（2026-09-30 实际踩到的 bug）：
 *   `SkillSelectPanel` 被误挂到了 `BattleScene` 节点上（副本）。组件内部所有查找都是
 *   **递归**的，所以那个副本一样能"找到" `SkillSelect/SkillSelect/Mask` 与 `Confirm`；
 *   于是它把 `Mask` 的点击绑到了自己的 `close()`，而它的 `this.node` 是 `BattleScene`
 *   → `close()` 执行 `node.active = false` → **点技能面板外的空白处 = 整个战斗面板被关掉**。
 *
 * 本脚本锁死两条：
 *   A. 源码里必须存在「面板根」守卫（直接子节点判定 + 拒绝执行 active 变更）；
 *   B. 场景里**处于启用状态**的 `SkillSelectPanel` 副本，必须挂在面板根节点上
 *      （直接子节点含 Mask / Confirm）。挂在父节点上的副本必须被停用或删除。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PANEL_TS = path.join(ROOT, 'assets', 'Script', 'Game', 'SkillSelectPanel.ts');
const PANEL_META = PANEL_TS + '.meta';
const SCENE = path.join(ROOT, 'assets', 'Scene', 'Game.scene');
const REQUIRED_MARKERS = ['Mask', 'Confirm'];

let pass = 0, fail = 0, skip = 0;

function ck(name, cond, extra) {
    if (cond) { pass++; return; }
    fail++;
    console.log('  ✗ ' + name + (extra === undefined ? '' : '  → ' + JSON.stringify(extra)));
}
function section(t) { console.log('\n[' + t + ']'); }
function skipped(name, why) {
    skip++;
    console.log('  – ' + name + '  SKIP（' + why + '）');
}

// ---------------------------------------------------------------------------
section('A) 源码守卫（SkillSelectPanel.ts）');
const src = fs.readFileSync(PANEL_TS, 'utf8');

ck('存在 PANEL_ROOT_MARKERS 常量', /PANEL_ROOT_MARKERS\s*=\s*\[/.test(src));
for (const m of REQUIRED_MARKERS) {
    ck('PANEL_ROOT_MARKERS 含 ' + m, new RegExp("PANEL_ROOT_MARKERS[\\s\\S]{0,200}?['\"]" + m + "['\"]").test(src));
}
ck('存在 isPanelRoot 判定', /isPanelRoot\s*\(/.test(src));
ck('判定用「直接子节点」而不是递归查找',
    /getChildByName\s*\(/.test(src) && /isPanelRoot[\s\S]{0,400}?getChildByName/.test(src));
ck('存在 ensurePanelRoot 自检', /ensurePanelRoot\s*\(\s*\)/.test(src));
ck('守卫会停用误挂的副本（enabled = false）', /this\.enabled\s*=\s*false/.test(src));

// 三个入口都要守卫：onLoad / open / close
const onLoadBlock = /onLoad\s*\([^)]*\)\s*:\s*void\s*\{([\s\S]*?)\n\s{4}\}/.exec(src);
ck('onLoad 先做面板根自检', !!onLoadBlock && /ensurePanelRoot\s*\(/.test(onLoadBlock[1]));
const openBlock = /public\s+open\s*\([\s\S]*?\n\s{4}\}/.exec(src);
ck('open() 先做面板根自检', !!openBlock && /ensurePanelRoot\s*\(/.test(openBlock[0]));
const closeBlock = /public\s+close\s*\([\s\S]*?\n\s{4}\}/.exec(src);
ck('close() 先做面板根自检（绝不让误挂副本改 active）',
    !!closeBlock && /ensurePanelRoot\s*\(/.test(closeBlock[0]));

// ---------------------------------------------------------------------------
section('B) 场景挂载（Game.scene）');
let sceneInstances = [];
try {
    const meta = JSON.parse(fs.readFileSync(PANEL_META, 'utf8'));
    // Cocos 压缩后的脚本 uuid 前 5 位与原始 uuid 的前 5 位 hex 一致 → 用它做前缀匹配
    const prefix = String(meta.uuid || '').replace(/-/g, '').slice(0, 5);
    const scene = JSON.parse(fs.readFileSync(SCENE, 'utf8'));

    const nodes = new Map();
    scene.forEach((o, i) => {
        if (o && o.__type__ === 'cc.Node') nodes.set(i, o);
    });
    const parent = new Map();
    nodes.forEach((o, i) => {
        for (const c of (o._children || [])) parent.set(c.__id__, i);
    });
    const pathOf = (i) => {
        const names = [];
        let cur = i, guard = 0;
        while (cur !== undefined && nodes.has(cur) && guard++ < 100) {
            names.push(String(nodes.get(cur)._name));
            cur = parent.get(cur);
        }
        return names.reverse().join('/');
    };

    sceneInstances = scene
        .map((o, i) => ({ o, i }))
        .filter(({ o }) => o && typeof o.__type__ === 'string' && o.__type__.startsWith(prefix));

    const onSkillSelect = sceneInstances.some(
        ({ o }) => pathOf(o.node && o.node.__id__) === 'Canvas/BattleScene/SkillSelect');

    if (sceneInstances.length === 0 || !onSkillSelect) {
        skipped('场景挂载检查', '脚本 uuid 前缀未命中 / 场景结构变了（前缀 ' + prefix + '）');
    } else {
        let enabledRootCount = 0;
        for (const { o } of sceneInstances) {
            const nid = o.node && o.node.__id__;
            const node = nid !== undefined ? nodes.get(nid) : undefined;
            const where = nid !== undefined ? pathOf(nid) : '?';
            const enabled = o._enabled !== false;
            const childNames = new Set(
                ((node && node._children) || []).map((c) => String((nodes.get(c.__id__) || {})._name)));
            const isRoot = REQUIRED_MARKERS.every((m) => childNames.has(m));
            if (isRoot && enabled) enabledRootCount++;

            if (enabled) {
                // 启用的副本必须就在面板根上，否则点遮罩会波及父节点（本次 bug 的根因）
                ck('启用的副本必须挂在面板根上：' + where, isRoot,
                    isRoot ? undefined : '直接子节点只有 [' + [...childNames].join(', ') + ']');
            } else {
                pass++;
                console.log('  · 已停用的副本（无害）：' + where);
            }
        }
        ck('面板根上有一份启用中的副本（SkillSelect）', enabledRootCount === 1,
            '实际 ' + enabledRootCount + ' 份');
    }
} catch (err) {
    fail++;
    console.log('  ✗ 场景解析失败：' + err.message);
}

console.log('\nSkillSelectPanel 挂载自检：通过 ' + pass + ' / 失败 ' + fail + (skip ? ' / 跳过 ' + skip : ''));
process.exit(fail ? 1 : 0);
