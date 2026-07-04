<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import type {
  GraphData,
  GraphKind,
  StoryNode,
  StoryOption,
  NodeKind,
  VariableDef,
  QuestDef,
  Requirement,
  ProjectData,
} from "./types";
import { createNode, createGraph } from "./types";

const PROJECT_STORAGE_KEY = "cocos-story-map:project:v1";
const VIEW_STORAGE_KEY = "cocos-story-map:view:v1";
const SAVE_DEBOUNCE_MS = 350;

const variables = ref<VariableDef[]>([
  { id: "var_hasKey", name: "hasKey", type: "bool", initialValue: false },
  { id: "var_gold", name: "gold", type: "number", initialValue: 0 },
]);

const graphs = ref<GraphData[]>([
  createGraph({
    id: "g_main_1",
    name: "主线：任务1",
    kind: "mainline",
    nodes: [
      createNode({
        id: "n1",
        kind: "dialog",
        title: "任务1",
        speaker: "系统",
        text: "你好",
        position: { x: 200, y: 200 },
        options: [{ id: "o1", text: "前往下一个节点", targetNodeId: "n2" }],
      }),
    ],
  }),
  createGraph({
    id: "g_dungeon_1",
    name: "循环副本：史莱姆洞窟",
    kind: "dungeon",
    nodes: [],
  }),
]);

const quests = ref<QuestDef[]>([
  { id: "q1", name: "任务A", initialStatus: "NotStarted", graphId: "g_q1" },
  { id: "q2", name: "任务B", initialStatus: "NotStarted", graphId: "g_q2" },
]);

// 为每个任务提供独立画布（入口+结束）
if (!graphs.value.find((g) => g.id === "g_q1")) {
  graphs.value.push(
    createGraph({
      id: "g_q1",
      name: "任务：任务A",
      kind: "quest",
      nodes: [
        createNode({ id: "qe1", kind: "questEntry", position: { x: 200, y: 200 } }),
        createNode({ id: "qend1", kind: "taskEnd", questStatus: "Completed", position: { x: 520, y: 200 } }),
      ],
    }),
  );
}
if (!graphs.value.find((g) => g.id === "g_q2")) {
  graphs.value.push(
    createGraph({
      id: "g_q2",
      name: "任务：任务B",
      kind: "quest",
      nodes: [
        createNode({ id: "qe2", kind: "questEntry", position: { x: 200, y: 360 } }),
        createNode({ id: "qend2", kind: "taskEnd", questStatus: "Completed", position: { x: 520, y: 360 } }),
      ],
    }),
  );
}

const selectedGraphId = ref<string>(graphs.value[0].id);
const selectedNodeId = ref<string | null>("n1");

const currentGraph = computed<GraphData>(() => {
  return graphs.value.find((g) => g.id === selectedGraphId.value) ?? graphs.value[0];
});

const selectedNode = computed<StoryNode | null>(() => {
  if (!selectedNodeId.value) return null;
  return currentGraph.value.nodes.find((n) => n.id === selectedNodeId.value) ?? null;
});

const nodeById = computed(() => new Map(currentGraph.value.nodes.map((n) => [n.id, n] as const)));
const varById = computed(() => new Map(variables.value.map((v) => [v.id, v] as const)));
const questById = computed(() => new Map(quests.value.map((q) => [q.id, q] as const)));

const NODE_W = 220;
const NODE_PADDING_X = 8;
const PORT_SIZE = 10;
const INPUT_HIT_RADIUS = 12;
const layoutTick = ref(0);

const inputPortEls = new Map<string, HTMLElement>();
const optionPortEls = new Map<string, HTMLElement>();

function setInputPortRef(nodeId: string) {
  return (el: Element | null) => {
    if (el) inputPortEls.set(nodeId, el as HTMLElement);
    else inputPortEls.delete(nodeId);
  };
}

function setOptionPortRef(nodeId: string, optId: string) {
  const key = `${nodeId}:${optId}`;
  return (el: Element | null) => {
    if (el) optionPortEls.set(key, el as HTMLElement);
    else optionPortEls.delete(key);
  };
}
function estimateNodeHeight(node: StoryNode) {
  // 标题 + 文本 + 可选的 battle/item 行 + options 行 + 底部按钮区
  const base = 62;
  const extra = node.kind === "battle" || node.kind === "gainItem" ? 18 : 0;
  const optionsH = (node.options?.length ?? 0) * 16;
  const dialogH = node.kind === "dialog" ? (node.dialogLines?.length ?? 1) * 18 : 0;
  const bottom = 28;
  return base + extra + dialogH + optionsH + bottom;
}

function optionAnchorX(node: StoryNode) {
  // 选项右侧圆圈端口的中心点（和 CSS padding/端口尺寸保持一致）
  return node.position.x + NODE_W - NODE_PADDING_X - PORT_SIZE / 2;
}

function inputAnchorX(node: StoryNode) {
  // 左侧输入圆点中心点（CSS: left:-6px, size:10px）
  return node.position.x - 1;
}

function inputAnchorY(node: StoryNode) {
  const h = estimateNodeHeight(node);
  return node.position.y + h / 2;
}

function optionAnchorY(node: StoryNode, optIndex: number) {
  // 让连线/端口跟着“实际渲染的选项行”走
  const base = 54; // 标题+内容的基础高度（单行内容）
  const extra = node.kind === "battle" || node.kind === "gainItem" ? 18 : 0;
  const dialogExtra = node.kind === "dialog" ? Math.max(0, (node.dialogLines?.length ?? 1) - 1) * 18 : 0;
  // 额外 +6：对齐到端口圆圈的垂直中心（端口 10px，高度行 16px）
  return node.position.y + base + extra + dialogExtra + optIndex * 16 + 6;
}

type Edge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label: string;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  path: string;
  lx: number;
  ly: number;
};

