/* ============================================================
   图块工坊 Tileset Studio —— 前端
   素材切格 → 语义标注 → 镜像/翻转 → 输出新图集 + 通行表
   ============================================================ */
'use strict';

/* ---------------- 常量 ---------------- */
const TILE = 48;

const TAGS = [
  { id:'ground',   name:'地面',          color:'#4f7f5b', passable:true,  slot:'B', key:'1' },
  { id:'wall',     name:'墙面',          color:'#8e4b48', passable:false, slot:'C', key:'2' },
  { id:'road',     name:'路面',          color:'#9c8a4c', passable:true,  slot:'D', key:'3' },
  { id:'plant_p',  name:'可通行植物',    color:'#4a9a6a', passable:true,  slot:'E', key:'4' },
  { id:'plant_np', name:'不可通行物体',  color:'#8a5aaa', passable:false, slot:'E', key:'5' },
  { id:'over',     name:'树冠(★上层)',   color:'#2f7a52', passable:true,  slot:'E', key:'6', upper:true },
  { id:'none',     name:'未标 / 空',     color:'#3f434b', passable:true,  slot:null, key:'' },
];
const TAG_BY_ID = {};
TAGS.forEach(t => TAG_BY_ID[t.id] = t);

const TFS = [
  { id:'none', name:'原图',      short:'原', key:'0' },
  { id:'h',    name:'水平镜像',  short:'H',  key:'H' },
  { id:'v',    name:'垂直翻转',  short:'V',  key:'V' },
  { id:'hv',   name:'180°',      short:'B',  key:'B' },
];
const TF_BY_ID = {};
TFS.forEach(t => TF_BY_ID[t.id] = t);

const SLOTS = [
  { id:'A5', cols:8,  rows:16, label:'A5', note:'128 格 · 384×768' },
  { id:'B',  cols:16, rows:16, label:'B',  note:'256 格 · 768×768' },
  { id:'C',  cols:16, rows:16, label:'C',  note:'256 格 · 768×768' },
  { id:'D',  cols:16, rows:16, label:'D',  note:'256 格 · 768×768' },
  { id:'E',  cols:16, rows:16, label:'E',  note:'256 格 · 768×768' },
];
const SLOT_BY_ID = {};
SLOTS.forEach(s => SLOT_BY_ID[s.id] = s);
const SLOT_BASE = { A5:1536, B:0, C:256, D:512, E:768 };

/* ---------------- 状态 ---------------- */
const S = {
  roots: [], mounts: [], rpgTilesets: '', mapSrc: '',
  outDir: '', exportDir: '', toolOut: '', desktop: '',
  root: '',
  sheets: [],          // [{name,path,w,h}]
  sheet: null,         // {name,path,img,w,h,cols,rows}
  cellCache: null,     // {key, list:[canvas]}
  sel: new Set(),
  tagOf: {},           // srcIndex -> tagId
  zoom: 1,
  outZoom: 1,
  hover: -1,
  marquee: null,       // {x0,y0,x1,y1}
  shift: false,

  out: {},             // slotId -> Array(cell|null)
  outSel: new Set(),
  outHover: -1,
  curSlot: 'B',
  placeTf: 'none',

  blockMode: true,     // true = 整块贴（保持选区矩形）；false = 逐个铺
  blockFlip: 'order',  // 块变换：'order' = 整块镜像（排列也翻）；'tile' = 只翻每格
  outMode: 'brush',    // 输出区左键：brush 刷块 / select 框选 / erase 橡皮
  outBrush: null,      // 刷块拖拽中的矩形 {c0,r0,c1,r1}
  outRect: null,       // 框选拖拽中的矩形 {c0,r0,c1,r1}
  outRectAdd: false,   // 本次框选是否「加选」（Shift）
  outSelRect: null,    // 框选留下的矩形（决定「整块」的范围）；单击选格时为 null
  blkSeq: 0,           // 块编号（让「按语义分配」时同块格子整体搬运）
  lastBlk: null,       // 最近贴入的块 {c0,r0,w,h,slot}
  showBlkFrame: true,  // 输出区是否描出块边界

  proj: { path: '', name: '' },   // 当前工程包（.tsproj）；源图就是从这个包里来的时记下来
};
SLOTS.forEach(s => S.out[s.id] = new Array(s.cols * s.rows).fill(null));

/* ============================================================
   撤回 / 重做（快照式）
   只快照「数据」：5 个输出槽 + 块编号 + 最近块 + 语义标注。
   选中的格子属于视图状态，不进历史（否则每点一下就多一步，没法用）。
   ============================================================ */
const HIST = { undo: [], redo: [], max: 80 };

function snapState() {
  const out = {};
  SLOTS.forEach(s => { out[s.id] = S.out[s.id].slice(); });
  return {
    out,
    blkSeq: S.blkSeq,
    lastBlk: S.lastBlk ? { ...S.lastBlk } : null,
    tagOf: { ...S.tagOf },
    curSlot: S.curSlot,
  };
}

function restoreState(sn) {
  SLOTS.forEach(s => { S.out[s.id] = sn.out[s.id].slice(); });
  S.blkSeq = sn.blkSeq;
  S.lastBlk = sn.lastBlk ? { ...sn.lastBlk } : null;
  S.tagOf = { ...sn.tagOf };
  S.curSlot = sn.curSlot;
  clearOutSel();
  S.outRect = null;
  S.outBrush = null;
  S.outHover = -1;
  reqSrc();
  reqOut();
}

function updateHistUI() {
  const u = $('#btnUndo'), r = $('#btnRedo'), i = $('#histInfo');
  if (u) {
    u.disabled = !HIST.undo.length;
    u.title = HIST.undo.length
      ? ('撤回：' + HIST.undo[HIST.undo.length - 1].label + '（Ctrl+Z）')
      : '没有可撤回的操作';
  }
  if (r) {
    r.disabled = !HIST.redo.length;
    r.title = HIST.redo.length
      ? ('重做：' + HIST.redo[HIST.redo.length - 1].label + '（Ctrl+Y）')
      : '没有可重做的操作';
  }
  if (i) i.textContent = HIST.undo.length + (HIST.redo.length ? ' ↷' + HIST.redo.length : '') + ' 步';
}

/** 在「要修改数据之前」调用：把当前状态压进撤回栈 */
function pushHist(label) {
  HIST.undo.push({ label: label || '操作', snap: snapState() });
  if (HIST.undo.length > HIST.max) HIST.undo.shift();
  HIST.redo.length = 0;
  updateHistUI();
}

function undoStep() {
  if (!HIST.undo.length) return toast('没有可撤回的操作了', 'warn');
  const it = HIST.undo.pop();
  HIST.redo.push({ label: it.label, snap: snapState() });
  restoreState(it.snap);
  updateHistUI();
  toast('↶ 已撤回：' + it.label, 'ok');
}

function redoStep() {
  if (!HIST.redo.length) return toast('没有可重做的操作了', 'warn');
  const it = HIST.redo.pop();
  HIST.undo.push({ label: it.label, snap: snapState() });
  restoreState(it.snap);
  updateHistUI();
  toast('↷ 已重做：' + it.label, 'ok');
}

let rafSrc = 0, rafOut = 0, toSrc = 0, toOut = 0;

/* rAF 在「标签页被切到后台」时会被浏览器暂停/节流 → 状态读数会一直不刷新。
   所以每次请求同时挂一个 setTimeout 兜底，谁先到用谁，跑过就互斥清掉。 */
function fireSrcFrame() {
  if (!rafSrc && !toSrc) return;
  if (toSrc) { clearTimeout(toSrc); toSrc = 0; }
  if (rafSrc) { cancelAnimationFrame(rafSrc); rafSrc = 0; }
  renderSource(); updateSelInfo();
}
function fireOutFrame() {
  if (!rafOut && !toOut) return;
  if (toOut) { clearTimeout(toOut); toOut = 0; }
  if (rafOut) { cancelAnimationFrame(rafOut); rafOut = 0; }
  renderOutput(); updateOutMeta();
}

/* ---------------- DOM ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* ---------------- API ---------------- */
async function api(path, qs) {
  const u = path + (qs ? '?' + new URLSearchParams(qs) : '');
  const r = await fetch(u);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}
async function post(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return await r.json();
}

/* ---------------- 提示 ---------------- */
let toastTimer = 0;
function toast(msg, type) {
  const el = $('#status');
  el.textContent = msg;
  el.className = 'show ' + (type || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, type === 'err' ? 4200 : 2000);
}

/* ============================================================
   素材区
   ============================================================ */
function cellCanvasOf(idx) {
  const cache = S.cellCache;
  if (!cache) return null;
  return cache.list[idx] || null;
}
function srcRef(idx) {
  return { sheet: S.sheet.path, sheetName: S.sheet.name, index: idx };
}
function tagIdOf(idx) { return S.tagOf[idx] || 'none'; }

function ensureCellCache() {
  const key = S.sheet.path + '|' + S.sheet.w + 'x' + S.sheet.h;
  if (S.cellCache && S.cellCache.key === key) return S.cellCache;
  const list = [];
  const img = S.sheet.img;
  for (let r = 0; r < S.sheet.rows; r++) {
    for (let c = 0; c < S.sheet.cols; c++) {
      const cc = document.createElement('canvas');
      cc.width = TILE; cc.height = TILE;
      const g = cc.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(img, c * TILE, r * TILE, TILE, TILE, 0, 0, TILE, TILE);
      // 规范化：全透明像素的 RGB 归零。
      // canvas 2D 内部用预乘 alpha，导出往返时本来就会把 a=0 的 RGB 抹成 0；
      // 提前做这一步，「导出图 == 源图块」才能逐字节成立（可见像素一个都不动）。
      const id = g.getImageData(0, 0, TILE, TILE);
      const d = id.data;
      let touched = false;
      for (let k = 0; k < d.length; k += 4) {
        if (d[k + 3] === 0 && (d[k] | d[k + 1] | d[k + 2])) {
          d[k] = d[k + 1] = d[k + 2] = 0;
          touched = true;
        }
      }
      if (touched) g.putImageData(id, 0, 0);
      list.push(cc);
    }
  }
  S.cellCache = { key, list };
  return S.cellCache;
}

function isBlankCell(idx) {
  const cc = cellCanvasOf(idx);
  if (!cc) return true;
  const d = cc.getContext('2d').getImageData(0, 0, TILE, TILE).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return false;
  return true;
}

function idxAtSrc(px, py, wrap) {
  if (!S.sheet) return -1;
  const rect = $('#srcCanvas').getBoundingClientRect();
  const x = px - rect.left, y = py - rect.top;
  const c = Math.floor(x / (TILE * S.zoom));
  const r = Math.floor(y / (TILE * S.zoom));
  if (c < 0 || r < 0 || c >= S.sheet.cols || r >= S.sheet.rows) return -1;
  return r * S.sheet.cols + c;
}

function renderSource() {
  const cv = $('#srcCanvas');
  if (!S.sheet) {
    cv.width = cv.height = 1; cv.style.width = cv.style.height = '0px';
    $('#srcEmpty').style.display = 'flex';
    return;
  }
  $('#srcEmpty').style.display = 'none';
  const z = S.zoom, cols = S.sheet.cols, rows = S.sheet.rows;
  const W = cols * TILE * z, H = rows * TILE * z;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  cv.style.width = W + 'px'; cv.style.height = H + 'px';

  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, W, H);
  g.drawImage(S.sheet.img, 0, 0, cols * TILE, rows * TILE, 0, 0, W, H);

  const cs = TILE * z;

  // 语义色块（左上角小三角）
  if (z >= 1) {
    for (let i = 0; i < cols * rows; i++) {
      const tid = S.tagOf[i];
      if (!tid || tid === 'none') continue;
      const t = TAG_BY_ID[tid];
      const c = i % cols, r = Math.floor(i / cols);
      g.fillStyle = t.color;
      g.beginPath();
      g.moveTo(c * cs, r * cs);
      g.lineTo(c * cs + 11, r * cs);
      g.lineTo(c * cs, r * cs + 11);
      g.closePath();
      g.fill();
    }
  }

  // 选中
  if (S.sel.size) {
    g.fillStyle = 'rgba(76,154,255,.26)';
    g.strokeStyle = '#4c9aff'; g.lineWidth = Math.max(1, z);
    S.sel.forEach(i => {
      const c = i % cols, r = Math.floor(i / cols);
      g.fillRect(c * cs, r * cs, cs, cs);
      g.strokeRect(c * cs + .5, r * cs + .5, cs - 1, cs - 1);
    });
    // 选中序号
    const first = [...S.sel].sort((a, b) => a - b)[0];
    if (first != null && z >= 2) {
      const c = first % cols, r = Math.floor(first / cols);
      g.fillStyle = '#cfe3ff'; g.font = 'bold 11px Consolas,monospace';
      g.fillText('#' + first, c * cs + 4, r * cs + cs - 5);
    }
  }

  // 框选
  if (S.marquee) {
    const m = S.marquee;
    g.strokeStyle = '#7ab4ff'; g.lineWidth = 1;
    g.setLineDash([5, 4]);
    g.strokeRect(m.x0 * cs + .5, m.y0 * cs + .5, (m.x1 - m.x0 + 1) * cs - 1, (m.y1 - m.y0 + 1) * cs - 1);
    g.setLineDash([]);
  }

  // hover
  if (S.hover >= 0 && !S.sel.has(S.hover)) {
    const c = S.hover % cols, r = Math.floor(S.hover / cols);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1;
    g.strokeRect(c * cs + .5, r * cs + .5, cs - 1, cs - 1);
  }

  // 网格
  if (z >= 1) {
    g.strokeStyle = 'rgba(255,255,255,.11)'; g.lineWidth = 1;
    for (let c = 1; c < cols; c++) { g.beginPath(); g.moveTo(c * cs + .5, 0); g.lineTo(c * cs + .5, H); g.stroke(); }
    for (let r = 1; r < rows; r++) { g.beginPath(); g.moveTo(0, r * cs + .5); g.lineTo(W, r * cs + .5); g.stroke(); }
  }
}
function reqSrc() {
  if (rafSrc || toSrc) return;
  rafSrc = requestAnimationFrame(fireSrcFrame);
  toSrc = setTimeout(fireSrcFrame, 100);
}

/* 自适应缩放：让整张图正好放进可视区 */
function fitZoom() {
  if (!S.sheet) return;
  const wrap = $('#srcWrap');
  const W = S.sheet.cols * TILE, H = S.sheet.rows * TILE;
  const cw = (wrap.clientWidth || 820) - 6, ch = (wrap.clientHeight || 620) - 6;
  const z = Math.min(cw / W, ch / H);
  S.zoom = Math.max(0.5, Math.min(6, Math.round(z * 2) / 2));
  $('#zoomLabel').textContent = S.zoom + '×';
  reqSrc();
}
function fitOut() {
  const slot = SLOT_BY_ID[S.curSlot];
  const wrap = $('#outWrap');
  const W = slot.cols * TILE, H = slot.rows * TILE;
  const cw = (wrap.clientWidth || 820) - 6, ch = (wrap.clientHeight || 620) - 6;
  const z = Math.min(cw / W, ch / H);
  S.outZoom = Math.max(0.5, Math.min(6, Math.round(z * 2) / 2));
  reqOut();
}