const edges = computed<Edge[]>(() => {
  const byId = nodeById.value;
  const out: Edge[] = [];
  void layoutTick.value;

  for (const from of currentGraph.value.nodes) {
    from.options.forEach((opt, idx) => {
      if (!opt.targetNodeId) return;
      const to = byId.get(opt.targetNodeId);
      if (!to) return;

      const fromKey = `${from.id}:${opt.id}`;
      const fromEl = optionPortEls.get(fromKey);
      const toEl = inputPortEls.get(to.id);

      let sx: number;
      let sy: number;
      let tx: number;
      let ty: number;

      if (fromEl && toEl) {
        const fr = fromEl.getBoundingClientRect();
        const tr = toEl.getBoundingClientRect();
        const fw = clientToWorld(fr.left + fr.width / 2, fr.top + fr.height / 2);
        const tw = clientToWorld(tr.left + tr.width / 2, tr.top + tr.height / 2);
        sx = fw.x;
        sy = fw.y;
        tx = tw.x;
        ty = tw.y;
      } else {
        sx = optionAnchorX(from);
        sy = optionAnchorY(from, idx);
        tx = inputAnchorX(to);
        ty = inputAnchorY(to);
      }

      const dx = Math.max(80, Math.min(280, (tx - sx) * 0.5));
      const c1x = sx + dx;
      const c1y = sy;
      const c2x = tx - dx;
      const c2y = ty;
      const path = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;

      // label 放在中间偏上一点
      const lx = (sx + tx) / 2;
      const ly = (sy + ty) / 2 - 6;

      out.push({
        id: `${from.id}_${opt.id}_${to.id}`,
        fromNodeId: from.id,
        toNodeId: to.id,
        label: opt.text,
        sx,
        sy,
        tx,
        ty,
        path,
        lx,
        ly,
      });
    });
  }
  return out;
});

// 无限画布：viewport
const canvasEl = ref<HTMLElement | null>(null);
const viewX = ref(0);
const viewY = ref(0);
const viewScale = ref(1);
const isSpaceDown = ref(false);
const isPanning = ref(false);
const isLinking = ref(false);
const linkingFrom = ref<{ nodeId: string; optId: string; optIndex: number } | null>(null);
const linkingCursor = ref<{ x: number; y: number }>({ x: 0, y: 0 });

function clampScale(s: number) {
  return Math.max(0.25, Math.min(2.5, s));
}

function getCanvasSize() {
  if (!canvasEl.value) return { w: 0, h: 0 };
  const r = canvasEl.value.getBoundingClientRect();
  return { w: r.width, h: r.height };
}

function getNodeRect(node: StoryNode) {
  const h = estimateNodeHeight(node);
  return {
    x1: node.position.x,
    y1: node.position.y,
    x2: node.position.x + NODE_W,
    y2: node.position.y + h,
    w: NODE_W,
    h,
  };
}

function getGraphBounds(g: GraphData) {
  const nodes = g.nodes;
  if (nodes.length === 0) return null;
  let x1 = Number.POSITIVE_INFINITY;
  let y1 = Number.POSITIVE_INFINITY;
  let x2 = Number.NEGATIVE_INFINITY;
  let y2 = Number.NEGATIVE_INFINITY;
  for (const n of nodes) {
    const r = getNodeRect(n);
    x1 = Math.min(x1, r.x1);
    y1 = Math.min(y1, r.y1);
    x2 = Math.max(x2, r.x2);
    y2 = Math.max(y2, r.y2);
  }
  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
}

function fitToGraph(g: GraphData) {
  const bounds = getGraphBounds(g);
  const { w: cw, h: ch } = getCanvasSize();
  if (!bounds || cw <= 0 || ch <= 0) return;

  const padding = 90;
  const w = bounds.w + padding * 2;
  const h = bounds.h + padding * 2;
  const sx = cw / w;
  const sy = ch / h;
  const s = clampScale(Math.min(sx, sy));

  viewScale.value = s;
  viewX.value = padding - bounds.x1 * s + (cw - w * s) / 2;
  viewY.value = padding - bounds.y1 * s + (ch - h * s) / 2;
  layoutTick.value++;
}

function centerOnNode(nodeId: string | null) {
  if (!nodeId) return;
  const n = currentGraph.value.nodes.find((x) => x.id === nodeId);
  const { w: cw, h: ch } = getCanvasSize();
  if (!n || cw <= 0 || ch <= 0) return;
  const r = getNodeRect(n);
  const cx = r.x1 + r.w / 2;
  const cy = r.y1 + r.h / 2;
  viewX.value = cw / 2 - cx * viewScale.value;
  viewY.value = ch / 2 - cy * viewScale.value;
  layoutTick.value++;
}

function zoomBy(factor: number) {
  const { w: cw, h: ch } = getCanvasSize();
  if (cw <= 0 || ch <= 0) return;
  const mx = cw / 2;
  const my = ch / 2;
  const wx = (mx - viewX.value) / viewScale.value;
  const wy = (my - viewY.value) / viewScale.value;
  const nextScale = clampScale(viewScale.value * factor);
  viewScale.value = nextScale;
  viewX.value = mx - wx * nextScale;
  viewY.value = my - wy * nextScale;
  layoutTick.value++;
}

function resetView() {
  viewX.value = 0;
  viewY.value = 0;
  viewScale.value = 1;
  layoutTick.value++;
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code === "Space") {
    isSpaceDown.value = true;
    // 避免空格滚动页面
    e.preventDefault();
  }

  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === "KeyS") {
    e.preventDefault();
    saveProjectNow();
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === "KeyF") {
    e.preventDefault();
    fitToGraph(currentGraph.value);
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyF") {
    e.preventDefault();
    centerOnNode(selectedNodeId.value);
  }

  if (e.code === "Delete" || e.code === "Backspace") {
    const active = document.activeElement as HTMLElement | null;
    const tag = active?.tagName?.toLowerCase();
    const isTyping = !!active?.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
    if (isTyping) return;

    if (selectedNodeId.value) {
      e.preventDefault();
      deleteNode(selectedNodeId.value);
    }
  }
}
function onKeyUp(e: KeyboardEvent) {
  if (e.code === "Space") {
    isSpaceDown.value = false;
  }
}

function onCanvasPointerDown(e: PointerEvent) {
  // Space + 左键 / 中键：平移画布
  const wantPan = (isSpaceDown.value && e.button === 0) || e.button === 1;
  if (!wantPan) return;
  e.preventDefault();
  isPanning.value = true;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

  const startX = e.clientX;
  const startY = e.clientY;
  const ox = viewX.value;
  const oy = viewY.value;

  const prevUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";

  const onMove = (ev: PointerEvent) => {
    viewX.value = ox + (ev.clientX - startX);
    viewY.value = oy + (ev.clientY - startY);
    layoutTick.value++;
  };
  const onUp = () => {
    isPanning.value = false;
    document.body.style.userSelect = prevUserSelect;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function onCanvasWheel(e: WheelEvent) {
  if (!canvasEl.value) return;
  e.preventDefault();

  const rect = canvasEl.value.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // 鼠标下的世界坐标
  const wx = (mx - viewX.value) / viewScale.value;
  const wy = (my - viewY.value) / viewScale.value;

  const delta = e.deltaY;
  const zoomFactor = delta > 0 ? 0.92 : 1.08;
  const nextScale = clampScale(viewScale.value * zoomFactor);

  // 保持鼠标指向的世界点不动
  viewScale.value = nextScale;
  viewX.value = mx - wx * nextScale;
  viewY.value = my - wy * nextScale;
  layoutTick.value++;
}

function clientToWorld(clientX: number, clientY: number) {
  if (!canvasEl.value) return { x: 0, y: 0 };
  const rect = canvasEl.value.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  return {
    x: (mx - viewX.value) / viewScale.value,
    y: (my - viewY.value) / viewScale.value,
  };
}

const canvasGridStyle = computed(() => {
  const step = 48 * viewScale.value;
  return {
    backgroundSize: `${step}px ${step}px`,
    backgroundPosition: `${viewX.value}px ${viewY.value}px`,
  };
});

const viewportStyle = computed(() => ({
  transform: `translate3d(${viewX.value}px, ${viewY.value}px, 0) scale(${viewScale.value})`,
}));

onMounted(() => {
  // 自动恢复上次草稿
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    const parsed = raw ? tryParseProject(raw) : null;
    if (parsed) loadProject(parsed);

    const viewRaw = localStorage.getItem(VIEW_STORAGE_KEY);
    if (viewRaw) {
      const v = JSON.parse(viewRaw) as Partial<{
        viewX: number;
        viewY: number;
        viewScale: number;
        selectedGraphId: string;
      }>;
      if (typeof v.viewX === "number") viewX.value = v.viewX;
      if (typeof v.viewY === "number") viewY.value = v.viewY;
      if (typeof v.viewScale === "number") viewScale.value = clampScale(v.viewScale);
      if (typeof v.selectedGraphId === "string" && graphs.value.some((g) => g.id === v.selectedGraphId)) {
        selectedGraphId.value = v.selectedGraphId;
      }
      layoutTick.value++;
    }
  } catch {
    // ignore
  }

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  nextTick(() => fitToGraph(currentGraph.value));
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
});

function addGraph(kind: GraphKind) {
  const g = createGraph({
    kind,
    name: kind === "mainline" ? "主线：新画布" : kind === "dungeon" ? "循环副本：新画布" : "任务：新画布",
    nodes: [],
  });
  graphs.value.push(g);
  selectedGraphId.value = g.id;
  selectedNodeId.value = null;
}

function selectGraph(id: string) {
  selectedGraphId.value = id;
  selectedNodeId.value = currentGraph.value.nodes[0]?.id ?? null;
  nextTick(() => fitToGraph(currentGraph.value));
}

function addNode(kind: NodeKind) {
  // 在当前视野中心附近创建
  const baseX = (-viewX.value + 300) / viewScale.value;
  const baseY = (-viewY.value + 160 + currentGraph.value.nodes.length * 20) / viewScale.value;
  const node = createNode({
    kind,
    position: { x: baseX, y: baseY },
  });
  currentGraph.value.nodes.push(node);
  selectedNodeId.value = node.id;
  nextTick(() => centerOnNode(node.id));
}

function onNodePointerDown(event: PointerEvent, node: StoryNode) {
  if (isSpaceDown.value) return; // 空格按下时是平移画布
  if (event.button !== 0) return;

  // 点在输入框/按钮等交互元素上时，不进入拖拽（否则会导致删除/编辑失效）
  const t = event.target as HTMLElement | null;
  if (t && t.closest("button,input,textarea,select,label")) return;

  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

  const startX = event.clientX;
  const startY = event.clientY;
  const origin = { ...node.position };

  selectedNodeId.value = node.id;

  const prevUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";

  const onMove = (e: PointerEvent) => {
    const dx = (e.clientX - startX) / viewScale.value;
    const dy = (e.clientY - startY) / viewScale.value;
    node.position.x = origin.x + dx;
    node.position.y = origin.y + dy;
    layoutTick.value++;
  };

  const onUp = () => {
    document.body.style.userSelect = prevUserSelect;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function addVariable() {
  variables.value.push({
    id: `var_${crypto.randomUUID()}`,
    name: "newVar",
    type: "bool",
    initialValue: false,
  });
}

function addQuest() {
  const qid = `q_${crypto.randomUUID()}`;
  const gid = `g_${qid}`;
  quests.value.push({ id: qid, name: "新任务", initialStatus: "NotStarted", graphId: gid });
  graphs.value.push(
    createGraph({
      id: gid,
      name: `任务：新任务`,
      kind: "quest",
      nodes: [
        createNode({ kind: "questEntry", position: { x: 200, y: 200 } }),
        createNode({ kind: "taskEnd", questStatus: "Completed", position: { x: 520, y: 200 } }),
      ],
    }),
  );
}

function requirementLabel(r: Requirement) {
  if (r.kind === "questStatus") {
    const q = questById.value.get(r.questId);
    return `任务 ${q ? q.name : r.questId} = ${r.status}`;
  }
  const v = varById.value.get(r.varId);
  return `变量 ${v ? v.name : r.varId} == ${String(r.value)}`;
}

function addQuestRequirement(node: StoryNode) {
  if (node.kind !== "condition") return;
  const q = quests.value[0];
  node.requirements = node.requirements ?? [];
  node.requirements.push({
    kind: "questStatus",
    questId: q?.id ?? "",
    status: "Completed",
  });
}

function addVarRequirement(node: StoryNode) {
  if (node.kind !== "condition") return;
  const v = variables.value[0];
  node.requirements = node.requirements ?? [];
  node.requirements.push({
    kind: "varEquals",
    varId: v?.id ?? "",
    value: v?.type === "number" ? 0 : v?.type === "string" ? "" : false,
  });
}

function deleteRequirement(node: StoryNode, idx: number) {
  if (node.kind !== "condition") return;
  node.requirements = (node.requirements ?? []).filter((_, i) => i !== idx);
}

function startLink(event: PointerEvent, node: StoryNode, opt: StoryOption, optIndex: number) {
  event.preventDefault();
  event.stopPropagation();
  isLinking.value = true;
  linkingFrom.value = { nodeId: node.id, optId: opt.id, optIndex };
  linkingCursor.value = clientToWorld(event.clientX, event.clientY);

  const onMove = (e: PointerEvent) => {
    linkingCursor.value = clientToWorld(e.clientX, e.clientY);
    layoutTick.value++;
  };

  const onUp = (e: PointerEvent) => {
    const world = clientToWorld(e.clientX, e.clientY);
    // 松手时命中“输入圆点”或节点主体区域都算绑定（更宽松更好用）
    const target = currentGraph.value.nodes
      .filter((n) => n.id !== node.id)
      .find((n) => {
        const el = inputPortEls.get(n.id);
        const a = el
          ? clientToWorld(
              el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2,
              el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2,
            )
          : { x: inputAnchorX(n), y: inputAnchorY(n) };
        const ax = a.x;
        const ay = a.y;
        const dx = world.x - ax;
        const dy = world.y - ay;
        const r = INPUT_HIT_RADIUS * 1.35;
        if (dx * dx + dy * dy <= r * r) return true;

        const nr = getNodeRect(n);
        const margin = 14;
        return (
          world.x >= nr.x1 - margin &&
          world.x <= nr.x2 + margin &&
          world.y >= nr.y1 - margin &&
          world.y <= nr.y2 + margin
        );
      });

    const from = linkingFrom.value;
    if (from) {
      const fromNode = currentGraph.value.nodes.find((n) => n.id === from.nodeId);
      const option = fromNode?.options.find((o) => o.id === from.optId);
      if (option) {
        if (target) {
          option.targetNodeId = target.id;
          option.isEnd = false;
        } else {
          option.targetNodeId = undefined;
        }
      }
    }

    isLinking.value = false;
    linkingFrom.value = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function finishLinkToNode(targetNodeId: string) {
  if (!isLinking.value || !linkingFrom.value) return;
  const fromNode = currentGraph.value.nodes.find((n) => n.id === linkingFrom.value!.nodeId);
  const option = fromNode?.options.find((o) => o.id === linkingFrom.value!.optId);
  if (option && targetNodeId && targetNodeId !== fromNode?.id) {
    option.targetNodeId = targetNodeId;
    option.isEnd = false;
  }
  isLinking.value = false;
  linkingFrom.value = null;
  layoutTick.value++;
}

function onNodePointerUp(e: PointerEvent, nodeId: string) {
  // 只有在“连线拖拽”时才拦截 pointerup
  // 否则会阻断 window 的 pointerup 监听，导致节点拖拽无法松手结束
  if (!isLinking.value) return;
  e.preventDefault();
  e.stopPropagation();
  finishLinkToNode(nodeId);
}

const linkingEdge = computed(() => {
  if (!isLinking.value || !linkingFrom.value) return null;
  const fromNode = currentGraph.value.nodes.find((n) => n.id === linkingFrom.value!.nodeId);
  if (!fromNode) return null;
  void layoutTick.value;
  const fromKey = `${fromNode.id}:${linkingFrom.value.optId}`;
  const fromEl = optionPortEls.get(fromKey);
  const s = fromEl
    ? clientToWorld(
        fromEl.getBoundingClientRect().left + fromEl.getBoundingClientRect().width / 2,
        fromEl.getBoundingClientRect().top + fromEl.getBoundingClientRect().height / 2,
      )
    : { x: optionAnchorX(fromNode), y: optionAnchorY(fromNode, linkingFrom.value.optIndex) };
  const sx = s.x;
  const sy = s.y;
  const tx = linkingCursor.value.x;
  const ty = linkingCursor.value.y;
  const dx = Math.max(80, Math.min(280, (tx - sx) * 0.5));
  const c1x = sx + dx;
  const c1y = sy;
  const c2x = tx - dx;
  const c2y = ty;
  const path = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
  return { path };
});

function addOption(node: StoryNode) {
  node.options.push({
    id: `opt_${Date.now()}_${node.options.length}`,
    text: "新的选项",
  });
}

function deleteNode(nodeId: string) {
  currentGraph.value.nodes = currentGraph.value.nodes.filter((n) => n.id !== nodeId);
  if (selectedNodeId.value === nodeId) {
    selectedNodeId.value = currentGraph.value.nodes[0]?.id ?? null;
  }
  currentGraph.value.nodes.forEach((n) => {
    n.options = n.options.map((o) => ({
      ...o,
      targetNodeId: o.targetNodeId === nodeId ? undefined : o.targetNodeId,
    }));
  });
}

function linkOptionToNode(option: StoryOption, targetId: string) {
  option.targetNodeId = targetId || undefined;
}

function getOptionTargetText(opt: StoryOption) {
  if (opt.isEnd) return "结束";
  if (!opt.targetNodeId) return "未连接";
  const n = nodeById.value.get(opt.targetNodeId);
  return n ? n.title : opt.targetNodeId;
}

function ensureDialogLines(node: StoryNode) {
  if (node.kind !== "dialog") return;
  if (!node.dialogLines || node.dialogLines.length === 0) {
    node.dialogLines = [{ id: `line_${crypto.randomUUID()}`, text: (node.text ?? "").trim() }];
  }
  // 保持兼容：把老的 text 当作第一句
  if (node.text && node.dialogLines[0] && node.dialogLines[0].text.trim() === "") {
    node.dialogLines[0].text = node.text;
  }
}

function addDialogLine(node: StoryNode) {
  ensureDialogLines(node);
  node.dialogLines!.push({ id: `line_${crypto.randomUUID()}`, text: "" });
}

function deleteDialogLine(node: StoryNode, lineId: string) {
  ensureDialogLines(node);
  node.dialogLines = node.dialogLines!.filter((l) => l.id !== lineId);
  if (node.dialogLines.length === 0) {
    node.dialogLines = [{ id: `line_${crypto.randomUUID()}`, text: "" }];
  }
}

function moveDialogLine(node: StoryNode, lineId: string, dir: -1 | 1) {
  ensureDialogLines(node);
  const idx = node.dialogLines!.findIndex((l) => l.id === lineId);
  const j = idx + dir;
  if (idx < 0 || j < 0 || j >= node.dialogLines!.length) return;
  const next = [...node.dialogLines!];
  const tmp = next[idx];
  next[idx] = next[j];
  next[j] = tmp;
  node.dialogLines = next;
}

function getDialogLines(node: StoryNode) {
  if (node.kind !== "dialog") return [];
  ensureDialogLines(node);
  return node.dialogLines ?? [];
}

function clearOptionLink(opt: StoryOption) {
  opt.targetNodeId = undefined;
}

function onOptionEndChange(opt: StoryOption) {
  if (opt.isEnd) {
    opt.targetNodeId = undefined;
  }
}

function normalizeYesNo(node: StoryNode) {
  node.options = [
    node.options[0] ? { ...node.options[0], text: "是" } : { id: `opt_${crypto.randomUUID()}`, text: "是" },
    node.options[1] ? { ...node.options[1], text: "否" } : { id: `opt_${crypto.randomUUID()}`, text: "否" },
  ];
}

function normalizeWinLose(node: StoryNode) {
  node.options = [
    node.options[0] ? { ...node.options[0], text: "胜利" } : { id: `opt_${crypto.randomUUID()}`, text: "胜利" },
    node.options[1] ? { ...node.options[1], text: "失败" } : { id: `opt_${crypto.randomUUID()}`, text: "失败" },
  ];
}

function exportJson() {
  const json = JSON.stringify(
    {
      variables: variables.value,
      quests: quests.value,
      graphs: graphs.value,
    },
    null,
    2,
  );
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `story_project_${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function tryParseProject(raw: string): ProjectData | null {
  try {
    const obj = JSON.parse(raw) as Partial<ProjectData>;
    if (!obj || typeof obj !== "object") return null;
    if (!Array.isArray(obj.graphs) || !Array.isArray(obj.variables) || !Array.isArray(obj.quests)) return null;
    return obj as ProjectData;
  } catch {
    return null;
  }
}

function normalizeLoadedProject(p: ProjectData): ProjectData {
  const graphsN = (p.graphs ?? []).map((g) =>
    createGraph({
      id: g.id,
      name: g.name,
      kind: g.kind,
      nodes: (g.nodes ?? []).map((n) =>
        createNode({
          ...n,
          id: n.id,
          kind: n.kind,
          title: n.title,
          text: n.text,
          position: n.position,
          options: (n.options ?? []).map((o) => ({
            id: o.id ?? `opt_${crypto.randomUUID()}`,
            text: o.text ?? "",
            targetNodeId: o.targetNodeId,
            isEnd: o.isEnd,
          })),
        }),
      ),
    }),
  );

  return {
    variables: (p.variables ?? []).map((v) => ({
      id: v.id ?? `var_${crypto.randomUUID()}`,
      name: v.name ?? "var",
      type: v.type ?? "bool",
      initialValue: v.initialValue ?? false,
    })),
    quests: (p.quests ?? []).map((q) => ({
      id: q.id ?? `q_${crypto.randomUUID()}`,
      name: q.name ?? "任务",
      initialStatus: q.initialStatus ?? "NotStarted",
      graphId: q.graphId ?? "",
    })),
    graphs: graphsN,
  };
}

function loadProject(p: ProjectData) {
  const normalized = normalizeLoadedProject(p);
  variables.value = normalized.variables;
  quests.value = normalized.quests;
  graphs.value = normalized.graphs.length ? normalized.graphs : graphs.value;

  selectedGraphId.value = graphs.value[0]?.id ?? selectedGraphId.value;
  selectedNodeId.value = currentGraph.value.nodes[0]?.id ?? null;
  nextTick(() => fitToGraph(currentGraph.value));
}

function saveProjectNow() {
  const data: ProjectData = {
    variables: variables.value,
    quests: quests.value,
    graphs: graphs.value,
  };
  try {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(
      VIEW_STORAGE_KEY,
      JSON.stringify({
        viewX: viewX.value,
        viewY: viewY.value,
        viewScale: viewScale.value,
        selectedGraphId: selectedGraphId.value,
      }),
    );
  } catch {
    // ignore (storage full / blocked)
  }
}

const fileInputEl = ref<HTMLInputElement | null>(null);
function triggerImport() {
  fileInputEl.value?.click();
}
function onImportFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const raw = String(reader.result ?? "");
    const parsed = tryParseProject(raw);
    if (parsed) loadProject(parsed);
    input.value = "";
  };
  reader.readAsText(file, "utf-8");
}

function clearLocalDraft() {
  try {
    localStorage.removeItem(PROJECT_STORAGE_KEY);
    localStorage.removeItem(VIEW_STORAGE_KEY);
  } catch {
    // ignore
  }
}

let saveTimer: number | null = null;
function scheduleSave() {
  if (saveTimer != null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    saveProjectNow();
  }, SAVE_DEBOUNCE_MS);
}

watch([variables, quests, graphs], scheduleSave, { deep: true });
watch([viewX, viewY, viewScale, selectedGraphId], scheduleSave);
</script>

<template>
  <div class="app-root">
    <header class="app-toolbar">
      <div>
        <strong>剧情思维导图</strong>
        <span style="margin-left: 8px; font-size: 13px; color: #9ca3af">
          {{ currentGraph.name }}
        </span>
        <span style="margin-left: 8px; font-size: 12px; color: #6b7280">
          （{{
            currentGraph.kind === "mainline" ? "主线剧情" : currentGraph.kind === "dungeon" ? "循环副本" : "任务画布"
          }}）
        </span>
      </div>
      <div>
        <input
          ref="fileInputEl"
          type="file"
          accept="application/json"
          style="display: none"
          @change="onImportFileChange"
        />
        <button class="btn" @click="triggerImport">导入 JSON</button>
        <button class="btn" @click="exportJson">导出 JSON</button>
        <button class="btn" @click="fitToGraph(currentGraph)">适配视野</button>
        <button class="btn" @click="centerOnNode(selectedNodeId)">定位选中</button>
        <button class="btn" @click="zoomBy(1.12)">+</button>
        <button class="btn" @click="zoomBy(0.89)">-</button>
        <button class="btn" @click="resetView">复位</button>
        <button class="btn" @click="clearLocalDraft">清空本地草稿</button>
      </div>
    </header>

    <main class="app-layout">
      <section class="panel">
        <div style="font-size: 13px; margin-bottom: 6px; color: #9ca3af">剧情列表</div>

        <div style="display: flex; gap: 6px; margin-bottom: 8px">
          <button class="btn btn-primary" @click="addGraph('mainline')">+ 主线</button>
          <button class="btn" @click="addGraph('dungeon')">+ 循环副本</button>
        </div>

        <div style="margin-bottom: 10px">
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px">主线</div>
          <button
            v-for="g in graphs.filter((x) => x.kind === 'mainline')"
            :key="g.id"
            class="btn"
            :style="{
              width: '100%',
              textAlign: 'left',
              marginBottom: '4px',
              borderColor: g.id === selectedGraphId ? '#38bdf8' : undefined,
            }"
            @click="selectGraph(g.id)"
          >
            {{ g.name }}
          </button>

          <div style="font-size: 12px; color: #6b7280; margin: 8px 0 4px">循环副本</div>
          <button
            v-for="g in graphs.filter((x) => x.kind === 'dungeon')"
            :key="g.id"
            class="btn"
            :style="{
              width: '100%',
              textAlign: 'left',
              marginBottom: '4px',
              borderColor: g.id === selectedGraphId ? '#38bdf8' : undefined,
            }"
            @click="selectGraph(g.id)"
          >
            {{ g.name }}
          </button>

          <div style="font-size: 12px; color: #6b7280; margin: 8px 0 4px">任务</div>
          <button
            v-for="g in graphs.filter((x) => x.kind === 'quest')"
            :key="g.id"
            class="btn"
            :style="{
              width: '100%',
              textAlign: 'left',
              marginBottom: '4px',
              borderColor: g.id === selectedGraphId ? '#38bdf8' : undefined,
            }"
            @click="selectGraph(g.id)"
          >
            {{ g.name }}
          </button>
        </div>

        <div style="font-size: 13px; margin: 10px 0 6px; color: #9ca3af">节点工具箱</div>
        <div class="palette-item" @click="addNode('dialog')">
          <div>对话节点</div>
          <div style="font-size: 11px; color: #6b7280">角色 + 文本 + 选项跳转</div>
        </div>
        <div class="palette-item" @click="addNode('choice')">
          <div>选择节点</div>
          <div style="font-size: 11px; color: #6b7280">多个选项，分支到不同节点或结束</div>
        </div>
        <div class="palette-item" @click="addNode('battle')">
          <div>战斗节点</div>
          <div style="font-size: 11px; color: #6b7280">配置 enemyId，胜/败用选项表示</div>
        </div>
        <div class="palette-item" @click="addNode('gainItem')">
          <div>获得物品节点</div>
          <div style="font-size: 11px; color: #6b7280">配置 itemId / 数量</div>
        </div>
        <div class="palette-item" @click="addNode('loseItem')">
          <div>失去物品节点</div>
          <div style="font-size: 11px; color: #6b7280">配置 itemId / 数量（扣除）</div>
        </div>
        <div class="palette-item" @click="addNode('setVar')">
          <div>设置变量节点</div>
          <div style="font-size: 11px; color: #6b7280">设置一个变量的值</div>
        </div>
        <div class="palette-item" @click="addNode('questUpdate')">
          <div>任务更新节点</div>
          <div style="font-size: 11px; color: #6b7280">把任务设置到某个状态</div>
        </div>
        <div class="palette-item" @click="addNode('condition')">
          <div>条件分支节点</div>
          <div style="font-size: 11px; color: #6b7280">ALL/ANY 条件 → 满足/不满足两路</div>
        </div>

        <div style="font-size: 13px; margin: 14px 0 6px; color: #9ca3af">变量 / 任务</div>
        <button class="btn" style="width: 100%; text-align: left; margin-bottom: 6px" @click="addVariable">
          + 新变量
        </button>
        <div v-for="v in variables" :key="v.id" class="card">
          <div class="kv-row">
            <input v-model="v.name" @pointerdown.stop />
            <select v-model="v.type" @pointerdown.stop>
              <option value="bool">bool</option>
              <option value="number">number</option>
              <option value="string">string</option>
            </select>
          </div>
        </div>

        <button
          class="btn"
          style="width: 100%; text-align: left; margin-bottom: 6px; margin-top: 6px"
          @click="addQuest"
        >
          + 新任务
        </button>
        <div v-for="q in quests" :key="q.id" class="card">
          <div class="kv-row wide-select">
            <input v-model="q.name" @pointerdown.stop />
            <select v-model="q.initialStatus" @pointerdown.stop>
              <option value="NotStarted">NotStarted</option>
              <option value="InProgress">InProgress</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>
      </section>

      <section
        ref="canvasEl"
        class="canvas"
        :style="{ cursor: isSpaceDown || isPanning ? 'grabbing' : 'default' }"
        @pointerdown="onCanvasPointerDown"
        @wheel="onCanvasWheel"
      >
        <div class="canvas-grid" :style="canvasGridStyle"></div>

        <div class="viewport" :style="viewportStyle">
          <svg class="edges-layer" :width="12000" :height="12000" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker
                id="arrow"
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L8,3 L0,6 Z" fill="#93c5fd" />
              </marker>
            </defs>

            <g v-for="e in edges" :key="e.id">
              <path :d="e.path" stroke="#0b1220" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.35" />
              <path
                :d="e.path"
                stroke="#60a5fa"
                stroke-width="2"
                fill="none"
                stroke-linecap="round"
                marker-end="url(#arrow)"
                opacity="0.9"
              />
              <text :x="e.lx" :y="e.ly" fill="#c7d2fe" font-size="11" text-anchor="middle">
                {{ e.label }}
              </text>
            </g>

            <g v-if="linkingEdge">
              <path
                :d="linkingEdge.path"
                stroke="#0b1220"
                stroke-width="6"
                fill="none"
                stroke-linecap="round"
                opacity="0.35"
              />
              <path
                :d="linkingEdge.path"
                stroke="#fbbf24"
                stroke-width="2"
                fill="none"
                stroke-linecap="round"
                marker-end="url(#arrow)"
                opacity="0.95"
              />
            </g>
          </svg>

          <div
            v-for="node in currentGraph.nodes"
            :key="node.id"
            class="node-box"
            :class="{ selected: node.id === selectedNodeId }"
            :style="{
              transform: `translate3d(${node.position.x}px, ${node.position.y}px, 0)`,
            }"
            @pointerdown.stop="onNodePointerDown($event, node)"
            @pointerup="onNodePointerUp($event, node.id)"
          >
            <span class="input-port" :class="{ active: isLinking }" :ref="setInputPortRef(node.id)"></span>
            <div class="node-title">
              <span class="node-type-pill">
                {{
                  node.kind === "dialog"
                    ? "对话"
                    : node.kind === "choice"
                      ? "选择"
                      : node.kind === "battle"
                        ? "战斗"
                        : node.kind === "gainItem"
                          ? "获得"
                          : node.kind === "loseItem"
                            ? "失去"
                            : node.kind === "setVar"
                              ? "变量"
                              : node.kind === "questUpdate"
                                ? "任务"
                                : "条件"
                }}
              </span>
              <span style="margin-left: 6px">{{ node.title }}</span>
            </div>
            <div class="node-content">
              <span v-if="node.kind === 'dialog' && node.speaker" style="color: #93c5fd"> {{ node.speaker }}： </span>
              <template v-if="node.kind === 'dialog'">
                <div v-for="line in getDialogLines(node)" :key="line.id" class="dialog-line">
                  {{ line.text || "（空）" }}
                </div>
              </template>
              <template v-else>
                {{ node.text || "（空）" }}
              </template>
            </div>
            <div v-if="node.kind === 'battle'" style="font-size: 12px; color: #fca5a5; margin-top: 2px">
              enemyId：{{ node.enemyId || "（未填）" }}
            </div>
            <div v-if="node.kind === 'gainItem'" style="font-size: 12px; color: #a7f3d0; margin-top: 2px">
              + {{ node.itemId || "（未填 itemId）" }} × {{ node.itemCount ?? 1 }}
            </div>
            <div v-if="node.kind === 'loseItem'" style="font-size: 12px; color: #fca5a5; margin-top: 2px">
              - {{ node.itemId || "（未填 itemId）" }} × {{ node.itemCount ?? 1 }}
            </div>
            <div v-if="node.kind === 'setVar'" style="font-size: 12px; color: #fde68a; margin-top: 2px">
              set {{ varById.get(node.varId || "")?.name || "（未选变量）" }} = {{ String(node.varValue ?? "") }}
            </div>
            <div v-if="node.kind === 'questUpdate'" style="font-size: 12px; color: #c4b5fd; margin-top: 2px">
              quest {{ questById.get(node.questId || "")?.name || "（未选任务）" }} →
              {{ node.questStatus || "（未选状态）" }}
            </div>
            <div v-if="node.kind === 'condition'" style="font-size: 12px; color: #93c5fd; margin-top: 2px">
              {{ node.conditionMode || "ALL" }}：{{ node.requirements?.length ?? 0 }} 条
            </div>
            <div v-for="(opt, idx) in node.options" :key="opt.id" class="node-option">
              <span class="option-text">
                {{ opt.text }}
                <span style="color: #9ca3af"> → {{ getOptionTargetText(opt) }}</span>
              </span>
              <span
                class="option-port"
                title="拖动绑定到目标节点"
                @pointerdown="startLink($event, node, opt, idx)"
                :ref="setOptionPortRef(node.id, opt.id)"
              ></span>
            </div>
            <div style="margin-top: 6px; text-align: right">
              <button class="btn" style="font-size: 11px" @pointerdown.stop @click.stop="deleteNode(node.id)">
                删除
              </button>
            </div>
          </div>
        </div>

        <div class="canvas-hint">滚轮缩放｜空格+拖拽平移（或中键拖拽）</div>
      </section>

      <section class="panel panel-right">
        <div style="font-size: 13px; margin-bottom: 8px; color: #9ca3af">节点属性</div>
        <div v-if="selectedNode">
          <div class="field">
            <label>节点类型</label>
            <select v-model="selectedNode.kind">
              <option value="dialog">对话</option>
              <option value="choice">选择</option>
              <option value="battle">战斗</option>
              <option value="gainItem">获得物品</option>
              <option value="loseItem">失去物品</option>
              <option value="setVar">设置变量</option>
              <option value="questUpdate">任务更新</option>
              <option value="condition">条件分支</option>
            </select>
          </div>
          <div class="field">
            <label>标题（比如：任务1 / 战斗 / 掉落）</label>
            <input v-model="selectedNode.title" />
          </div>

          <div v-if="selectedNode.kind === 'dialog'" class="field">
            <label>说话人（speaker）</label>
            <input v-model="selectedNode.speaker" placeholder="比如：旁白 / NPC_001" />
          </div>

          <div v-if="selectedNode.kind === 'dialog'" class="field">
            <label>对白分段（多段）</label>
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px">
              一个节点内可写多句对白，会按顺序播放。
            </div>
            <div
              v-for="line in (ensureDialogLines(selectedNode), selectedNode.dialogLines!)"
              :key="line.id"
              style="margin-bottom: 6px"
            >
              <textarea v-model="line.text" placeholder="这一段对白…" @pointerdown.stop style="min-height: 44px" />
              <div style="margin-top: 4px; display: flex; gap: 6px; justify-content: flex-end">
                <button class="btn" @pointerdown.stop @click="moveDialogLine(selectedNode, line.id, -1)">上移</button>
                <button class="btn" @pointerdown.stop @click="moveDialogLine(selectedNode, line.id, 1)">下移</button>
                <button class="btn" @pointerdown.stop @click="deleteDialogLine(selectedNode, line.id)">删除段</button>
              </div>
            </div>
            <button class="btn" @pointerdown.stop @click="addDialogLine(selectedNode)">+ 增加一段</button>
          </div>

          <div v-else class="field">
            <label>文本（说明）</label>
            <textarea v-model="selectedNode.text" @pointerdown.stop />
          </div>

          <div v-if="selectedNode.kind === 'battle'" class="field">
            <label>enemyId（战斗配置）</label>
            <input v-model="selectedNode.enemyId" placeholder="比如：slime_01" />
          </div>

          <div v-if="selectedNode.kind === 'battle'" class="field">
            <label>战斗分支</label>
            <button class="btn" @pointerdown.stop @click="normalizeWinLose(selectedNode)">一键变成「胜利/失败」</button>
          </div>

          <div v-if="selectedNode.kind === 'gainItem' || selectedNode.kind === 'loseItem'" class="field">
            <label>itemId</label>
            <input v-model="selectedNode.itemId" placeholder="比如：gold / potion_small" />
            <div style="height: 6px"></div>
            <label>数量（itemCount）</label>
            <input
              :value="selectedNode.itemCount ?? 1"
              type="number"
              min="1"
              @input="selectedNode.itemCount = Number(($event.target as HTMLInputElement).value || 1)"
            />
          </div>

          <div v-if="selectedNode.kind === 'setVar'" class="field">
            <label>变量</label>
            <select v-model="selectedNode.varId" @pointerdown.stop>
              <option v-for="v in variables" :key="v.id" :value="v.id">{{ v.name }} ({{ v.type }})</option>
            </select>
            <div style="height: 6px"></div>
            <label>值</label>
            <input
              v-if="varById.get(selectedNode.varId || '')?.type !== 'bool'"
              :value="String(selectedNode.varValue ?? '')"
              @pointerdown.stop
              @input="selectedNode.varValue = ($event.target as HTMLInputElement).value as any"
            />
            <label v-else style="display: flex; align-items: center; gap: 6px; margin-top: 4px">
              <input
                type="checkbox"
                :checked="Boolean(selectedNode.varValue)"
                @pointerdown.stop
                @change="selectedNode.varValue = ($event.target as HTMLInputElement).checked"
              />
              true/false
            </label>
          </div>

          <div v-if="selectedNode.kind === 'questUpdate'" class="field">
            <label>任务</label>
            <select v-model="selectedNode.questId" @pointerdown.stop>
              <option v-for="q in quests" :key="q.id" :value="q.id">{{ q.name }}</option>
            </select>
            <div style="height: 6px"></div>
            <label>状态</label>
            <select v-model="selectedNode.questStatus" @pointerdown.stop>
              <option value="NotStarted">NotStarted</option>
              <option value="InProgress">InProgress</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          <div v-if="selectedNode.kind === 'condition'" class="field">
            <label>条件模式</label>
            <select v-model="selectedNode.conditionMode" @pointerdown.stop>
              <option value="ALL">ALL（全部满足）</option>
              <option value="ANY">ANY（任意满足）</option>
            </select>
            <div style="height: 6px"></div>
            <label>条件列表</label>
            <div
              v-for="(r, idx) in selectedNode.requirements || []"
              :key="idx"
              style="border: 1px solid #1f2933; padding: 6px; border-radius: 6px; margin-bottom: 6px"
            >
              <div style="font-size: 12px; color: #c7d2fe; margin-bottom: 4px">{{ requirementLabel(r) }}</div>
              <div v-if="r.kind === 'questStatus'" style="display: flex; gap: 6px">
                <select v-model="r.questId" @pointerdown.stop style="flex: 1">
                  <option v-for="q in quests" :key="q.id" :value="q.id">{{ q.name }}</option>
                </select>
                <select v-model="r.status" @pointerdown.stop style="width: 130px">
                  <option value="NotStarted">NotStarted</option>
                  <option value="InProgress">InProgress</option>
                  <option value="Completed">Completed</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>
              <div v-else style="display: flex; gap: 6px">
                <select v-model="r.varId" @pointerdown.stop style="flex: 1">
                  <option v-for="v in variables" :key="v.id" :value="v.id">{{ v.name }} ({{ v.type }})</option>
                </select>
                <input
                  :value="String(r.value)"
                  @pointerdown.stop
                  @input="r.value = ($event.target as HTMLInputElement).value as any"
                  style="width: 120px"
                />
              </div>
              <div style="margin-top: 6px; text-align: right">
                <button class="btn" @pointerdown.stop @click="deleteRequirement(selectedNode, idx)">删除条件</button>
              </div>
            </div>
            <div style="display: flex; gap: 6px">
              <button class="btn" @pointerdown.stop @click="addQuestRequirement(selectedNode)">+ 任务条件</button>
              <button class="btn" @pointerdown.stop @click="addVarRequirement(selectedNode)">+ 变量条件</button>
            </div>
            <div style="margin-top: 6px; font-size: 11px; color: #6b7280">
              示例：加两条“任务=Completed”，模式选 ALL，即表示“两个任务都结束才满足”。
            </div>
          </div>

          <div class="field">
            <label>选项（每个节点都可以写，连到节点或结束）</label>
            <div v-if="selectedNode.kind === 'choice'" style="margin-bottom: 6px">
              <button class="btn" @click="normalizeYesNo(selectedNode)">一键变成「是/否」</button>
            </div>
            <div v-for="opt in selectedNode.options" :key="opt.id" style="margin-bottom: 6px">
              <input v-model="opt.text" placeholder="选项文字，比如：是 / 否 / 前往下一个任务" @pointerdown.stop />
              <div style="margin-top: 2px; font-size: 11px; color: #9ca3af">
                绑定：<strong style="color: #c7d2fe">{{ getOptionTargetText(opt) }}</strong>
                <button
                  v-if="!opt.isEnd && opt.targetNodeId"
                  class="btn"
                  style="margin-left: 6px"
                  @pointerdown.stop
                  @click="clearOptionLink(opt)"
                >
                  断开
                </button>
                <span v-else-if="!opt.isEnd && !opt.targetNodeId" style="margin-left: 6px; color: #6b7280">
                  （去画布里拖拽端口绑定）
                </span>
                <label style="margin-left: 4px">
                  结束
                  <input type="checkbox" v-model="opt.isEnd" @pointerdown.stop @change="onOptionEndChange(opt)" />
                </label>
              </div>
            </div>
            <button class="btn" style="margin-top: 4px" @click="addOption(selectedNode)" @pointerdown.stop>
              + 增加一个选项
            </button>
          </div>
        </div>
        <div v-else style="font-size: 13px; color: #6b7280">请选择一个节点进行编辑</div>
      </section>
    </main>
  </div>
</template>

<style scoped>
select {
  padding: 2px 4px;
  border-radius: 4px;
  border: 1px solid #4b5563;
  background: #020617;
  color: #e5e7eb;
  font-size: 11px;
}
</style>