function updateSelInfo() {
  if (!S.sheet) { $('#selInfo').textContent = '未加载'; return; }
  const n = S.sel.size;
  if (!n) { $('#selInfo').textContent = '未选中任何图块'; }
  else {
    const ids = [...S.sel].sort((a, b) => a - b);
    const shown = ids.slice(0, 12).join(', ');
    const counted = {};
    ids.forEach(i => { const t = tagIdOf(i); counted[t] = (counted[t] || 0) + 1; });
    const tagtxt = Object.entries(counted)
      .map(([k, v]) => (TAG_BY_ID[k] ? TAG_BY_ID[k].name : k) + '×' + v).join(' · ');
    $('#selInfo').innerHTML = '已选 <b>' + n + '</b> 格 　' + tagtxt +
      ' 　<span class="hint">[' + shown + (ids.length > 12 ? ' …' : '') + ']</span>';
  }
  // 变体预览（只在选中/模式变化时重建，避免每帧重建 DOM）
  const first = n ? [...S.sel].sort((a, b) => a - b)[0] : -1;
  const key = first + '|' + n + '|' + (S.blockMode ? 'B' : 'F') + '|' + S.placeTf;
  if (key !== lastPreviewKey) { lastPreviewKey = key; drawVariantPreview(first); }
  updateBlockInfo();
}
let lastPreviewKey = '';

/* 整块信息条 */
function updateBlockInfo() {
  const el = $('#blockInfo');
  if (!el) return;
  if (!S.sel.size) {
    el.innerHTML = '— 先在左边框选一块（或点「整张图当一块」）';
    return;
  }
  const b = selBlock();
  if (!b) { el.innerHTML = '—'; return; }
  const slot = SLOT_BY_ID[S.curSlot];
  const perRow = Math.floor(slot.cols / b.w) || 0;
  const perCol = Math.floor(slot.rows / b.h) || 0;
  const fit = perRow * perCol;
  const ok = fit >= 4;
  el.innerHTML = '当前块 <b style="color:#ffce54">' + b.w + '×' + b.h + '</b>（' + b.count + ' 格' +
    (b.holes ? '，块内 ' + b.holes + ' 个空洞' : '') + '）　' + slot.label + ' 可放 <b>' + fit + '</b> 块' +
    (ok ? '　<span style="color:var(--ok)">✓ 4 变体放得下</span>'
        : '　<span style="color:#ffd479">⚠ 4 变体放不下，挑小图 / 先清槽</span>');
}

/* ---------------- 变体预览 ---------------- */
function drawVariantPreview(idx) {
  const box = $('#variantPreview'), lab = $('#variantLabels');
  box.innerHTML = ''; lab.innerHTML = '';
  const b = (S.blockMode && S.sel.size > 1) ? selBlock() : null;
  const useBlock = !!b && b.w <= 8 && b.h <= 8;

  TFS.forEach(tf => {
    const cv = document.createElement('canvas');
    cv.className = 'vcell' + (S.placeTf === tf.id ? ' on' : '');
    const SZ = 46;
    cv.width = SZ; cv.height = SZ;
    cv.title = tf.name + (useBlock ? '　（整块 ' + b.w + '×' + b.h + '）' : '');
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (useBlock) {
      const cell = Math.max(2, Math.floor(SZ / Math.max(b.w, b.h)));
      const ox = Math.floor((SZ - cell * b.w) / 2), oy = Math.floor((SZ - cell * b.h) / 2);
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < b.w; x++) {
          const si = blockCellAt(b, tf.id, x, y);
          if (si < 0) continue;
          drawCell(g, cellCanvasOf(si), tf.id, ox + x * cell, oy + y * cell, cell);
        }
      }
    } else {
      const snap = idx >= 0 ? cellCanvasOf(idx) : null;
      if (snap) drawCell(g, snap, tf.id, 0, 0, SZ);
    }
    cv.onclick = () => { setPlaceTf(tf.id); };
    box.appendChild(cv);
    const l = document.createElement('div');
    l.className = 'vlabel';
    l.textContent = tf.short + (useBlock ? '　' + b.w + '×' + b.h : '');
    l.style.width = '64px';
    lab.appendChild(l);
  });
}

function drawCell(g, snap, tf, x, y, size) {
  if (!snap) return;
  g.save();
  g.translate(x, y);
  if (tf === 'h') { g.translate(size, 0); g.scale(-1, 1); }
  else if (tf === 'v') { g.translate(0, size); g.scale(1, -1); }
  else if (tf === 'hv') { g.translate(size, size); g.scale(-1, -1); }
  g.imageSmoothingEnabled = false;
  g.drawImage(snap, 0, 0, TILE, TILE, 0, 0, size, size);
  g.restore();
}

/* ============================================================
   输出区
   ============================================================ */
function outIdxAt(px, py) {
  const slot = SLOT_BY_ID[S.curSlot];
  const rect = $('#outCanvas').getBoundingClientRect();
  const x = px - rect.left, y = py - rect.top;
  const c = Math.floor(x / (TILE * S.outZoom));
  const r = Math.floor(y / (TILE * S.outZoom));
  if (c < 0 || r < 0 || c >= slot.cols || r >= slot.rows) return -1;
  return r * slot.cols + c;
}

function renderOutput() {
  const slot = SLOT_BY_ID[S.curSlot];
  const cv = $('#outCanvas');
  const z = S.outZoom, cs = TILE * z;
  const W = slot.cols * cs, H = slot.rows * cs;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  cv.style.width = W + 'px'; cv.style.height = H + 'px';

  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#131417'; g.fillRect(0, 0, W, H);

  const arr = S.out[S.curSlot];
  for (let i = 0; i < arr.length; i++) {
    const cell = arr[i];
    const c = i % slot.cols, r = Math.floor(i / slot.cols);
    const x = c * cs, y = r * cs;
    if (!cell) continue;
    drawCell(g, cell.snap, cell.tf, x, y, cs);
    // 变换标记
    if (cell.tf && cell.tf !== 'none') {
      g.fillStyle = 'rgba(0,0,0,.58)';
      g.fillRect(x + cs - 18, y + cs - 16, 16, 14);
      g.fillStyle = '#9fd0ff';
      g.font = 'bold 10px Consolas,monospace';
      g.fillText(TF_BY_ID[cell.tf].short, x + cs - 15, y + cs - 5);
    }
    // 语义色条
    const t = TAG_BY_ID[cell.tag];
    if (t && cell.tag !== 'none') {
      g.fillStyle = t.color;
      g.fillRect(x, y, cs, 3);
    }
  }

  // 块外框：一眼看出「这些格是一整块，没被拆散」
  if (S.showBlkFrame) {
    const seen = new Set();
    arr.forEach(c => {
      if (!c || !c.blk || seen.has(c.blk.id)) return;
      seen.add(c.blk.id);
      const B = c.blk;
      const isLast = S.lastBlk && S.lastBlk.slot === S.curSlot && S.lastBlk.id === B.id;
      g.strokeStyle = isLast ? 'rgba(255,206,84,.95)' : 'rgba(255,206,84,.40)';
      g.lineWidth = isLast ? 2 : 1;
      g.setLineDash(isLast ? [] : [4, 3]);
      g.strokeRect(B.c0 * cs + 1, B.r0 * cs + 1, B.w * cs - 2, B.h * cs - 2);
      g.setLineDash([]);
      if (isLast) {
        g.fillStyle = 'rgba(255,206,84,.92)';
        g.font = 'bold 10px Consolas,monospace';
        g.fillText('BLOCK ' + B.w + '×' + B.h, B.c0 * cs + 5, B.r0 * cs + 13);
      }
    });
  }

  // 选中
  g.strokeStyle = '#4c9aff'; g.lineWidth = 2;
  S.outSel.forEach(i => {
    const c = i % slot.cols, r = Math.floor(i / slot.cols);
    g.strokeRect(c * cs + 1, r * cs + 1, cs - 2, cs - 2);
  });
  // hover（橡皮模式画成红色警示）
  const eraser = S.outMode === 'erase';
  if (S.outHover >= 0 && !S.outSel.has(S.outHover)) {
    const c = S.outHover % slot.cols, r = Math.floor(S.outHover / slot.cols);
    g.strokeStyle = eraser ? 'rgba(255,110,110,.95)' : 'rgba(255,255,255,.6)';
    g.lineWidth = eraser ? 2 : 1;
    g.strokeRect(c * cs + (eraser ? 1.5 : .5), r * cs + (eraser ? 1.5 : .5),
      cs - (eraser ? 3 : 1), cs - (eraser ? 3 : 1));
    if (eraser) {
      g.fillStyle = 'rgba(255,80,80,.20)';
      g.fillRect(c * cs + 1, r * cs + 1, cs - 2, cs - 2);
    }
  }

  // 框选拖拽中的矩形（松手才确定）
  if (S.outRect) {
    const R0 = S.outRect;
    const cc0 = Math.min(R0.c0, R0.c1), cc1 = Math.max(R0.c0, R0.c1);
    const rr0 = Math.min(R0.r0, R0.r1), rr1 = Math.max(R0.r0, R0.r1);
    const w = cc1 - cc0 + 1, h = rr1 - rr0 + 1;
    g.fillStyle = 'rgba(122,180,255,.16)';
    g.fillRect(cc0 * cs, rr0 * cs, w * cs, h * cs);
    g.strokeStyle = '#7ab4ff'; g.lineWidth = 2;
    g.setLineDash([6, 4]);
    g.strokeRect(cc0 * cs + 1, rr0 * cs + 1, w * cs - 2, h * cs - 2);
    g.setLineDash([]);
    g.fillStyle = 'rgba(0,0,0,.72)';
    const tag = w + '×' + h;
    g.font = 'bold 11px Consolas,monospace';
    const tw = g.measureText(tag).width + 10;
    g.fillRect(cc0 * cs + 2, rr0 * cs + 2, tw, 16);
    g.fillStyle = '#9fd0ff';
    g.fillText(tag, cc0 * cs + 7, rr0 * cs + 14);
  }

  // 刷块拖拽预览：所见即所得（半透明预演 + 虚线框 + 平铺次数）
  if (S.outBrush) {
    const br = S.outBrush;
    const cc0 = Math.min(br.c0, br.c1), cc1 = Math.max(br.c0, br.c1);
    const rr0 = Math.min(br.r0, br.r1), rr1 = Math.max(br.r0, br.r1);
    const spanW = cc1 - cc0 + 1, spanH = rr1 - rr0 + 1;
    const b = selBlock();
    if (b) {
      g.globalAlpha = 0.62;
      for (let y = 0; y < spanH; y++) {
        for (let x = 0; x < spanW; x++) {
          const srcIdx = blockCellAt(b, S.placeTf, x, y);
          if (srcIdx < 0) continue;
          const px = (cc0 + x) * cs, py = (rr0 + y) * cs;
          if (px < 0 || py < 0 || px + cs > W || py + cs > H) continue;
          drawCell(g, cellCanvasOf(srcIdx), S.placeTf, px, py, cs);
        }
      }
      g.globalAlpha = 1;
    }
    g.strokeStyle = '#7ab4ff'; g.lineWidth = 2;
    g.setLineDash([6, 4]);
    g.strokeRect(cc0 * cs + 1, rr0 * cs + 1, spanW * cs - 2, spanH * cs - 2);
    g.setLineDash([]);
    if (b) {
      const tx = Math.ceil(spanW / b.w), ty = Math.ceil(spanH / b.h);
      const tag = (tx > 1 || ty > 1) ? ('整块 ' + b.w + '×' + b.h + ' 平铺 ' + tx + '×' + ty)
                                     : ('整块 ' + b.w + '×' + b.h);
      g.fillStyle = 'rgba(0,0,0,.72)';
      const tw = g.measureText(tag).width + 10;
      g.fillRect(cc0 * cs + 2, rr0 * cs + 2, tw + 12, 16);
      g.fillStyle = '#9fd0ff'; g.font = 'bold 11px Consolas,monospace';
      g.fillText(tag, cc0 * cs + 8, rr0 * cs + 14);
    }
  }

  // 网格
  if (z >= 1) {
    g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 1;
    for (let c = 1; c < slot.cols; c++) { g.beginPath(); g.moveTo(c * cs + .5, 0); g.lineTo(c * cs + .5, H); g.stroke(); }
    for (let r = 1; r < slot.rows; r++) { g.beginPath(); g.moveTo(0, r * cs + .5); g.lineTo(W, r * cs + .5); g.stroke(); }
  }
}
function reqOut() {
  if (rafOut || toOut) return;
  rafOut = requestAnimationFrame(fireOutFrame);
  toOut = setTimeout(fireOutFrame, 100);
}

function updateOutMeta() {
  const slot = SLOT_BY_ID[S.curSlot];
  const arr = S.out[S.curSlot];
  const used = arr.filter(Boolean).length;
  $('#outMeta').textContent = used + ' / ' + arr.length + ' 格';
  $('#slotMeta').textContent = slot.note + (used === arr.length ? ' · 已满' : '');
  buildSlotTabs();
  updateStats();
  updateBlockInfo();
  updateOutSelInfo();
}

function buildSlotTabs() {
  const box = $('#slotTabs');
  box.innerHTML = '';
  SLOTS.forEach(s => {
    const arr = S.out[s.id];
    const used = arr.filter(Boolean).length;
    const d = document.createElement('div');
    d.className = 'slot-tab' + (S.curSlot === s.id ? ' on' : '');
    d.innerHTML = s.label + '<span class="cnt' + (used === arr.length ? ' full' : '') + '">' +
      used + '/' + arr.length + '</span>' + (used ? '<i class="stamp">•</i>' : '');
    d.onclick = () => { S.curSlot = s.id; S.outSel.clear(); S.outSelRect = null; S.outHover = -1; reqOut(); fitOut(); };
    box.appendChild(d);
  });
}

function updateStats() {
  const cnt = {};
  let total = 0;
  SLOTS.forEach(s => S.out[s.id].forEach(c => {
    if (!c) return;
    total++;
    cnt[c.tag] = (cnt[c.tag] || 0) + 1;
  }));
  let srcSel = 0;
  Object.keys(S.tagOf).forEach(k => { if (S.tagOf[k] && S.tagOf[k] !== 'none') srcSel++; });

  const lines = [];
  lines.push('素材已标注：<b>' + srcSel + '</b> 格');
  lines.push('输出总计：<b>' + total + '</b> 格');
  const parts = TAGS.filter(t => cnt[t.id]).map(t =>
    '<span style="color:' + t.color + '">■</span> ' + t.name + ' ' + cnt[t.id]);
  if (parts.length) lines.push(parts.join('　'));
  $('#statsBox').innerHTML = lines.join('<br>');
}

/* ============================================================
   放置 / 变换
   ============================================================ */

/* ---- 变换群：h / v / hv 就是「水平位, 垂直位」两个开关，叠加 = 异或 ---- */
function tfBits(tf) {
  return { fx: (tf === 'h' || tf === 'hv') ? 1 : 0, fy: (tf === 'v' || tf === 'hv') ? 1 : 0 };
}
function bitsToTf(fx, fy) { return (fx && fy) ? 'hv' : (fx ? 'h' : (fy ? 'v' : 'none')); }
/** 在已有翻法 base 之上再翻一次 extra：h 再 h 会转回原图（这才是「镜像」该有的行为） */
function tfOverlay(base, extra) {
  const a = tfBits(base || 'none'), b = tfBits(extra || 'none');
  return bitsToTf(a.fx ^ b.fx, a.fy ^ b.fy);
}
/** 点「原图」= 强制清除翻法；点 H/V/B = 叠加 */
function applyTf(base, tf) {
  if (!tf || tf === 'none') return 'none';
  return tfOverlay(base, tf);
}

/**
 * 当前输出选区的「整块」矩形。
 * 框选留下的矩形优先（这样框了 3×2 但里面只有 1 格有内容，也仍按 3×2 当一块）；
 * 否则退回「选中格子的外接矩形」（单击选格 / 双击选整块走这条）。
 */
function selRectOut() {
  if (!S.outSel.size) return null;
  if (S.outSelRect) return { ...S.outSelRect };
  const slot = SLOT_BY_ID[S.curSlot];
  let c0 = Infinity, r0 = Infinity, c1 = -1, r1 = -1;
  S.outSel.forEach(i => {
    const c = i % slot.cols, r = (i / slot.cols) | 0;
    if (c < c0) c0 = c; if (c > c1) c1 = c;
    if (r < r0) r0 = r; if (r > r1) r1 = r;
  });
  return { c0, r0, w: c1 - c0 + 1, h: r1 - r0 + 1 };
}

/** 清空输出选区（连框选矩形一起清，免得残留的矩形把「单格」误判成「一块」） */
function clearOutSel() { S.outSel.clear(); S.outSelRect = null; }

function newCell(srcIdx, tf, blk) {
  return {
    snap: cellCanvasOf(srcIdx),
    src: srcRef(srcIdx),
    tf: tf || 'none',
    tag: tagIdOf(srcIdx),
    blk: blk || null                     // {id,c0,r0,w,h} —— 记录它在「块」里的相对位置
  };
}

function pushCell(cell) {
  const arr = S.out[S.curSlot];
  const i = arr.indexOf(null);
  if (i < 0) return -1;
  arr[i] = cell;
  return i;
}

/* ============================================================
   整块贴（Block） —— 像 RPG Maker 一样保持选区原样
   「块」= 源选区的外接矩形；块内没被选中的格子记为空洞（跳过不写）。
   ============================================================ */

/** 取当前源选区的块；返回 {c0,r0,w,h,cells:[[srcIdx|-1]]}，无选区返回 null */
function selBlock() {
  if (!S.sheet || !S.sel.size) return null;
  const cols = S.sheet.cols;
  let c0 = Infinity, r0 = Infinity, c1 = -1, r1 = -1;
  S.sel.forEach(i => {
    const c = i % cols, r = (i / cols) | 0;
    if (c < c0) c0 = c; if (c > c1) c1 = c;
    if (r < r0) r0 = r; if (r > r1) r1 = r;
  });
  const w = c1 - c0 + 1, h = r1 - r0 + 1;
  const cells = [];
  let holes = 0;
  for (let r = 0; r < h; r++) {
    const row = [];
    for (let c = 0; c < w; c++) {
      const i = (r0 + r) * cols + (c0 + c);
      const on = S.sel.has(i) ? i : -1;
      if (on < 0) holes++;
      row.push(on);
    }
    cells.push(row);
  }
  return { c0, r0, w, h, cells, holes, count: S.sel.size };
}

/** 矩形 (c0,r0,w,h) 在槽内是否全空 */
function rectFree(arr, slot, c0, r0, w, h) {
  if (c0 < 0 || r0 < 0 || c0 + w > slot.cols || r0 + h > slot.rows) return false;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (arr[(r0 + y) * slot.cols + (c0 + x)]) return false;
  return true;
}

/** 从左上起找第一块 w×h 的空矩形；找不到返回 null */
function findFreeRect(arr, slot, w, h) {
  if (w > slot.cols || h > slot.rows) return null;
  for (let r = 0; r + h <= slot.rows; r++)
    for (let c = 0; c + w <= slot.cols; c++)
      if (rectFree(arr, slot, c, r, w, h)) return { c0: c, r0: r };
  return null;
}

/** 按块尺寸切网格，列出 n 个可用的块位（块之间严格对齐，不挤位） */
function layoutBlocks(arr, slot, bw, bh, n) {
  const perRow = Math.max(1, Math.floor(slot.cols / bw));
  const out = [];
  for (let r = 0; r + bh <= slot.rows && out.length < n; r += bh) {
    for (let k = 0; k < perRow && out.length < n; k++) {
      const c = k * bw;
      if (rectFree(arr, slot, c, r, bw, bh)) out.push({ c0: c, r0: r });
    }
  }
  return out;
}

/**
 * 块内 (x,y) 偏移处该取源块的哪一格、用什么变换。
 * blockFlip='order' → 连格子排布一起翻：出来的是「整块地图的镜像」（h/v/hv 都成立）
 * blockFlip='tile'  → 只翻每一格本身，排布保持原样
 */
function blockCellAt(block, tf, x, y) {
  let sx = x % block.w, sy = y % block.h;
  if (S.blockFlip === 'order' && tf && tf !== 'none') {
    if (tf === 'h' || tf === 'hv') sx = block.w - 1 - sx;
    if (tf === 'v' || tf === 'hv') sy = block.h - 1 - sy;
  }
  return block.cells[sy][sx];
}

/**
 * 把块盖到槽的 (dc0,dr0)，区域大小 spanW×spanH（>块尺寸时按块平铺重复，== RM 手感）。
 * 返回 {placed, out, cleared, blkId}
 */
function stampBlock(arr, slot, dc0, dr0, block, tf, spanW, spanH) {
  const w = spanW || block.w, h = spanH || block.h;
  const blkId = ++S.blkSeq;
  const blk = { id: blkId, c0: dc0, r0: dr0, w, h };
  let placed = 0, out = 0, cleared = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cc = dc0 + x, rr = dr0 + y;
      if (cc < 0 || rr < 0 || cc >= slot.cols || rr >= slot.rows) { out++; continue; }
      const srcIdx = blockCellAt(block, tf, x, y);
      const i = rr * slot.cols + cc;
      if (srcIdx < 0) { continue; }        // 块内空洞 → 保持原样不动
      if (arr[i]) cleared++;
      arr[i] = newCell(srcIdx, tf, blk);
      placed++;
    }
  }
  S.lastBlk = { c0: dc0, r0: dr0, w, h, slot: S.curSlot, id: blkId };
  return { placed, out, cleared, blkId };
}

/** 落地一次刷块（鼠标拖完松手 / 自测直接调用 commitBrush(c0,r0,c1,r1)） */
function commitBrush(c0, r0, c1, r1) {
  const br = (c0 !== undefined) ? { c0, r0, c1, r1 } : S.outBrush;
  S.outBrush = null;
  reqOut();
  if (!br) return null;
  const b = selBlock();
  if (!b) { toast('先在左边框选一块', 'warn'); return null; }
  const slot = SLOT_BY_ID[S.curSlot];
  const arr = S.out[S.curSlot];
  const cc0 = Math.min(br.c0, br.c1), cc1 = Math.max(br.c0, br.c1);
  const rr0 = Math.min(br.r0, br.r1), rr1 = Math.max(br.r0, br.r1);
  const spanW = cc1 - cc0 + 1, spanH = rr1 - rr0 + 1;
  pushHist('刷块 ' + spanW + '×' + spanH);
  const r = stampBlock(arr, slot, cc0, rr0, b, S.placeTf, spanW, spanH);
  reqOut();
  const rep = (spanW !== b.w || spanH !== b.h)
    ? '（' + b.w + '×' + b.h + ' 平铺 → ' + spanW + '×' + spanH + '）' : '';
  toast('整块贴入 ' + spanW + '×' + spanH + ' = ' + r.placed + ' 格' + rep +
    (r.cleared ? '，覆盖了 ' + r.cleared + ' 格' : ''), 'ok');
  return r;
}

function setPlaceTf(tf) {
  S.placeTf = tf;
  $('#placeTf').value = tf;
  drawVariantPreview(S.sel.size ? [...S.sel].sort((a, b) => a - b)[0] : -1);
}

function doPlace() {
  if (!S.sel.size) return toast('先在左边选中图块', 'warn');
  const slot = SLOT_BY_ID[S.curSlot];
  const arr = S.out[S.curSlot];

  /* ---- 整块贴：保持选区矩形原样，找一块空地整块落下去 ---- */
  if (S.blockMode) {
    const b = selBlock();
    if (!b) return toast('先在左边选中图块', 'warn');
    const pos = findFreeRect(arr, slot, b.w, b.h);
    if (!pos) {
      return toast('当前槽放不下 ' + b.w + '×' + b.h + ' 的整块了（' + slot.label + ' 是 ' +
        slot.cols + '×' + slot.rows + '）—— 换个槽 / 清空本槽 / 或切成「逐个铺」', 'warn');
    }
    pushHist('整块贴入 ' + slot.label);
    const r = stampBlock(arr, slot, pos.c0, pos.r0, b, S.placeTf, b.w, b.h);
    reqOut();
    return toast('已整块贴入 ' + slot.label + ' @ 列' + pos.c0 + ' 行' + pos.r0 + '　' +
      b.w + '×' + b.h + ' = ' + r.placed + ' 格' +
      (r.cleared ? '（覆盖了 ' + r.cleared + ' 格）' : ''), 'ok');
  }

  /* ---- 逐个铺：每个格子依次填进空位 ---- */
  const ids = [...S.sel].sort((a, b) => a - b);
  const firstFree = arr.indexOf(null);
  if (firstFree < 0) return toast('当前槽已经满了', 'warn');
  pushHist('逐个铺入 ' + slot.label);
  let n = 0, i = -1;
  for (const idx of ids) {
    i = pushCell(newCell(idx, S.placeTf));
    if (i < 0) break;
    n++;
  }
  reqOut();
  toast(i < 0 ? ('槽位已满，只放进去 ' + n + ' 个 —— 换个槽或清空') : ('已放入 ' + n + ' 个图块'),
    i < 0 ? 'warn' : 'ok');
}

function doVariants(mode) {
  if (!S.sel.size) return toast('先在左边选中图块', 'warn');
  const slot = SLOT_BY_ID[S.curSlot];
  const arr = S.out[S.curSlot];
  const tfs = mode === 'h' ? ['none', 'h'] : ['none', 'h', 'v', 'hv'];

  /* ---- 整块模式：每个变体都是一整块，块与块按网格对齐排布 ---- */
  if (S.blockMode) {
    const b = selBlock();
    if (!b) return toast('先在左边选中图块', 'warn');
    const spots = layoutBlocks(arr, slot, b.w, b.h, tfs.length);
    if (!spots.length) {
      return toast('当前槽放不下 ' + b.w + '×' + b.h + ' 的块（' + slot.label + ' 是 ' +
        slot.cols + '×' + slot.rows + '）—— 换个更大的槽或清空本槽', 'warn');
    }
    pushHist('一变' + tfs.length + '（块形）');
    let cells = 0;
    let used = 0;
    tfs.forEach((tf, k) => {
      if (k >= spots.length) return;
      const r = stampBlock(arr, slot, spots[k].c0, spots[k].r0, b, tf, b.w, b.h);
      cells += r.placed; used++;
    });
    reqOut();
    if (used < tfs.length) {
      toast('只放下了 ' + used + ' / ' + tfs.length + ' 个变体（槽不够大）—— 已放的形状是完整的', 'warn');
    } else {
      toast('已生成 ' + used + ' 块 × ' + (b.w + '×' + b.h) + ' = ' + cells + ' 格，块形完整', 'ok');
    }
    return;
  }

  /* ---- 逐个铺：一格格照顺序排 ---- */
  const ids = [...S.sel].sort((a, b) => a - b);
  pushHist('一变' + tfs.length + '（逐个）');
  let placed = 0, overflow = 0;
  for (const idx of ids) {
    for (const tf of tfs) {
      if (pushCell(newCell(idx, tf)) < 0) { overflow++; continue; }
      placed++;
    }
  }
  reqOut();
  if (overflow === 0) {
    toast('已生成 ' + placed + ' 个图块（' + ids.length + ' 个源图 × ' + tfs.length + ' 种变换）', 'ok');
  } else {
    toast('放了 ' + placed + ' 个，还有 ' + overflow + ' 个没地方放 —— 当前槽装不下，试试别的槽', 'warn');
  }
}

/** 当前槽里与 refCell 同属一块的所有格索引 */
function blockCellsOf(refCell) {
  if (!refCell || !refCell.blk) return [];
  const arr = S.out[S.curSlot];
  const out = [];
  const id = refCell.blk.id;
  arr.forEach((c, i) => { if (c && c.blk && c.blk.id === id) out.push(i); });
  return out;
}

/** 选中整个块（双击 / 按钮） */
function selectWholeBlock(refCell) {
  const ids = blockCellsOf(refCell);
  if (!ids.length) return false;
  clearOutSel();
  ids.forEach(i => S.outSel.add(i));
  return true;
}

/** 框选落定：把矩形内有内容的格子加进选区（Shift 为加选） */
function applyOutRect() {
  const R0 = S.outRect;
  S.outRect = null;
  if (!R0) return;
  const slot = SLOT_BY_ID[S.curSlot];
  const arr = S.out[S.curSlot];
  const c0 = Math.min(R0.c0, R0.c1), c1 = Math.max(R0.c0, R0.c1);
  const r0 = Math.min(R0.r0, R0.r1), r1 = Math.max(R0.r0, R0.r1);
  const w = c1 - c0 + 1, h = r1 - r0 + 1;
  if (!S.outRectAdd) clearOutSel();
  let n = 0;
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      const i = r * slot.cols + c;
      if (arr[i]) { S.outSel.add(i); n++; }
    }
  // 只选中 1 格时清掉矩形，避免「点一下却变成 1×1 框选」
  S.outSelRect = (n === 1 && w === 1 && h === 1) ? null : { c0, r0, w, h };
  reqOut();
  if (!n) return toast('这个区域里没有图块', 'warn');
  toast('已选中 ' + n + ' 格' + (w > 1 || h > 1 ? '（' + w + '×' + h + ' 区域）' : '') +
    '　→　' + (w === 1 && h === 1 ? 'H/V/B 只翻这一格'
      : S.blockFlip === 'tile' ? 'H/V/B 只翻每格（位置不动）'
                               : 'H/V/B 会整块镜像（格子会左右/上下换位）'), 'ok');
}

/** ⑤ 区的选区提示：让用户随时知道「这次是按单格还是按整块」 */
function updateOutSelInfo() {
  const el = $('#outSelInfo');
  if (!el) return;
  if (!S.outSel.size) {
    el.textContent = '未选中输出格 — 单击选 1 格 · 拖动框选一块 · 双击选整块';
    el.style.color = 'var(--dim)';
    return;
  }
  const R = selRectOut();
  const single = R.w === 1 && R.h === 1;
  const tileMode = !single && S.blockFlip === 'tile';
  el.innerHTML = '已选中 <b>' + S.outSel.size + '</b> 格 · ' +
    (single ? '单格' : R.w + '×' + R.h + ' 一块') + '　→　H/V/B ' +
    (single ? '只翻这一格'
      : tileMode ? '<b>只翻每格</b>（位置不动）'
                 : '<b>整块镜像</b>（格子换位 + 每格翻）');
  el.style.color = single ? 'var(--tx)' : '#ffce54';
}

/**
 * 对当前槽的选中格应用变换。
 * 口径（用户拍板）：
 *   · 选中【单格】        → 只翻这一格
 *   · 选中【多格 / 一块】 → 按选区外接矩形【整块镜像】：位置重排 + 每格内容一起翻
 *   · 开关切到「只翻每格」 → 强制走单格路径（做独立图块集时用）
 * 变换是【叠加】不是覆盖：H 再 H 会转回原图；点「原图」才强制清除。
 */
function transformOut(tf) {
  const arr = S.out[S.curSlot];
  const slot = SLOT_BY_ID[S.curSlot];

  /* ---- 没有手动选中 → 优先作用到「最近贴入的整块」 ---- */
  if (!S.outSel.size) {
    if (S.lastBlk && S.lastBlk.slot === S.curSlot) {
      const ref = arr.find(c => c && c.blk && c.blk.id === S.lastBlk.id);
      const ids = blockCellsOf(ref);
      if (ids.length) {
        pushHist('变换→' + TF_BY_ID[tf].name);
        ids.forEach(i => { arr[i] = { ...arr[i], tf: applyTf(arr[i].tf, tf) }; });
        reqOut();
        return toast('已对最近贴入的整块（' + ids.length + ' 格）应用：' + TF_BY_ID[tf].name, 'ok');
      }
    }
    setPlaceTf(tf);
    return toast('未选中输出格，已把「放置变换」设为 ' + TF_BY_ID[tf].name, 'ok');
  }

  const R = selRectOut();
  const single = (R.w === 1 && R.h === 1);   // 只有「一格」才单翻，其余一律整块
  const tileOnly = single || S.blockFlip === 'tile';

  /* ---- 单格 / 只翻每格：位置不动，只翻内容 ---- */
  if (tileOnly) {
    pushHist('变换→' + TF_BY_ID[tf].name);
    S.outSel.forEach(i => { if (arr[i]) arr[i] = { ...arr[i], tf: applyTf(arr[i].tf, tf) }; });
    reqOut();
    return toast('已对 ' + S.outSel.size + ' 个图块' + (single ? '（单格）' : '（只翻每格）') +
      '应用：' + TF_BY_ID[tf].name, 'ok');
  }

  /* ---- 整块镜像：在选区外接矩形内，把格子整体翻过去 ---- */
  pushHist('整块镜像→' + TF_BY_ID[tf].name);
  const src = [];
  for (let y = 0; y < R.h; y++) {
    const row = [];
    for (let x = 0; x < R.w; x++) row.push(arr[(R.r0 + y) * slot.cols + (R.c0 + x)] || null);
    src.push(row);
  }
  // 选区跨了多个块 → 重排后形状已经分不清了，统一合成一块，免得黄框骗人
  const bids = new Set();
  src.forEach(row => row.forEach(c => { if (c && c.blk) bids.add(c.blk.id); }));
  const rebrand = bids.size >= 2;
  const nblk = rebrand ? { id: ++S.blkSeq, c0: R.c0, r0: R.r0, w: R.w, h: R.h } : null;

  const bits = tfBits(tf);
  let moved = 0;
  for (let y = 0; y < R.h; y++) {
    for (let x = 0; x < R.w; x++) {
      const sx = bits.fx ? R.w - 1 - x : x;
      const sy = bits.fy ? R.h - 1 - y : y;
      const c = src[sy][sx];
      const ni = (R.r0 + y) * slot.cols + (R.c0 + x);
      if (!c) { arr[ni] = null; continue; }
      arr[ni] = { ...c, tf: applyTf(c.tf, tf), blk: rebrand ? nblk : c.blk };
      moved++;
    }
  }
  if (rebrand && nblk) S.lastBlk = { ...nblk, slot: S.curSlot };

  /* 几何回算：被这次矩形变换碰到的块，外框按「它自己的格子现在在哪」重求一遍。
     不改的话：选区比块大时块会「搬家」，而 blk.c0/r0 还留在原地 →
     黄框画在空地上，用户以为「块被翻没了 / 翻得跟原来不一样」（2026-10-01 修的 bug）。 */
  const movedBlk = [];
  bids.forEach(id => {
    let c0 = Infinity, r0 = Infinity, c1 = -1, r1 = -1;
    arr.forEach((c, i) => {
      if (!c || !c.blk || c.blk.id !== id) return;
      const cc = i % slot.cols, rr = Math.floor(i / slot.cols);
      if (cc < c0) c0 = cc; if (cc > c1) c1 = cc;
      if (rr < r0) r0 = rr; if (rr > r1) r1 = rr;
    });
    if (c1 < 0) return;                                   // 这个块整个翻没了
    const old = (src.flat().find(x => x && x.blk && x.blk.id === id) || {}).blk;
    if (old && old.c0 === c0 && old.r0 === r0 && old.w === c1 - c0 + 1 && old.h === r1 - r0 + 1) return;
    const geo = { c0, r0, w: c1 - c0 + 1, h: r1 - r0 + 1 };
    arr.forEach(c => { if (c && c.blk && c.blk.id === id) c.blk = { ...c.blk, ...geo }; });
    if (S.lastBlk && S.lastBlk.id === id) S.lastBlk = { ...S.lastBlk, ...geo };
    if (old) movedBlk.push('列' + old.c0 + '行' + old.r0 + ' → 列' + c0 + '行' + r0);
  });

  clearOutSel();
  for (let y = 0; y < R.h; y++)
    for (let x = 0; x < R.w; x++) {
      const i = (R.r0 + y) * slot.cols + (R.c0 + x);
      if (arr[i]) S.outSel.add(i);
    }
  reqOut();
  const bt = tfBits(tf);
  const dir = (bt.fx && bt.fy) ? '左右 + 上下都换位、每格也翻'
    : bt.fx ? '左右换位、每格也翻' : '上下换位、每格也翻';
  toast('已整块镜像 ' + R.w + '×' + R.h + '（' + moved + ' 格）：' + TF_BY_ID[tf].name + '　·　' + dir +
    (rebrand ? '　·　跨块 → 已合成一块' : '') +
    (movedBlk.length ? '　·　块搬家：' + movedBlk.join('，') : ''), 'ok');
}

function duplicateOut() {
  if (!S.outSel.size) return toast('先在右边选中要复制的图块', 'warn');
  const slot = SLOT_BY_ID[S.curSlot];
  const arr = S.out[S.curSlot];
  const ids = [...S.outSel].sort((a, b) => a - b);

  // 整块模式：把选中的整块搬一份到空位（保持形状）
  if (S.blockMode) {
    let c0 = Infinity, r0 = Infinity, c1 = -1, r1 = -1;
    ids.forEach(i => {
      const c = i % slot.cols, r = (i / slot.cols) | 0;
      if (c < c0) c0 = c; if (c > c1) c1 = c;
      if (r < r0) r0 = r; if (r > r1) r1 = r;
    });
    const w = c1 - c0 + 1, h = r1 - r0 + 1;
    const src = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        const i = (r0 + y) * slot.cols + (c0 + x);
        row.push(arr[i] ? { cell: arr[i], on: true } : { on: false });
      }
      src.push(row);
    }
    const pos = findFreeRect(arr, slot, w, h);
    if (!pos) return toast('当前槽没有 ' + w + '×' + h + ' 的空位可复制了', 'warn');
    pushHist('整块复制 ' + w + '×' + h);
    const blk = { id: ++S.blkSeq, c0: pos.c0, r0: pos.r0, w, h };
    let n = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const s0 = src[y][x];
        if (!s0.on) continue;
        arr[(pos.r0 + y) * slot.cols + (pos.c0 + x)] = { ...s0.cell, blk };
        n++;
      }
    S.lastBlk = { c0: pos.c0, r0: pos.r0, w, h, slot: S.curSlot, id: blk.id };
    reqOut();
    return toast('已整块复制 ' + w + '×' + h + '（' + n + ' 格）→ 列' + pos.c0 + ' 行' + pos.r0, 'ok');
  }

  let n = 0;
  pushHist('复制 ' + S.outSel.size + ' 格');
  for (const i of ids) {
    const c = arr[i];
    if (!c) continue;
    if (pushCell({ ...c }) < 0) break;
    n++;
  }
  reqOut();
  toast('已复制 ' + n + ' 份', n ? 'ok' : 'warn');
}

function deleteOut() {
  if (!S.outSel.size) return toast('先在右边选中要删除的图块', 'warn');
  const arr = S.out[S.curSlot];
  const n = S.outSel.size;
  pushHist('删除 ' + n + ' 格');
  S.outSel.forEach(i => { arr[i] = null; });
  clearOutSel();
  reqOut();
  toast('已删除 ' + n + ' 格', 'ok');
}

/** 橡皮：擦单格 */
function eraseOne(i) {
  const arr = S.out[S.curSlot];
  if (!arr[i]) return 0;
  arr[i] = null;
  return 1;
}

/**
 * 橡皮：擦掉该格所属的整块；不属于任何块时只擦这一格。
 * ref 既可以是格子索引，也可以是 cell 对象 —— 鼠标链路里 mousedown 已经把这一格擦掉了，
 * 所以 mouseup 时传的是擦之前抓下来的 cell 引用（它照样能顺着 blk.id 找回整块）。
 */
function eraseBlockAt(ref, singleOnly) {
  const arr = S.out[S.curSlot];
  const byIdx = (typeof ref === 'number');
  const cell = byIdx ? arr[ref] : ref;
  if (!cell) return 0;
  if (!singleOnly && cell.blk) {
    const ids = blockCellsOf(cell);
    ids.forEach(k => { arr[k] = null; });
    return ids.length;
  }
  if (byIdx) { arr[ref] = null; return 1; }
  for (let k = 0; k < arr.length; k++) {
    if (arr[k] === cell) { arr[k] = null; return 1; }
  }
  return 0;
}

function compactOut() {
  const arr = S.out[S.curSlot];
  const keep = arr.filter(Boolean);
  if (!keep.length) return toast('当前槽是空的', 'warn');
  pushHist('整理空位');
  for (let i = 0; i < arr.length; i++) arr[i] = keep[i] || null;
  // 左对齐会挤散块 → 清掉块标记，免得画面上的黄框骗人
  arr.forEach(c => { if (c) delete c.blk; });
  S.lastBlk = null;
  clearOutSel();
  reqOut();
  toast('已整理：' + keep.length + ' 个图块左对齐连续排列（块标记已清除）', 'ok');
}

function assignByTag() {
  // 1) 把输出区里的格子按「块」分组（没有块标记的各自成组）
  const groups = new Map();
  SLOTS.forEach((s, k) => {
    S.out[s.id].forEach((cell, i) => {
      if (!cell) return;
      const gid = (cell.blk && cell.blk.id) ? ('B' + cell.blk.id) : ('S' + s.id + '_' + i);
      let g = groups.get(gid);
      if (!g) { g = { gid, order: k, cells: [] }; groups.set(gid, g); }
      g.cells.push({ cell, c: i % s.cols, r: (i / s.cols) | 0 });
    });
  });
  if (!groups.size) return toast('输出区是空的', 'warn');
  pushHist('按语义分配槽位');

  const list = [...groups.values()].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    const A = a.cells[0], B = b.cells[0];
    return (A.r - B.r) || (A.c - B.c);
  });

  // 2) 清空后按块整体重放
  SLOTS.forEach(s => S.out[s.id] = new Array(s.cols * s.rows).fill(null));
  S.blkSeq = 0;

  const stat = {};
  let dropped = 0, droppedBlocks = 0, movedBlocks = 0, mixed = 0;

  for (const g of list) {
    let c0 = Infinity, r0 = Infinity, c1 = -1, r1 = -1;
    g.cells.forEach(x => {
      if (x.c < c0) c0 = x.c; if (x.c > c1) c1 = x.c;
      if (x.r < r0) r0 = x.r; if (x.r > r1) r1 = x.r;
    });
    const w = c1 - c0 + 1, h = r1 - r0 + 1;

    // 目标槽：块内语义一致就按语义；混合语义的块**不拆**，整体进 B
    const slotsOf = new Set(g.cells.map(x => (TAG_BY_ID[x.cell.tag] || TAG_BY_ID.none).slot || 'B'));
    let toSlot;
    if (slotsOf.size === 1) toSlot = [...slotsOf][0];
    else { toSlot = 'B'; mixed++; }

    const slot = SLOT_BY_ID[toSlot];
    const arr = S.out[toSlot];
    const pos = findFreeRect(arr, slot, w, h);
    if (!pos) { dropped += g.cells.length; droppedBlocks++; continue; }

    const single = g.cells.length === 1;
    const blk = single ? null : { id: ++S.blkSeq, c0: pos.c0, r0: pos.r0, w, h };
    if (!single) movedBlocks++;

    g.cells.forEach(x => {
      const ni = (pos.r0 + (x.r - r0)) * slot.cols + (pos.c0 + (x.c - c0));
      arr[ni] = { ...x.cell, blk };
      stat[toSlot] = (stat[toSlot] || 0) + 1;
    });
  }

  clearOutSel();
  reqOut();
  const txt = Object.entries(stat).map(([k, v]) => k + ':' + v).join('  ');
  toast('按语义分配完成 → ' + txt +
    (movedBlocks ? '　（' + movedBlocks + ' 块整体搬，形状没散）' : '') +
    (mixed ? '　（' + mixed + ' 个混语义块整体进了 B）' : '') +
    (dropped ? '　⚠ ' + dropped + ' 格（' + droppedBlocks + ' 块）装不下' : ''),
    dropped ? 'warn' : 'ok');
}

/* ============================================================
   导出
   ============================================================ */
function slotToCanvas(slotId) {
  const slot = SLOT_BY_ID[slotId];
  const cv = document.createElement('canvas');
  cv.width = slot.cols * TILE; cv.height = slot.rows * TILE;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const arr = S.out[slotId];
  for (let i = 0; i < arr.length; i++) {
    const c = arr[i]; if (!c) continue;
    drawCell(g, c.snap, c.tf, (i % slot.cols) * TILE, Math.floor(i / slot.cols) * TILE, TILE);
  }
  return cv;
}

function buildManifest() {
  const slots = {};
  SLOTS.forEach(s => {
    const arr = S.out[s.id];
    const cells = [];
    arr.forEach((c, i) => {
      if (!c) return;
      const t = TAG_BY_ID[c.tag] || TAG_BY_ID.none;
      cells.push({
        index: i,
        tileId: SLOT_BASE[s.id] + i,
        col: i % s.cols, row: Math.floor(i / s.cols),
        srcSheet: c.src.sheetName,
        srcIndex: c.src.index,
        transform: c.tf,
        tag: c.tag,
        passable: t.passable,
        upper: !!t.upper
      });
    });
    slots[s.id] = {
      tileIdBase: SLOT_BASE[s.id],
      imageSize: [s.cols * TILE, s.rows * TILE],
      cols: s.cols, rows: s.rows,
      capacity: arr.length,
      used: cells.length,
      cells
    };
  });
  const flags = computeFlags();
  let unpassable = 0;
  for (const f of flags) if (f & 0x000F) unpassable++;
  return {
    tool: 'Tileset Studio',
    generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    tileSize: TILE,
    slots,
    flags,
    flagsNote: {
      '0x000F': '四面不可通行',
      '0x0010': '★上层块（盖住角色、不影响通行）',
      length: 8192
    },
    stats: { unpassableTileIds: unpassable },
    tagDict: TAGS.map(t => ({ id: t.id, name: t.name, passable: t.passable, preferSlot: t.slot }))
  };
}

function computeFlags() {
  const f = new Array(8192).fill(0);
  SLOTS.forEach(s => {
    const base = SLOT_BASE[s.id];
    S.out[s.id].forEach((c, i) => {
      if (!c) return;
      const t = TAG_BY_ID[c.tag] || TAG_BY_ID.none;
      let v = 0;
      if (!t.passable) v |= 0x000F;
      if (t.upper) v |= 0x0010;
      f[base + i] = v;
    });
  });
  return f;
}

function dataUrl(cv) { return cv.toDataURL('image/png'); }

function prefixName() {
  const p = ($('#prefixInput') && $('#prefixInput').value.trim()) || 'OUT';
  return p.replace(/[\\/:*?"<>|]/g, '_');
}

/* ============================================================
   ★ 每个工程一个文件夹
     <导出根>\<工程名>\
         <工程名>.tsproj        工程包（再存 = 覆盖自己）
         <工程名>_A5.png        导出图 —— 文件夹**内**的文件绝不重名：
         <工程名>_B.png           已存在就自动改成 -2、-3，**不覆盖**
         <工程名>_flags.json
         <工程名>_manifest.json
   工程名取谁：① 存过的工程用它；② 没存过用源图名（map1_7x6）；③ 再没有才用前缀框。
   ============================================================ */
let PROJ_DIR = null;          // 已创建好的工程文件夹（缓存，避免每次都 mkdir）

function projFolderName() {
  if (S.proj && S.proj.name) {
    const n = String(S.proj.name).replace(/\.tsproj$/i, '');
    if (n) return n.replace(/[\\/:*?"<>|]/g, '_');
  }
  const base = (S.sheet && S.sheet.name)
    ? String(S.sheet.name).replace(/\.[a-z0-9]+$/i, '') : '';
  return (base || prefixName()).replace(/[\\/:*?"<>|]/g, '_');
}

/** 导出根目录（用户可改），工程文件夹在它下面 */
function exportRoot() { return S.outDir || S.exportDir; }

/** 算出这次要落哪个文件夹，并把它建出来 */
async function ensureProjDir() {
  const root = exportRoot();
  const want = root + '\\' + projFolderName();
  if (PROJ_DIR === want) return want;
  try {
    const r = await post('/api/mkdir', { path: want });
    if (!r.ok) { toast('建工程文件夹失败：' + r.error, 'err'); return root; }
  } catch (e) { toast('建工程文件夹失败：' + e.message, 'err'); return root; }
  PROJ_DIR = want;
  updateExportHint();
  return want;
}

/** 底栏提示：导出根 → 当前工程文件夹 */
function updateExportHint() {
  const el = $('#outDirHint');
  if (!el) return;
  const root = exportRoot();
  const named = !!(S.proj && S.proj.name);
  const full = root + '\\' + projFolderName();
  el.textContent = root + '  ▸  ' + projFolderName() + '\\' + (named ? '' : '  （未存工程）');
  el.title = '每次导出都落这里：' + full +
    (named ? '' : '\n还没存过工程 → 暂时拿源图名当文件夹名；存一次工程就换成工程名') +
    '\n文件夹里的文件重名会自动加 -2，不会被覆盖';
}

/** opt.prefix    文件名前缀（默认 = 工程名）
    opt.noClobber 重名时加 -2 不覆盖（默认 true；写进 RPG 工程时要传 false —— 那边引用的是固定文件名） */
async function savePng(slotId, dir, silent, opt) {
  opt = opt || {};
  const cv = slotToCanvas(slotId);
  const arr = S.out[slotId].filter(Boolean).length;
  if (!arr) { if (!silent) toast(slotId + ' 槽是空的，跳过', 'warn'); return null; }
  const toDir = dir || await ensureProjDir();
  // 显式给了目录（老用法 / 写进 RPG 工程）→ 还是用「前缀框」那个名字；没给 → 走新口径用工程名
  const pre = opt.prefix || (dir ? prefixName() : projFolderName());
  const path = toDir + '\\' + pre + '_' + slotId + '.png';
  const r = await post('/api/savePng', { path, b64: dataUrl(cv),
                                         noClobber: opt.noClobber !== false });
  if (!r.ok) { toast('保存失败：' + r.error, 'err'); return null; }
  if (!silent) toast('已保存 ' + r.path + '（' + arr + ' 格）' +
    (r.renamed ? '　※ 重名，已自动改名，没覆盖旧的' : ''), 'ok');
  return r.path;
}

async function saveAllPng(dir, opt) {
  const toDir = dir || await ensureProjDir();
  const paths = [], renamed = [];
  for (const s of SLOTS) {
    const p = await savePng(s.id, toDir, true, opt);
    if (p) { paths.push(p); if (/-\d+\.png$/i.test(p)) renamed.push(p.split('\\').pop()); }
  }
  if (!paths.length) return toast('输出区是空的', 'warn');
  toast('已保存 ' + paths.length + ' 张 PNG → ' + toDir +
    (renamed.length ? '（' + renamed.length + ' 个重名已自动改名）' : ''), 'ok');
}

async function saveJson(dir, opt) {
  opt = opt || {};
  const man = buildManifest();
  const toDir = dir || await ensureProjDir();
  const pre = opt.prefix || (dir ? prefixName() : projFolderName());
  const path = toDir + '\\' + pre + '_manifest.json';
  const r = await post('/api/saveText', { path, text: JSON.stringify(man, null, 2),
                                          noClobber: opt.noClobber !== false });
  if (!r.ok) { toast('保存失败：' + r.error, 'err'); return null; }
  toast('清单已保存 → ' + r.path + (r.renamed ? '　※ 重名已自动改名' : ''), 'ok');
  return r.path;
}

async function saveFlags(dir, opt) {
  opt = opt || {};
  const f = computeFlags();
  const toDir = dir || await ensureProjDir();
  const pre = opt.prefix || (dir ? prefixName() : projFolderName());
  const path = toDir + '\\' + pre + '_flags.json';
  const r = await post('/api/saveText', { path, text: JSON.stringify(f),
                                          noClobber: opt.noClobber !== false });
  if (!r.ok) { toast('保存失败：' + r.error, 'err'); return null; }
  let n = 0; for (const v of f) if (v & 0x000F) n++;
  toast('通行表已保存 → ' + r.path + '（不可通行 ' + n + ' 格）' +
    (r.renamed ? '　※ 重名已自动改名' : ''), 'ok');
  return r.path;
}

/* ============================================================
   工程包（.tsproj）—— 把「源图 + 布局 + 语义 + 通行表」打包，可导入还原
   包结构（就是个 zip）：
     project.json   meta + 全部状态
     source.png     原始素材图集（原样拷入，导入时不依赖原文件还在不在）
     preview.png    当前槽缩略图（列表里好认）
     flags.txt      8192 项通行表（人可读）
     manifest.json  图块清单
   ============================================================ */
function projCellOf(c) {
  if (!c) return null;
  return {
    src: { sheet: c.src.sheet, sheetName: c.src.sheetName, index: c.src.index },
    tf: c.tf, tag: c.tag,
    blk: c.blk ? { id: c.blk.id, c0: c.blk.c0, r0: c.blk.r0, w: c.blk.w, h: c.blk.h } : null
  };
}

function projState() {
  const out = {};
  SLOTS.forEach(s => { out[s.id] = S.out[s.id].map(projCellOf); });
  return {
    v: 1, app: 'TilesetStudio',
    sheet: S.sheet ? { name: S.sheet.name, path: S.sheet.path,
                       w: S.sheet.w, h: S.sheet.h,
                       cols: S.sheet.cols, rows: S.sheet.rows } : null,
    tagOf: { ...S.tagOf },
    out,
    blkSeq: S.blkSeq,
    lastBlk: S.lastBlk ? { ...S.lastBlk } : null,
    curSlot: S.curSlot,
    blockMode: S.blockMode,
    blockFlip: S.blockFlip,
    placeTf: S.placeTf,
    showBlkFrame: S.showBlkFrame,
    zoom: S.zoom, outZoom: S.outZoom
  };
}

function projCounts() {
  const c = {};
  SLOTS.forEach(s => {
    const arr = S.out[s.id];
    let n = 0; for (const x of arr) if (x) n++;
    c[s.id] = n;
  });
  const tags = {};
  for (const k in S.tagOf) tags[S.tagOf[k]] = (tags[S.tagOf[k]] || 0) + 1;
  return { cells: c, tags };
}

/** 缩略图：当前槽缩到 ≤320px（列表里显示用，包不至于太大） */
function projPreview(maxSide) {
  maxSide = maxSide || 320;
  try {
    const cv = slotToCanvas(S.curSlot);
    const sc = Math.min(1, maxSide / Math.max(cv.width, cv.height));
    const sm = document.createElement('canvas');
    sm.width = Math.max(1, Math.round(cv.width * sc));
    sm.height = Math.max(1, Math.round(cv.height * sc));
    const g = sm.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(cv, 0, 0, sm.width, sm.height);
    return dataUrl(sm);
  } catch (e) { return ''; }
}

function projDefaultName() {
  const base = (S.sheet && S.sheet.name ? S.sheet.name.replace(/\.[a-z0-9]+$/i, '') : 'map');
  const d = new Date();
  const p2 = n => String(n).padStart(2, '0');
  return base + '_' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) +
    '_' + p2(d.getHours()) + p2(d.getMinutes());
}

async function saveProject(name, dir, isOver) {
  if (!S.sheet) return toast('还没有加载源图，没什么可存', 'warn');
  const root = dir || exportRoot();
  if (name === undefined) {
    name = (window.prompt('工程名（会单独建一个同名文件夹 ' + root + '\\<工程名>\\）',
      projDefaultName()) || '').trim();
  }
  if (!name) return;
  const st = projState();
  const cnt = projCounts();
  const r = await post('/api/proj/save', {
    dir: root,
    subdir: true,                    // ★ 每工程一个文件夹
    name,
    state: st,
    sheetPath: S.sheet.path,
    fromProj: S.proj.path || '',
    preview: projPreview(),
    flags: computeFlags(),
    manifest: buildManifest(),
    cells: cnt.cells,
    tags: cnt.tags
  });
  if (!r.ok) { toast('保存工程失败：' + r.error, 'err'); return null; }
  S.proj = { path: r.path, name: r.name };
  PROJ_DIR = r.dir || PROJ_DIR;        // 后端已把工程文件夹建好了，直接记住
  updateProjUI(); updateExportHint();
  const kb = (r.bytes / 1024).toFixed(0);
  toast((isOver ? '已覆盖保存 → ' : '工程已存 → ') + r.dir + '\\' + r.name +
    '（' + kb + ' KB，含源图 ' + (r.srcBytes / 1024).toFixed(0) + ' KB）', 'ok');
  return r;
}

/** 覆盖保存当前工程（没存过就走 saveProject 弹名字）
    注意 dir 必须给**导出根目录**：文件夹由后端按工程名拼，别再传包自己的目录，
    否则会套成 <根>\<工程名>\<工程名>\… */
function saveProjectOver() {
  if (!S.proj.name) return saveProject();
  return saveProject(S.proj.name.replace(/\.tsproj$/i, ''), exportRoot(), true);
}

/* ---------------- 导入 ---------------- */
async function openProjDialog() {
  $('#projMask').classList.add('show');
  await listProjects();
}
async function listProjects() {
  const dir = S.outDir || S.exportDir;
  $('#projDir').textContent = dir;
  const box = $('#projList');
  box.innerHTML = '<div class="hint">读取中…</div>';
  try {
    const j = await api('/api/proj/list', { dir });
    box.innerHTML = '';
    if (!j.items.length) {
      box.innerHTML = '<div class="hint">这个目录还没有 .tsproj。' +
        '先点顶栏「💾 存工程」把当前地图打包一个。</div>';
      $('#projHint').textContent = '0 个';
      return;
    }
    j.items.forEach(it => {
      const d = document.createElement('div');
      d.className = 'projcard';
      const thumb = document.createElement('img');
      thumb.className = 'thumb';
      if (it.hasPreview) {
        thumb.src = '/api/proj/file?path=' + encodeURIComponent(it.path) +
          '&entry=preview.png&t=' + Date.now();
        thumb.onerror = () => { thumb.removeAttribute('src'); };
      }
      d.appendChild(thumb);
      const who = document.createElement('div');
      who.className = 'who';
      const cells = it.cells || {};
      const total = Object.keys(cells).reduce((a, k) => a + (cells[k] || 0), 0);
      who.innerHTML =
        '<div class="nm">' + it.name + '</div>' +
        '<div class="sub">' +
        '<b>' + (it.sheet || '?') + '</b><br>' +
        (it.savedAt || it.mtime) + ' · ' + (it.bytes / 1024).toFixed(0) + ' KB<br>' +
        '共 <b>' + total + '</b> 格' +
        (Object.keys(cells).length
          ? '（' + Object.keys(cells).map(k => k + ':' + cells[k]).join(' ') + '）'
          : '') +
        '</div>';
      d.appendChild(who);
      d.onclick = () => loadProject(it.path);
      box.appendChild(d);
    });
    $('#projHint').textContent = j.items.length + ' 个工程包';
  } catch (e) {
    box.innerHTML = '<div class="hint">读失败：' + e.message + '</div>';
  }
}

function applyProjState(st) {
  if (!st) throw new Error('包里没有状态');
  // 设置项先还原（不影响格子）
  if (st.blockMode !== undefined) S.blockMode = !!st.blockMode;
  if (st.blockFlip) S.blockFlip = st.blockFlip;
  if (st.placeTf) S.placeTf = st.placeTf;
  if (st.showBlkFrame !== undefined) S.showBlkFrame = !!st.showBlkFrame;
  S.tagOf = { ...(st.tagOf || {}) };
  S.blkSeq = st.blkSeq || 0;
  S.lastBlk = st.lastBlk ? { ...st.lastBlk } : null;

  // 格子：按 src.index 从（刚载入的）源图重新取画布，tf/tag/blk 原样带回
  let lost = 0, n = 0;
  SLOTS.forEach(s => {
    const arr = new Array(s.cols * s.rows).fill(null);
    const src = (st.out || {})[s.id] || [];
    for (let i = 0; i < arr.length && i < src.length; i++) {
      const c = src[i];
      if (!c || !c.src) continue;
      const snap = cellCanvasOf(c.src.index);
      if (!snap) { lost++; continue; }
      arr[i] = {
        snap,
        src: { sheet: S.sheet ? S.sheet.path : c.src.sheet,
               sheetName: c.src.sheetName, index: c.src.index },
        tf: c.tf || 'none',
        tag: c.tag || 'none',
        blk: c.blk ? { id: c.blk.id, c0: c.blk.c0, r0: c.blk.r0, w: c.blk.w, h: c.blk.h } : null
      };
      n++;
    }
    S.out[s.id] = arr;
  });
  if (st.curSlot && SLOT_BY_ID[st.curSlot]) S.curSlot = st.curSlot;
  return { cells: n, lost };
}

async function loadProject(path) {
  try {
    const r = await post('/api/proj/load', { path });
    if (!r.ok) { toast('导入失败：' + r.error, 'err'); return null; }
    const st = r.state || {};
    const sh = st.sheet || (r.meta || {}).sheet || {};
    if (!sh.cols || !sh.rows) { toast('这个包里没有源图信息，导入不了', 'err'); return null; }

    // 源图来自包内 source.png：用 proj://<zip路径> 当虚拟路径
    const vpath = 'proj://' + path;
    const img = await loadImage(vpath);
    S.sheet = {
      path: vpath, name: sh.name || r.name || 'source.png',
      img, w: img.naturalWidth, h: img.naturalHeight,
      cols: Math.floor(img.naturalWidth / TILE), rows: Math.floor(img.naturalHeight / TILE)
    };
    S.cellCache = null;
    S.sel.clear(); S.hover = -1; S.marquee = null;
    ensureCellCache();
    $('#srcMeta').textContent = S.sheet.name + '  ' + S.sheet.w + '×' + S.sheet.h +
      '  →  ' + S.sheet.cols + ' × ' + S.sheet.rows + ' = ' +
      (S.sheet.cols * S.sheet.rows) + ' 格　（来自工程包）';

    const res = applyProjState(st);
    S.proj = { path, name: r.name || path.split(/[\\/]/).pop() };
    PROJ_DIR = path.replace(/[\\/][^\\/]+$/, '');   // 包所在目录就是它的工程文件夹
    updateExportHint();                             // 之后导出/再存都落回这里
    HIST.undo.length = 0; HIST.redo.length = 0;   // 导入是一次性整体替换，不进撤回栈
    updateHistUI(); updateProjUI();
    clearOutSel(); S.outRect = null; S.outBrush = null;
    reqSrc(); reqOut(); updateStats && updateStats(); updateBlockInfo();
    requestAnimationFrame(fitZoom);
    $('#projMask').classList.remove('show');
    toast('已导入 ' + S.proj.name + '：源图 ' + S.sheet.cols + '×' + S.sheet.rows +
      '，还原 ' + res.cells + ' 格' + (res.lost ? '（⚠ ' + res.lost + ' 格源索引越界已跳过）' : ''), 'ok');
    return r;
  } catch (e) { toast('导入失败：' + e.message, 'err'); return null; }
}

/** 拖进来的 .tsproj：浏览器给不到磁盘路径 → 传字节给后端落到 out/_drop/ → 走正常导入 */
async function dropProjectFile(file) {
  try {
    toast('正在读取 ' + file.name + ' …');
    const buf = await file.arrayBuffer();
    let s = '';
    const u8 = new Uint8Array(buf);
    const CH = 0x8000;
    for (let i = 0; i < u8.length; i += CH) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    }
    const b64 = btoa(s);
    const up = await post('/api/proj/upload', { name: file.name, b64 });
    if (!up.ok) return toast('导入失败：' + up.error, 'err');
    return await loadProject(up.path);
  } catch (e) { toast('导入失败：' + e.message, 'err'); }
}

function updateProjUI() {
  const el = $('#projName');
  if (!el) return;
  if (S.proj.name) {
    el.textContent = '工程：' + S.proj.name;
    el.style.color = 'var(--tx2)';
    el.title = S.proj.path + '\n（Ctrl+Shift+S 另存 / 覆盖保存；Ctrl+O 导入别的包）';
  } else {
    el.textContent = '未保存工程';
    el.style.color = 'var(--dim)';
  }
}

/* ============================================================
   其他 UI
   ============================================================ */
function buildTagUI() {
  const box = $('#tagList');
  box.innerHTML = '';
  TAGS.forEach(t => {
    const d = document.createElement('div');
    d.className = 'tagbtn';
    d.dataset.tag = t.id;
    d.innerHTML = '<span class="dot" style="background:' + t.color + '"></span>' +
      t.name +
      (t.passable ? '' : ' <span class="hint">✕通行</span>') +
      (t.upper ? ' <span class="hint">★</span>' : '') +
      '<span class="kbd">' + (t.key || '') + '</span>';
    d.title = '标记选中图块为「' + t.name + '」' + (t.slot ? '（自动分配 → ' + t.slot + ' 槽）' : '');
    d.onclick = () => applyTag(t.id, true);
    box.appendChild(d);
  });
}

function applyTag(tagId, manual) {
  if (!S.sel.size) {
    if (manual) toast('先在左边选中图块', 'warn');
    return;
  }
  // 全部都是一样的语义 → 不产生无意义的撤销步骤
  const changed = [...S.sel].some(i => (S.tagOf[i] || 'none') !== tagId);
  if (!changed) {
    if (manual) toast('这 ' + S.sel.size + ' 格本来就是「' + TAG_BY_ID[tagId].name + '」', 'warn');
    return;
  }
  pushHist('标注→' + TAG_BY_ID[tagId].name);
  S.sel.forEach(i => {
    if (tagId === 'none') delete S.tagOf[i];
    else S.tagOf[i] = tagId;
  });
  const t = TAG_BY_ID[tagId];
  reqSrc();
  $$('#tagList .tagbtn').forEach(d => d.classList.toggle('on', d.dataset.tag === tagId));
  toast('已把 ' + S.sel.size + ' 格标为「' + t.name + '」' + (t.passable ? '' : '（不可通行）'), 'ok');
}

function buildTfUI() {
  const box = $('#tfList');
  box.innerHTML = '';
  TFS.forEach(t => {
    const b = document.createElement('button');
    b.textContent = t.name;
    b.title = '快捷键 ' + t.key + (t.id === 'none' ? '（数字0）' : '');
    b.onclick = () => transformOut(t.id);
    box.appendChild(b);
  });
}

/* ---------------- 目录浏览 ---------------- */
let dlgCur = '';
let dlgMode = 'root';        // 'root' = 选素材目录 / 'out' = 选导出目录
async function openDialog(dir, mode) {
  dlgMode = mode || 'root';
  dlgCur = dir || (dlgMode === 'out' ? (S.outDir || S.exportDir) : (S.rpgTilesets || S.root));
  $('#mask').classList.add('show');
  await listDialog(dlgCur);
}
async function listDialog(dir) {
  try {
    const j = await api('/api/list', { dir });
    dlgCur = j.dir;
    $('#dlgPath').textContent = j.dir;
    const box = $('#dlgList');
    box.innerHTML = '';
    j.items.forEach(it => {
      const d = document.createElement('div');
      d.className = 'it ' + (it.type === 'img' ? 'img' : 'dir');
      d.textContent = (it.type === 'img' ? '🖼 ' : '📁 ') + it.name;
      d.onclick = () => {
        if (it.type === 'dir') listDialog(it.path);
        else { $('#mask').classList.remove('show'); openSheetByPath(it.path); }
      };
      box.appendChild(d);
    });
    if (!j.items.length) box.innerHTML = '<div class="hint">（空目录）</div>';
  } catch (e) { toast(e.message, 'err'); }
}

/* ---------------- 加载图集 ---------------- */
function loadImage(path) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('图片加载失败'));
    // 工程包里的源图用「proj://<zip绝对路径>」表示，走 /api/proj/file 取包内 source.png
    if (String(path).indexOf('proj://') === 0) {
      const zip = String(path).slice(7);
      im.src = '/api/proj/file?path=' + encodeURIComponent(zip) +
        '&entry=source.png&t=' + Date.now();
    } else {
      im.src = '/api/img?path=' + encodeURIComponent(path) + '&t=' + Date.now();
    }
  });
}

async function openSheetByPath(path, name) {
  try {
    const img = await loadImage(path);
    S.sheet = {
      path, name: name || path.split(/[\\/]/).pop(),
      img, w: img.naturalWidth, h: img.naturalHeight,
      cols: Math.floor(img.naturalWidth / TILE),
      rows: Math.floor(img.naturalHeight / TILE)
    };
    if (!S.sheet.cols || !S.sheet.rows) throw new Error('这张图不足 1 格（' +
      img.naturalWidth + '×' + img.naturalHeight + '），至少要有 ' + TILE + '×' + TILE + ' px');
    S.cellCache = null;
    S.sel.clear(); S.hover = -1; S.marquee = null;
    S.lastBlk = null;
    // 换了源图集 → 不再是「从某个工程包来的」了；工程文件夹名也要跟着换
    if (S.proj && S.proj.path) { S.proj = { path: '', name: '' }; updateProjUI(); }
    PROJ_DIR = null; updateExportHint();
    ensureCellCache();
    const leftoverW = img.naturalWidth % TILE, leftoverH = img.naturalHeight % TILE;

    $('#srcMeta').style.color = '';      // 上次失败留下的红色要清掉
    $('#srcMeta').textContent = S.sheet.name + '  ' + S.sheet.w + '×' + S.sheet.h +
      '  →  ' + S.sheet.cols + ' × ' + S.sheet.rows + ' = ' + (S.sheet.cols * S.sheet.rows) + ' 格' +
      (leftoverW || leftoverH ? '  ⚠ 右侧/下方有 ' + leftoverW + '×' + leftoverH + ' px 不是整格，已忽略' : '');
    $('#sheetSelect').value = path;
    try {
      localStorage.setItem('ts.lastSheet::' + S.root, path);
      localStorage.setItem('ts.lastSheet', path);
    } catch (e) { /* ignore */ }
    reqSrc(); updateSelInfo(); updateBlockInfo();
    requestAnimationFrame(fitZoom);
    toast('已加载 ' + S.sheet.name + '（' + (S.sheet.cols * S.sheet.rows) + ' 格）', 'ok');
  } catch (e) {
    // toast 会消失，把失败原因留在 ① 区顶上，免得「看到一片空白但不知道为什么」
    const m = $('#srcMeta');
    if (m) { m.textContent = '⚠ 加载失败：' + e.message; m.style.color = '#ff6b6b'; }
    toast('素材加载失败：' + e.message, 'err');
  }
}

async function loadSheetList(dir) {
  try {
    const j = await api('/api/list', { dir, sizes: '1' });
    const sel = $('#sheetSelect');
    sel.innerHTML = '';
    const imgs = j.items.filter(it => it.type === 'img' && (it.w || 0) >= TILE && (it.h || 0) >= TILE);
    const tiny = j.items.filter(it => it.type === 'img' && ((it.w || 0) < TILE || (it.h || 0) < TILE));
    if (!imgs.length) {
      sel.innerHTML = '<option value="">（该目录没有 ≥1 格的图片）</option>';
      S.root = j.dir; S.sheets = [];
      $('#rootHint').textContent = j.dir + (tiny.length ? '　（跳过 ' + tiny.length + ' 张小图）' : '');
      return;
    }
    /* 每张图补上格数；「地图」= 至少 2×2 格（1×N / N×1 的条状图是零散素材，不是地图） */
    const cellsOf = it => (it.cols || Math.floor((it.w || 0) / TILE)) *
                          (it.rows || Math.floor((it.h || 0) / TILE));
    imgs.forEach(it => { it.cells = cellsOf(it); });
    const isMap = it => (it.cols || 0) >= 2 && (it.rows || 0) >= 2;
    /* 自然序：map2 排在 map10 前面（字符串序会排成 map1, map10, map11, map2 … 很难找） */
    const nat = s => String(s || '').replace(/(\d+)/g, m => ('00000000' + m).slice(-8));
    const byName = (a, b) => nat(a.name) < nat(b.name) ? -1 : nat(a.name) > nat(b.name) ? 1 : 0;
    const maps = imgs.filter(isMap).sort(byName);
    const odds = imgs.filter(it => !isMap(it)).sort(byName);

    const addOpt = (it, label) => {
      const o = document.createElement('option');
      o.value = it.path;
      o.textContent = (label || '') + it.name + (it.w ? '   (' + it.w + '×' + it.h + ' → ' +
        (it.cols || Math.floor(it.w / TILE)) + '×' + (it.rows || Math.floor(it.h / TILE)) +
        ' = ' + it.cells + ' 格)' : '');
      sel.appendChild(o);
    };
    const mkGroup = (label, list, prefix) => {
      if (!list.length) return;
      const g = document.createElement('optgroup');
      g.label = label + '（' + list.length + '）';
      sel.appendChild(g);
      list.forEach(it => { addOpt(it, prefix); g.appendChild(sel.lastChild); });
    };
    mkGroup('地图（≥2×2 格）', maps, '');
    mkGroup('零散素材（1×N / N×1 条状）', odds, '');
    S.root = j.dir;
    S.sheets = maps.concat(odds);
    $('#rootHint').textContent = j.dir + '　·　地图 ' + maps.length + ' 张' +
      (odds.length ? ' + 零散 ' + odds.length + ' 张' : '') +
      (tiny.length ? '　（跳过 ' + tiny.length + ' 张小于 1 格的图）' : '');

    /* 默认打开哪张：① 这个目录上次打开过的（按目录分别记忆）
       ② 名字像 map1* 的（老习惯：从第一张地图开始）
       ③ 格数最多的那张 —— 兜底必须是「最像地图的」，不能是排序第一的小图
          （曾经默认取 imgs[0] → 目录里 bz.png 排在 map1 前面 → 打开是 5×1 一条，
           看着就像「素材没加载出来」） */
    let pick = null;
    try {
      const key = 'ts.lastSheet::' + j.dir;
      const last = localStorage.getItem(key) || localStorage.getItem('ts.lastSheet');
      if (last) pick = imgs.find(x => x.path === last) || null;
    } catch (e) { /* 隐私模式下忽略 */ }
    if (!pick) pick = imgs.find(x => /^map1([._\-]|$)/i.test(x.name)) || null;
    if (!pick) pick = imgs.slice().sort((a, b) => b.cells - a.cells)[0];
    if (!pick) pick = imgs[0];
    await openSheetByPath(pick.path, pick.name);
  } catch (e) { toast('列目录失败：' + e.message, 'err'); }
}

/* ---------------- 素材根目录 ---------------- */
function buildRootSelect() {
  const sel = $('#rootSelect');
  sel.innerHTML = '';
  S.mounts.forEach(m => {
    const o = document.createElement('option');
    o.value = m.path;
    o.textContent = m.label;
    o.title = m.path;
    sel.appendChild(o);
  });
  sel.value = S.root || '';
}

async function setRoot(dir) {
  if (!dir) return;
  const sel = $('#rootSelect');
  if (sel.value !== dir) sel.value = dir;
  try { localStorage.setItem('ts.lastRoot', dir); } catch (e) { /* ignore */ }
  await loadSheetList(dir);
}

/* ---------------- 导出目录（默认：桌面\图块工坊导出） ---------------- */
function buildDirSelect() {
  const sel = $('#dirSelect');
  if (!sel) return;
  sel.innerHTML = '';
  const cand = [
    { label: '★ 桌面 · 图块工坊导出', path: S.exportDir },
    { label: '桌面（直接放桌面）', path: S.desktop },
    { label: '工具 out 目录', path: S.toolOut },
    { label: '工程 img/tilesets', path: S.rpgTilesets },
  ].filter(o => o.path);
  cand.forEach(o => {
    const op = document.createElement('option');
    op.value = o.path; op.textContent = o.label; op.title = o.path;
    sel.appendChild(op);
  });
  if (S.outDir && !cand.some(o => o.path === S.outDir)) {
    const op = document.createElement('option');
    op.value = S.outDir; op.textContent = S.outDir; op.title = S.outDir;
    sel.appendChild(op);
  }
  const pick = document.createElement('option');
  pick.value = '__pick__'; pick.textContent = '选择其他目录…';
  sel.appendChild(pick);

  sel.value = S.outDir || S.exportDir || '';
}

function setOutDir(dir) {
  if (!dir) return;
  S.outDir = dir;
  PROJ_DIR = null;                 // 换了根目录 → 工程子文件夹要重算/重建
  updateExportHint();
  buildDirSelect();
  try { localStorage.setItem('ts.outDir', dir); } catch (e) { /* ignore */ }
  toast('导出根目录 → ' + dir + '（每个工程会在这里面单独建一个文件夹）', 'ok');
}

/* ============================================================
   事件
   ============================================================ */
function bindEvents() {
  /* ---- 素材区鼠标 ---- */
  const srcCv = $('#srcCanvas');
  let dragging = false, dragStart = -1;

  srcCv.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (!S.sheet) return;
    const idx = idxAtSrc(e.clientX, e.clientY);
    if (idx < 0) return;
    S.shift = e.shiftKey;
    dragging = true; dragStart = idx;
    const c = idx % S.sheet.cols, r = Math.floor(idx / S.sheet.cols);
    S.marquee = { x0: c, y0: r, x1: c, y1: r };
    if (!S.shift) S.sel.clear();
    reqSrc();
    e.preventDefault();
  });

  window.addEventListener('mousemove', e => {
    if (!S.sheet) return;
    const wrap = $('#srcWrap');
    const inside = wrap.contains(e.target);
    const idx = inside ? idxAtSrc(e.clientX, e.clientY) : -1;
    if (idx !== S.hover) { S.hover = idx; reqSrc(); }

    if (dragging && S.marquee) {
      const c = Math.max(0, Math.min(S.sheet.cols - 1, Math.floor((e.clientX - srcCv.getBoundingClientRect().left) / (TILE * S.zoom))));
      const r = Math.max(0, Math.min(S.sheet.rows - 1, Math.floor((e.clientY - srcCv.getBoundingClientRect().top) / (TILE * S.zoom))));
      const x0 = Math.min(S.marquee.x0, c), x1 = Math.max(S.marquee.x0, c);
      const y0 = Math.min(S.marquee.y0, r), y1 = Math.max(S.marquee.y0, r);
      S.marquee.x0 = x0; S.marquee.y0 = y0; S.marquee.x1 = x1; S.marquee.y1 = y1;
      reqSrc();
    }
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    if (S.marquee && S.sheet) {
      for (let r = S.marquee.y0; r <= S.marquee.y1; r++)
        for (let c = S.marquee.x0; c <= S.marquee.x1; c++)
          S.sel.add(r * S.sheet.cols + c);
      S.marquee = null;
      reqSrc();
    }
  });

  // 右键 = 清除该格标注
  srcCv.addEventListener('contextmenu', e => {
    e.preventDefault();
    const idx = idxAtSrc(e.clientX, e.clientY);
    if (idx < 0) return;
    delete S.tagOf[idx];
    S.sel.delete(idx);
    reqSrc();
  });

  /* ---- 输出区鼠标 ---- */
  const outCv = $('#outCanvas');
  let outDrag = false;          // 框选模式
  let brushDrag = false;        // 刷块模式
  let eraseDrag = false;        // 橡皮模式
  let eraseStart = -1;          // 橡皮按下的起始格
  let eraseStartCell = null;    // 按下时那一格的 cell（擦之前抓的，用来找整块）
  let eraseCrossed = false;     // 橡皮是否已经拖出起始格
  let eraseAlt = false;         // 本次橡皮是否按了 Alt（只擦单格）

  function canBrush() { return S.blockMode && S.sel.size > 0; }
  /** Alt 在刷块/框选之间临时反转；橡皮模式固定为橡皮（Alt 用来切「只擦单格」） */
  function modeOf(e) {
    if (S.outMode === 'erase') return 'erase';
    if (!e.altKey) return S.outMode;
    return S.outMode === 'brush' ? 'select' : 'brush';
  }

  outCv.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const i = outIdxAt(e.clientX, e.clientY);
    if (i < 0) return;
    const slot = SLOT_BY_ID[S.curSlot];
    const c = i % slot.cols, r = (i / slot.cols) | 0;
    const mode = modeOf(e);

    /* -- 橡皮：按下即擦，拖动连擦 -- */
    if (mode === 'erase') {
      eraseDrag = true; eraseStart = i; eraseCrossed = false; eraseAlt = e.altKey;
      eraseStartCell = S.out[S.curSlot][i] || null;
      pushHist('橡皮擦');
      if (eraseOne(i)) reqOut();
      e.preventDefault();
      return;
    }

    /* -- 刷块：按住左键拖一个矩形，源选区块整块平铺进去 -- */
    if (mode === 'brush' && canBrush()) {
      brushDrag = true;
      S.outBrush = { c0: c, r0: r, c1: c, r1: r };
      reqOut();
      e.preventDefault();
      return;
    }

    /* -- 框选：拖出矩形，松手才确定（跟 RPG Maker 一样的矩形框选） -- */
    outDrag = true;
    S.outRect = { c0: c, r0: r, c1: c, r1: r };
    S.outRectAdd = e.shiftKey;
    if (!e.shiftKey) { S.outSel.clear(); S.outSelRect = null; }
    reqOut();
    e.preventDefault();
  });

  window.addEventListener('mousemove', e => {
    if (!S.sheet && !$('#outWrap').contains(e.target)) return;
    const inOut = $('#outWrap').contains(e.target);
    const i = inOut ? outIdxAt(e.clientX, e.clientY) : -1;
    if (i !== S.outHover) { S.outHover = i; reqOut(); }
    if (!inOut || i < 0) return;
    const slot = SLOT_BY_ID[S.curSlot];
    const c = i % slot.cols, r = (i / slot.cols) | 0;

    if (brushDrag) {
      if (S.outBrush) { S.outBrush.c1 = c; S.outBrush.r1 = r; reqOut(); }
      return;
    }
    if (eraseDrag) {
      if (i !== eraseStart) eraseCrossed = true;
      if (S.out[S.curSlot][i]) { eraseOne(i); reqOut(); }
      return;
    }
    if (outDrag && S.outRect) {
      S.outRect = { c0: S.outRect.c0, r0: S.outRect.r0, c1: c, r1: r };
      reqOut();
    }
  });

  window.addEventListener('mouseup', () => {
    if (brushDrag) { brushDrag = false; commitBrush(); return; }
    if (eraseDrag) {
      eraseDrag = false;
      // 只是单击（没拖出去）→ 连整块一起擦掉；Alt 则只擦那一格
      if (!eraseCrossed && eraseStartCell && !eraseAlt) {
        const n = eraseBlockAt(eraseStartCell, false);
        reqOut();
        if (n > 1) toast('已擦掉整块 ' + n + ' 格　·　Alt+单击 只擦单格', 'ok');
      }
      eraseStart = -1; eraseStartCell = null; eraseCrossed = false; eraseAlt = false;
      return;
    }
    if (outDrag) { outDrag = false; applyOutRect(); }
  });

  /* 双击 = 选中整块（块不会被拆散，方便整体变换 / 复制 / 删除） */
  outCv.addEventListener('dblclick', e => {
    const i = outIdxAt(e.clientX, e.clientY);
    if (i < 0) return;
    const cell = S.out[S.curSlot][i];
    if (!cell || !cell.blk) return;
    selectWholeBlock(cell);
    reqOut();
    toast('已选中整块（' + S.outSel.size + ' 格）—— 此时变换会整块镜像', 'ok');
  });

  outCv.addEventListener('contextmenu', e => {
    e.preventDefault();
    const i = outIdxAt(e.clientX, e.clientY);
    if (i < 0) return;
    const arr = S.out[S.curSlot];
    const cell = arr[i];
    if (!cell) return;
    pushHist('删除');
    // 整块模式：右键删整块；Alt+右键只删这一格
    if (cell.blk && !e.altKey) {
      const ids = blockCellsOf(cell);
      ids.forEach(k => { arr[k] = null; });
      clearOutSel();
      reqOut();
      return toast('已删除整块（' + ids.length + ' 格）· Alt+右键可只删单格', 'ok');
    }
    arr[i] = null;
    S.outSel.delete(i);
    reqOut();
  });

  /* ---- 顶栏 ---- */
  $('#rootSelect').onchange = e => setRoot(e.target.value);
  $('#sheetSelect').onchange = e => openSheetByPath(e.target.value);
  $('#btnReload').onclick = () => { if (S.sheet) openSheetByPath(S.sheet.path, S.sheet.name); };
  $('#btnBrowse').onclick = () => openDialog(S.root || S.rpgTilesets);

  /* ---- 放置方式：整块贴 / 逐个铺 ---- */
  $$('#segMode > button').forEach(btn => {
    btn.onclick = () => {
      $$('#segMode > button').forEach(x => x.classList.toggle('on', x === btn));
      S.blockMode = btn.dataset.mode === 'block';
      const bp = $('#btnPlace');
      if (bp) bp.textContent = S.blockMode ? '→ 整块贴入当前槽' : '→ 逐个放入当前槽';
      updateBlockInfo();
      drawVariantPreview(S.sel.size ? [...S.sel].sort((a, b) => a - b)[0] : -1);
      reqOut();
      toast(S.blockMode
        ? '整块贴：保持框选形状原样贴过去，不拆散（输出区按住左键拖 = 刷块）'
        : '逐个铺：每个格子依次填进空位', 'ok');
    };
  });

  /* ---- 块翻转方式：整块镜像 / 只翻每格 ---- */
  $$('#segBlkFlip > button').forEach(btn => {
    btn.onclick = () => {
      $$('#segBlkFlip > button').forEach(x => x.classList.toggle('on', x === btn));
      S.blockFlip = btn.dataset.bflip;
      drawVariantPreview(S.sel.size ? [...S.sel].sort((a, b) => a - b)[0] : -1);
      reqOut();
      toast(S.blockFlip === 'order'
        ? '整块镜像：连排列一起翻 → 出来的是整块地图的镜像'
        : '只翻每格：每格自身翻转，排布不动', 'ok');
    };
  });

  /* ---- 输出区鼠标模式：刷块 / 框选 / 橡皮 ---- */
  $$('#segOutMode > button').forEach(btn => {
    btn.onclick = () => {
      setOutMode(btn.dataset.omode);
      toast(S.outMode === 'brush' ? '输出区：按住左键拖一个矩形，源选区块整块刷进去'
        : S.outMode === 'select' ? '输出区：按住左键拖出矩形框选（Shift 加选，双击选整块）'
          : '橡皮擦：按住左键拖过即擦 · 单击擦整块 · Alt+单击 只擦单格', 'ok');
    };
  });

  /* ---- 撤回 / 重做 ---- */
  $('#btnUndo').onclick = undoStep;
  $('#btnRedo').onclick = redoStep;

  /* ---- ⑤ 区：原图 / 选中整块 / 橡皮 ---- */
  $('#btnOutReset').onclick = () => transformOut('none');
  $('#btnOutBlock').onclick = () => {
    const arr = S.out[S.curSlot];
    let ref = null;
    const firstSel = [...S.outSel][0];
    if (firstSel !== undefined) ref = arr[firstSel];
    if ((!ref || !ref.blk) && S.lastBlk && S.lastBlk.slot === S.curSlot) {
      ref = arr.find(c => c && c.blk && c.blk.id === S.lastBlk.id) || ref;
    }
    if (!ref || !ref.blk) return toast('先点一个属于「块」的图块（零散图块没有块形）', 'warn');
    selectWholeBlock(ref);
    reqOut();
    toast('已选中整块（' + S.outSel.size + ' 格）—— 此时 H/V/B 会整块镜像', 'ok');
  };
  $('#btnErase').onclick = () => setOutMode(S.outMode === 'erase' ? 'brush' : 'erase');

  /* ---- 整张图当一块 / 补齐为矩形 ---- */
  $('#btnWholeSheet').onclick = () => {
    if (!S.sheet) return toast('先加载一张图集', 'warn');
    S.sel.clear();
    const n = S.sheet.cols * S.sheet.rows;
    for (let i = 0; i < n; i++) S.sel.add(i);
    reqSrc();
    toast('已把整张图（' + S.sheet.cols + '×' + S.sheet.rows + '）当成一块', 'ok');
  };
  $('#btnSelRect').onclick = () => {
    if (!S.sel.size) return toast('先在左边选点东西', 'warn');
    const b = selBlock();
    let added = 0;
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) {
        const i = (b.r0 + y) * S.sheet.cols + (b.c0 + x);
        if (!S.sel.has(i)) { S.sel.add(i); added++; }
      }
    reqSrc();
    toast(added ? ('已补齐 ' + added + ' 格空洞 → 现在是一整块 ' + b.w + '×' + b.h)
                : ('本来就是完整的 ' + b.w + '×' + b.h + ' 矩形'), 'ok');
  };
  $('#btnToggleMid').onclick = () => {
    const m = document.querySelector('.col.mid');
    m.classList.toggle('hide');
    const hidden = m.classList.contains('hide');
    $('#btnToggleMid').textContent = hidden ? '展开工具栏' : '收起工具栏';
    setTimeout(() => { fitZoom(); fitOut(); }, 60);
  };

  /* ---- 缩放 ---- */
  $$('[data-zoom]').forEach(b => b.onclick = () => {
    S.zoom = Math.max(0.5, Math.min(6, S.zoom + Number(b.dataset.zoom) * 0.5));
    $('#zoomLabel').textContent = S.zoom + '×';
    reqSrc();
  });
  if ($('#btnFit')) $('#btnFit').onclick = fitZoom;
  if ($('#btnFitOut')) $('#btnFitOut').onclick = fitOut;

  let rzT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => { fitZoom(); fitOut(); }, 200);
  });

  /* ---- 选择 ---- */
  $('#btnSelAll').onclick = () => {
    if (!S.sheet) return;
    S.sel.clear();
    for (let i = 0; i < S.sheet.cols * S.sheet.rows; i++) S.sel.add(i);
    reqSrc();
    toast('已全选 ' + S.sel.size + ' 格', 'ok');
  };
  $('#btnSelNone').onclick = () => { S.sel.clear(); reqSrc(); };
  $('#btnSelInv').onclick = () => {
    if (!S.sheet) return;
    const n = S.sheet.cols * S.sheet.rows;
    const out = new Set();
    for (let i = 0; i < n; i++) if (!S.sel.has(i)) out.add(i);
    S.sel = out; reqSrc();
  };

  /* ---- 放置 / 变体 ---- */
  $('#placeTf').onchange = e => setPlaceTf(e.target.value);
  $('#btnPlace').onclick = doPlace;
  $('#btnVariantsAll').onclick = () => doVariants('all');
  $('#btnVariantsH').onclick = () => doVariants('h');

  /* ---- 输出操作 ---- */
  $('#btnOutH').onclick = () => transformOut('h');
  $('#btnOutV').onclick = () => transformOut('v');
  $('#btnOutHV').onclick = () => transformOut('hv');
  $('#btnOutDup').onclick = duplicateOut;
  $('#btnOutDel').onclick = deleteOut;
  $('#btnOutCompact').onclick = compactOut;
  $('#btnAssign').onclick = assignByTag;
  $('#btnOutClear').onclick = () => {
    if (!confirm('清空 ' + S.curSlot + ' 槽的 ' + S.out[S.curSlot].filter(Boolean).length + ' 个图块？')) return;
    S.out[S.curSlot] = new Array(SLOT_BY_ID[S.curSlot].cols * SLOT_BY_ID[S.curSlot].rows).fill(null);
    clearOutSel(); reqOut();
    toast('已清空 ' + S.curSlot + ' 槽', 'ok');
  };

  /* ---- 导出目录 ---- */
  $('#dirSelect').onchange = e => {
    if (e.target.value === '__pick__') {
      openDialog(S.outDir || S.exportDir, 'out');
      e.target.value = S.outDir || '';
      return;
    }
    setOutDir(e.target.value);
  };

  /* ---- 导出 ---- */
  $('#btnSavePng').onclick = () => savePng(S.curSlot);       // 不传 dir → 落「工程文件夹」
  $('#btnSaveAll').onclick = () => saveAllPng();
  $('#btnSaveJson').onclick = saveJson;
  $('#btnSaveFlags').onclick = saveFlags;
  $('#btnSaveToProject').onclick = async () => {
    if (!S.rpgTilesets) return toast('未拿到工程图集目录', 'err');
    if (!confirm('将把全部槽位 PNG + 清单 + 通行表写进：\n' + S.rpgTilesets + '\n\n同名文件会被覆盖。继续？')) return;
    // 写进 RPG 工程：用前缀框（不是工程名），且**必须覆盖**（工程里引用的是固定文件名）
    await saveAllPng(S.rpgTilesets, { prefix: prefixName(), noClobber: false });
    const man = buildManifest();
    await post('/api/saveText', { path: S.rpgTilesets + '\\' + prefixName() + '_manifest.json', text: JSON.stringify(man, null, 2) });
    await post('/api/saveText', { path: S.rpgTilesets + '\\' + prefixName() + '_flags.json', text: JSON.stringify(computeFlags()) });
    toast('已写入工程目录：' + S.rpgTilesets, 'ok');
  };
  $('#btnReveal').onclick = async () => {
    const d = await ensureProjDir();            // 顺带把「本工程的文件夹」建出来再打开
    const r = await post('/api/reveal', { path: d || S.outDir });
    if (!r.ok) toast('打不开：' + r.error, 'warn');
  };

  /* ---- 工程包（.tsproj）---- */
  $('#btnProjSave').onclick = () => saveProjectOver();   // 存过的直接覆盖；没存过弹名字
  $('#btnProjOpen').onclick = () => openProjDialog();
  $('#projClose').onclick = () => $('#projMask').classList.remove('show');
  $('#projMask').onclick = e => { if (e.target.id === 'projMask') $('#projMask').classList.remove('show'); };
  $('#projRefresh').onclick = () => listProjects();
  $('#projReveal').onclick = async () => {
    const r = await post('/api/reveal', { path: S.outDir || S.exportDir });
    if (!r.ok) toast('打不开：' + r.error, 'warn');
  };
  updateProjUI();

  /* ---- 目录弹层 ---- */
  $('#dlgClose').onclick = () => $('#mask').classList.remove('show');
  $('#mask').onclick = e => { if (e.target.id === 'mask') $('#mask').classList.remove('show'); };
  $('#dlgUp').onclick = () => {
    const p = dlgCur.replace(/[\\/]+$/, '').split(/[\\/]/).slice(0, -1).join('\\');
    if (p) listDialog(p);
  };
  $('#dlgUse').onclick = () => {
    $('#mask').classList.remove('show');
    if (dlgMode === 'out') { dlgMode = 'root'; setOutDir(dlgCur); return; }
    dlgMode = 'root';
    S.root = dlgCur;
    $('#rootHint').textContent = dlgCur;
    loadSheetList(dlgCur);
  };

  /* ---- 键盘 ---- */
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const k = e.key;

    /* Ctrl / Cmd 组合键放最前，免得被数字键、字母键抢走 */
    if (e.ctrlKey || e.metaKey) {
      const lk = k.toLowerCase();
      if (lk === 'z') { e.preventDefault(); if (e.shiftKey) redoStep(); else undoStep(); return; }
      if (lk === 'y') { e.preventDefault(); redoStep(); return; }
      if (lk === 'a') {
        e.preventDefault();
        if (S.sheet) { S.sel.clear(); for (let i = 0; i < S.sheet.cols * S.sheet.rows; i++) S.sel.add(i); reqSrc(); }
        return;
      }
      if (lk === 's') {
        e.preventDefault();
        if (e.shiftKey) saveProject();                 // Ctrl+Shift+S = 另存工程包
        else savePng(S.curSlot, S.outDir);             // Ctrl+S = 存本槽 PNG（保持原样）
        return;
      }
      if (lk === 'o') { e.preventDefault(); openProjDialog(); return; }
      return;
    }

    if (k >= '1' && k <= '6') { applyTag(TAGS[Number(k) - 1].id, true); return; }
    if (k === '0') { applyTag('none', true); return; }

    if (k === 'h' || k === 'H') { transformOut('h'); return; }
    if (k === 'v' || k === 'V') { transformOut('v'); return; }
    if (k === 'b' || k === 'B') { transformOut('hv'); return; }
    if (k === 'r' || k === 'R') { transformOut('none'); return; }

    // E = 橡皮擦开关 / G = 切换「整块贴 / 逐个铺」
    if (k === 'e' || k === 'E') { setOutMode(S.outMode === 'erase' ? 'brush' : 'erase'); return; }
    if (k === 'g' || k === 'G') {
      const btn = $$('#segMode > button').find(x => x.dataset.mode === (S.blockMode ? 'flat' : 'block'));
      if (btn) btn.click();
      return;
    }

    if (k === 'Delete' || k === 'Backspace') { deleteOut(); e.preventDefault(); return; }
    if (k === 'Escape') { S.sel.clear(); clearOutSel(); reqSrc(); reqOut(); return; }
    if (k === ' ') { e.preventDefault(); doPlace(); return; }
  });

  /* ---- 拖入：.tsproj = 导入工程；图片 = 当素材 ---- */
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', async e => {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    if (/\.tsproj$/i.test(f.name)) { await dropProjectFile(f); return; }
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      S.sheet = {
        path: '', name: f.name, img: im,
        w: im.naturalWidth, h: im.naturalHeight,
        cols: Math.floor(im.naturalWidth / TILE), rows: Math.floor(im.naturalHeight / TILE)
      };
      S.cellCache = null; S.sel.clear();
      ensureCellCache();
      $('#srcMeta').textContent = f.name + '  ' + S.sheet.w + '×' + S.sheet.h + '  →  ' +
        S.sheet.cols + ' × ' + S.sheet.rows + ' = ' + (S.sheet.cols * S.sheet.rows) + ' 格';
      reqSrc();
      toast('已拖入 ' + f.name + '（' + (S.sheet.cols * S.sheet.rows) + ' 格，本地临时，未写盘）', 'ok');
    };
    im.src = url;
  });
}

/* ============================================================
   启动
   ============================================================ */
async function boot() {
  buildTagUI();
  buildTfUI();
  bindEvents();
  setPlaceTf('none');
  updateOutModeUI();
  updateHistUI();
  reqOut();

  // footer 前缀输入框
  const fi = document.createElement('input');
  fi.type = 'text'; fi.id = 'prefixInput'; fi.value = 'NEW'; fi.size = 8;
  fi.title = '「⚠ 写进工程 img/tilesets/」用的文件名前缀。\n普通导出用「工程名」做前缀放进工程文件夹，重名自动加 -2，不覆盖。';
  fi.style.width = '78px';
  const anchor = $('#outDirHint');
  anchor.parentNode.insertBefore(fi, anchor);
  const lab = document.createElement('span');
  lab.className = 'hint'; lab.textContent = '前缀';
  anchor.parentNode.insertBefore(lab, fi);

  try {
    const j = await api('/api/roots');
    S.roots = j.roots || [];
    S.mounts = j.mounts || [];
    S.exportDir = j.exportDir || j.outDir || '';
    S.toolOut = j.toolOut || '';
    S.desktop = j.desktop || '';
    S.rpgTilesets = j.rpgTilesets;
    S.mapSrc = j.mapSrc || '';

    // 导出目录：上次用的（且仍在白名单里）→ 桌面导出目录
    let od = '';
    try { od = localStorage.getItem('ts.outDir') || ''; } catch (e) { /* ignore */ }
    S.outDir = (od && S.roots.indexOf(od) >= 0) ? od : (S.exportDir || j.outDir);
    updateExportHint();

    buildRootSelect();
    buildDirSelect();

    // 默认素材目录：上次用的 → 「制作进行素材/地图素材」→ 工程 img/tilesets
    let target = '';
    try {
      const lastRoot = localStorage.getItem('ts.lastRoot');
      if (lastRoot && S.mounts.some(m => m.path === lastRoot)) target = lastRoot;
    } catch (e) { /* ignore */ }
    if (!target) target = S.mapSrc || S.rpgTilesets;
    if (target) await setRoot(target);
  } catch (e) {
    toast('初始化失败：' + e.message, 'err');
  }
  reqOut();
  requestAnimationFrame(fitOut);
}

/* 暴露给自动化自测 / 控制台调试（不影响正常使用） */
window.TS = {
  S, TAGS, TFS, SLOTS, TAG_BY_ID, TF_BY_ID, SLOT_BY_ID,
  cellCanvasOf, newCell, pushCell, doPlace, doVariants, transformOut,
  applyTag, assignByTag, compactOut, duplicateOut, deleteOut, drawCell,
  slotToCanvas, computeFlags, buildManifest, savePng, saveAllPng, saveJson, saveFlags,
  fitZoom, fitOut, openSheetByPath, loadSheetList, setRoot, reqSrc, reqOut, toast,
  // 整块贴相关
  selBlock, rectFree, findFreeRect, layoutBlocks, stampBlock, commitBrush, blockCellAt,
  blockCellsOf, selectWholeBlock, updateBlockInfo, buildRootSelect,
  setMode, setOutMode, setBlkFlip, updateOutModeUI,
  // 撤回 / 重做
  HIST, pushHist, undoStep, redoStep, updateHistUI, snapState, restoreState,
  // 变换群 & 选区「整块」口径
  tfBits, bitsToTf, tfOverlay, applyTf, selRectOut, clearOutSel,
  // 框选 & 橡皮
  applyOutRect, eraseOne, eraseBlockAt, updateOutSelInfo,
  // 导出目录
  setOutDir, buildDirSelect,
  // 工程包（.tsproj）
  projState, projCounts, projPreview, projDefaultName, applyProjState,
  saveProject, loadProject, openProjDialog, listProjects, updateProjUI,
  dropProjectFile, saveProjectOver,
  // ★ 每个工程一个文件夹 / 导出不重名
  projFolderName, exportRoot, ensureProjDir, updateExportHint,
  getProjDir: () => PROJ_DIR, resetProjDir: () => { PROJ_DIR = null; updateExportHint(); }
};

/* 供自测/控制台切换模式：'block' 整块贴 / 'flat' 逐个铺 */
function setMode(mode) {
  const btn = $$('#segMode > button').find(x => x.dataset.mode === mode);
  if (btn) btn.click();
  else S.blockMode = (mode === 'block');
  return S.blockMode;
}
/* 切换输出区鼠标模式：'brush' 刷块 / 'select' 框选 / 'erase' 橡皮 */
function setOutMode(mode) {
  S.outMode = mode;
  updateOutModeUI();
  return S.outMode;
}

/** 模式按钮高亮 + 提示文案 + 光标形状，集中在一处改 */
function updateOutModeUI() {
  $$('#segOutMode > button').forEach(b => b.classList.toggle('on', b.dataset.omode === S.outMode));
  const be = $('#btnErase');
  if (be) {
    be.classList.toggle('on', S.outMode === 'erase');
    be.textContent = S.outMode === 'erase' ? '🧽 橡皮（开）' : '🧽 橡皮(E)';
  }
  const h = $('#outHint');
  if (h) h.textContent = S.outMode === 'erase'
    ? '拖过即擦 · 单击擦整块 · Alt+单击 只擦单格'
    : (S.outMode === 'brush'
      ? '左键拖 = 整块平铺 · 单击选 1 格 · 双击选整块 · Alt 切框选'
      : '左键拖 = 矩形框选 · Shift 加选 · 双击选整块 · Alt 切刷块');
  document.body.classList.toggle('erasing', S.outMode === 'erase');
}
/* 供自测切换块翻转方式：'order' 整块镜像 / 'tile' 只翻每格 */
function setBlkFlip(mode) {
  const btn = $$('#segBlkFlip > button').find(x => x.dataset.bflip === mode);
  if (btn) btn.click();
  else S.blockFlip = mode;
  return S.blockFlip;
}

boot();
