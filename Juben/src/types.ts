export type GraphKind = "mainline" | "side" | "quest" | "map" | "timeline";
export type NodeKind =
  | "dialog"
  | "choice"
  | "battle"
  | "gainItem"
  | "loseItem"
  | "setVar"
  | "condition"
  | "check"
  | "action"
  | "questEntry"
  | "npcEntry"
  | "npcExit"
  | "taskEnd"
  | "questUpdate"
  | "callQuest"
  | "questCheck"
  | "mapPortal";

export type VarType = "bool" | "number" | "string";
export type QuestStatus = "NotStarted" | "InProgress" | "Completed" | "Failed";

export interface VariableDef {
  id: string;
  name: string;
  type: VarType;
  initialValue: boolean | number | string;
}

export interface QuestDef {
  id: string;
  name: string;
  initialStatus: QuestStatus;
  graphId: string;
  /** 运行时 numeric taskId（导出 tasks[]） */
  taskId?: number;
  /** 主线步进，与 sortOrder 同步 */
  mainlineStep?: number;
  /** 全局列表拖动排序（0-based） */
  sortOrder?: number;
}

export interface CharacterAsset {
  id: string;
  name: string;
  image?: string;
}

export type ResourceKind = "npc" | "pet" | "skill" | "item" | "dropTable" | "battleConfig" | "area";

export interface ResourceEntry {
  id: string;
  name: string;
  kind: ResourceKind;
  /** optional free-form note/config hint; editor-only */
  note?: string;
  /** optional image URL/path (used only when explicitly configured) */
  image?: string;
  /** optional tile size for map rendering; defaults to 48 */
  tileSize?: number;
}

export type ProjectResourceDict = Partial<Record<ResourceKind, ResourceEntry[]>>;

export type Requirement =
  | { kind: "questStatus"; questId: string; status: QuestStatus }
  | { kind: "varEquals"; varId: string; value: boolean | number | string }
  | { kind: "eventDone"; eventId: string };

export type CheckCondition =
  | { kind: "questStatus"; questId: string; status: QuestStatus }
  | { kind: "varEquals"; varId: string; value: boolean | number | string }
  | { kind: "serverVarEquals"; key: string; value: boolean | number | string }
  | { kind: "hasPet"; petId: string }
  | { kind: "bagSpaceAtLeast"; slots: number }
  | { kind: "activitySwitchOn"; key: string };

export type ActionStep =
  | { kind: "giveItem"; itemId: string; count: number }
  | { kind: "takeItem"; itemId: string; count: number }
  | { kind: "addCurrency"; currency: string; amount: number }
  | { kind: "setQuestStatus"; questId: string; status: QuestStatus }
  | { kind: "givePet"; petId: string }
  | { kind: "popup"; text: string }
  | { kind: "sendMail"; subject: string; body: string }
  | { kind: "teleport"; areaId?: string; toMapId?: number; toX?: number; toY?: number }
  | { kind: "triggerBattle"; battleConfigId: string }
  | { kind: "revealNpc"; npcUid: string }
  | { kind: "spawnNpc"; npcUid: string; npcName?: string; prefabKey?: string; x?: number; y?: number };

export type RuntimeForcedResult = "start_battle" | "block" | "teleport";

export interface StoryOption {
  id: string;
  text: string;
  /** 旧版单目标；导入时会合并进 targetNodeIds */
  targetNodeId?: string;
  /** 同一出口连多个下游（并行）；与 targetNodeId 互斥，保存时会规范化 */
  targetNodeIds?: string[];
  isEnd?: boolean;
  /** 运行时对齐：NPC 反馈（导出到 client.choiceScripts） */
  npcReply?: string;
  /** 运行时对齐：系统提示 Toast */
  systemTip?: string;
  /** 默认 true；false 时不完成事件（对齐 StoryManager completesEvent） */
  completesEvent?: boolean;
  /** 运行时对齐：block / start_battle / teleport */
  forcedResult?: RuntimeForcedResult;
  /** 导出：选此选项时接任务（numeric taskId） */
  effectTaskAccept?: number;
  /** 导出：选此选项时完成任务 */
  effectTaskComplete?: number;
  /** forcedResult=teleport 时的目标 */
  teleportToMapId?: number;
  teleportX?: number;
  teleportY?: number;
}

/** 读取选项的所有连线目标（合并旧字段 targetNodeId） */
export function getOptionTargets(opt: StoryOption): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of opt.targetNodeIds ?? []) {
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  if (opt.targetNodeId && !seen.has(opt.targetNodeId)) {
    seen.add(opt.targetNodeId);
    out.push(opt.targetNodeId);
  }
  return out;
}

/** 写入目标列表；单目标时同时写 targetNodeId 以兼容旧读取逻辑 */
export function setOptionTargets(opt: StoryOption, targets: string[]) {
  const u = [...new Set(targets.filter(Boolean))];
  delete opt.targetNodeId;
  delete opt.targetNodeIds;
  if (u.length === 1) {
    opt.targetNodeId = u[0];
    opt.targetNodeIds = [u[0]];
  } else if (u.length > 1) {
    opt.targetNodeIds = u;
  }
}

export function addOptionTarget(opt: StoryOption, targetNodeId: string) {
  if (!targetNodeId) return;
  const cur = getOptionTargets(opt);
  if (!cur.includes(targetNodeId)) cur.push(targetNodeId);
  setOptionTargets(opt, cur);
}

export function removeOptionTarget(opt: StoryOption, targetNodeId: string) {
  setOptionTargets(
    opt,
    getOptionTargets(opt).filter((id) => id !== targetNodeId),
  );
}

/** 画布上的逻辑分区（地图框 / NPC 剧情区），用于节点归属与连线隔离 */
export interface StoryMapRegion {
  id: string;
  name?: string;
  /** 绑定 NPC；在 kind=map 画布中表示 NPC 剧情区 */
  npcUid?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 全局整理时跳过此区域（框位置与内部节点均不动） */
  skipAutoLayout?: boolean;
}

export type NpcAppearMode = "always" | "conditional";

/** NPC 在地图上的出现规则（导出至 runtime npcs[].appear） */
export interface NpcAppearConfig {
  mode: NpcAppearMode;
  /** conditional 时：ALL=全部满足 / ANY=任一满足 */
  matchMode?: "ALL" | "ANY";
  requirements?: Requirement[];
}

/** 游戏地图上的 NPC 摆点（对齐运行时 map JSON npcs[]） */
export interface GameMapNpcDef {
  npcUid: string;
  npcName: string;
  /** 资源库 NPC id（与 npcUid 通常一致） */
  npcResourceId?: string;
  /** 本图摆点专用资源路径；空则回退到资源库 image */
  prefabKey?: string;
  /** Cocos 逻辑格心坐标 */
  x: number;
  y: number;
  /** 对应 graph.maps[].id（NPC 剧情区） */
  zoneId: string;
  /** 固定 npcEntry 节点 id */
  entryNodeId: string;
  /** 固定 npcExit 结尾节点 id */
  exitNodeId?: string;
  /** @deprecated 使用 appear.mode */
  initialHidden?: boolean;
  /** 人物出现：默认 conditional=隐藏直至条件满足；always=直接显示 */
  appear?: NpcAppearConfig;
  /** 子地图入口：双击摆点下钻到该 gameMapId */
  subMapGameMapId?: string;
  /** 蓝图槽位：dialog=纯对话（禁止战斗分支），battle=战斗链 */
  chainSlotKind?: "dialog" | "battle";
}

/** 项目级真实游戏地图（RPG Maker 式摆点 + 一张剧情 graph） */
export interface GameMapDef {
  id: string;
  mapCode: string;
  mapId: number;
  mapName?: string;
  /** 该地图全部 NPC 剧情共享的 graph id */
  graphId: string;
  tileSize: number;
  /** 底图路径，如 /maps/1.png（单图模式；与 imageSlices 二选一或作首帧兼容） */
  imagePath?: string;
  /** 竖向拼接底图路径列表（上→下），如 Cocos TiledMap 1-1/1-2/1-3 */
  imageSlices?: string[];
  npcs: GameMapNpcDef[];
  tasks?: { taskId: number; taskName?: string; mainlineStep?: number }[];
  /** 关联的全局剧情画布（主线/支线/任务），便于按地图组织跨图剧情 */
  linkedGraphIds?: string[];
  /** 父级地图 id；null/undefined = 仅挂在时间线门户下 */
  parentGameMapId?: string | null;
  /** 同级子地图排序 */
  sortOrder?: number;
  /** 回链时间线 mapPortal 节点 id */
  mapPortalNodeId?: string;
  /** 导出 merge 用：BGM / 场景预制体等运行时壳字段 */
  runtimeShell?: {
    bgm?: string;
    scenePrefabKey?: string;
    markerPrefabs?: { small?: string; elite?: string; boss?: string };
  };
}

export interface StoryNode {
  id: string;
  kind: NodeKind;
  title: string;
  text: string;
  options: StoryOption[];
  position: { x: number; y: number };
  /** 所属地图；未设置表示画布层，仅能与同样未设置的节点连线 */
  mapId?: string;
  /** 引用角色资产 */
  characterId?: string;
  /** 角色在节点展示中的偏移（仅配置数据，不做运行时渲染） */
  characterX?: number;
  characterY?: number;

  // dialog
  speaker?: string;
  dialogLines?: { id: string; text: string }[];

  // battle
  enemyIds?: string[];
  /** 引用战斗配置资源（可选；不破坏原 enemyIds） */
  battleConfigId?: string;
  /** 引用掉落表资源（可选） */
  dropTableId?: string;

  // gainItem
  itemId?: string;
  itemCount?: number;

  // setVar
  varId?: string;
  varValue?: boolean | number | string;

  // questUpdate
  questId?: string;
  questStatus?: QuestStatus;
  startGraphId?: string;
  callQuestTargets?: string[]; // ["quest:q1", "side:g_side_1"]

  // condition
  conditionMode?: "ALL" | "ANY";
  requirements?: Requirement[];

  // check (more generic conditions)
  checkMode?: "ALL" | "ANY";
  checks?: CheckCondition[];

  // action (execute a list of steps)
  actions?: ActionStep[];

  // resource references (besides character)
  npcId?: string;
  /** 节点归属 NPC（kind=map 画布，与 zone 的 npcUid 一致） */
  npcUid?: string;
  petId?: string;
  skillId?: string;
  areaId?: string;
  /** 导出 battle 事件 client.markerHint */
  markerHint?: string;
  /** 导出 server.requirements（event_done / task_active 等） */
  runtimeRequirements?: Array<Record<string, unknown>>;
  /** 地图链：勾选后本步完成自动衔接下一事件（导出无 endsSession）；默认 false 需再次按 E */
  chainContinuous?: boolean;
  /** 导出 client.requiresApproach：须再次靠近 NPC 才触发本事件 */
  requiresApproach?: boolean;
  /** npcExit：剧情链结束后是否隐藏/消失该 NPC */
  hideNpcOnEnd?: boolean;
  /** mapPortal：绑定的游戏地图 */
  gameMapId?: string;
  /** mapPortal：初始任务状态（导出 quests） */
  initialQuestStatus?: QuestStatus;
  /** mapPortal：运行时 numeric taskId */
  portalTaskId?: number;
  /** 编辑器专用元数据（不导出到 runtime JSON） */
  editorMeta?: {
    battleRole?: "enemyAppear" | "battlePrep" | "battle";
  };
}

export interface GraphData {
  id: string;
  name: string;
  kind: GraphKind;
  nodes: StoryNode[];
  /** 地图分区列表 */
  maps?: StoryMapRegion[];
}

export interface ProjectData {
  variables: VariableDef[];
  quests: QuestDef[];
  graphs: GraphData[];
  characterAssets?: CharacterAsset[];
  /** Unified resource dictionary (optional, backward compatible). */
  resources?: ProjectResourceDict;
  /** 真实游戏地图列表（地图模式） */
  gameMaps?: GameMapDef[];
  /** 项目级时间线画布 id（kind=timeline，唯一） */
  timelineGraphId?: string;
}

export function createGraph(partial: Partial<GraphData>): GraphData {
  return {
    id: partial.id ?? `graph_${crypto.randomUUID()}`,
    name: partial.name ?? "新画布",
    kind: partial.kind ?? "mainline",
    nodes: partial.nodes ?? [],
    maps: partial.maps ?? [],
  };
}

export function createNode(partial: Partial<StoryNode>): StoryNode {
  const kind: NodeKind = partial.kind ?? "dialog";
  const base: StoryNode = {
    id: partial.id ?? `node_${crypto.randomUUID()}`,
    kind,
    title: partial.title ?? "新节点",
    text: partial.text ?? "",
    options: partial.options ?? [],
    position: partial.position ?? { x: 120, y: 120 },
    mapId: partial.mapId,
    speaker: partial.speaker,
    dialogLines: partial.dialogLines,
    enemyIds: partial.enemyIds,
    battleConfigId: partial.battleConfigId,
    dropTableId: partial.dropTableId,
    itemId: partial.itemId,
    itemCount: partial.itemCount,
    varId: partial.varId,
    varValue: partial.varValue,
    questId: partial.questId,
    questStatus: partial.questStatus,
    startGraphId: partial.startGraphId,
    callQuestTargets: partial.callQuestTargets,
    conditionMode: partial.conditionMode,
    requirements: partial.requirements,
    checkMode: partial.checkMode,
    checks: partial.checks,
    actions: partial.actions,
    characterId: partial.characterId,
    characterX: partial.characterX,
    characterY: partial.characterY,
    npcId: partial.npcId,
    npcUid: partial.npcUid,
    petId: partial.petId,
    skillId: partial.skillId,
    areaId: partial.areaId,
    gameMapId: partial.gameMapId,
    initialQuestStatus: partial.initialQuestStatus,
    portalTaskId: partial.portalTaskId,
  };

  // 给不同节点一个更合理的默认值
  if (!partial.title) {
    base.title =
      kind === "dialog"
        ? "对话"
        : kind === "choice"
          ? "选择"
          : kind === "battle"
            ? "战斗"
            : kind === "gainItem"
              ? "获得物品"
              : kind === "loseItem"
                ? "失去物品"
                : kind === "setVar"
                  ? "设置变量"
                  : kind === "condition"
                    ? "条件分支"
                    : kind === "questEntry"
                      ? "任务入口"
                      : kind === "npcEntry"
                        ? "NPC 入口"
                        : kind === "npcExit"
                          ? "NPC 结尾"
                          : kind === "taskEnd"
                            ? "任务结束"
                            : kind === "callQuest"
                              ? "开始任务"
                              : kind === "mapPortal"
                                ? "大剧情"
                                : kind === "questCheck"
                                  ? "任务进度检查"
                                  : "节点";
  }

  if (!partial.options) {
    base.options =
      kind === "choice"
        ? [
            { id: `opt_${crypto.randomUUID()}`, text: "是" },
            { id: `opt_${crypto.randomUUID()}`, text: "否" },
          ]
        : kind === "battle"
          ? [
              { id: `opt_${crypto.randomUUID()}`, text: "胜利" },
              { id: `opt_${crypto.randomUUID()}`, text: "失败" },
            ]
          : kind === "condition"
            ? [
                { id: `opt_${crypto.randomUUID()}`, text: "满足" },
                { id: `opt_${crypto.randomUUID()}`, text: "不满足" },
              ]
            : kind === "check"
              ? [
                  { id: `opt_${crypto.randomUUID()}`, text: "通过" },
                  { id: `opt_${crypto.randomUUID()}`, text: "不通过" },
                ]
              : kind === "action"
                ? [{ id: `opt_${crypto.randomUUID()}`, text: "继续" }]
                : kind === "callQuest"
                  ? [{ id: `opt_${crypto.randomUUID()}`, text: "开始并进入任务" }]
                  : kind === "mapPortal"
                    ? [{ id: `opt_${crypto.randomUUID()}`, text: "下一剧情" }]
                    : kind === "questCheck"
                      ? [
                          { id: `opt_${crypto.randomUUID()}`, text: "满足" },
                          { id: `opt_${crypto.randomUUID()}`, text: "不满足" },
                        ]
                      : [{ id: `opt_${crypto.randomUUID()}`, text: "继续" }];
  }

  if (kind === "gainItem" || kind === "loseItem") {
    if (base.itemCount == null) base.itemCount = 1;
  }

  if (kind === "battle") {
    if (!base.enemyIds || base.enemyIds.length === 0) base.enemyIds = [""];
  }

  if (kind === "condition") {
    if (!base.conditionMode) base.conditionMode = "ALL";
    if (!base.requirements) base.requirements = [];
  }

  if (kind === "check") {
    if (!base.checkMode) base.checkMode = "ALL";
    if (!base.checks) base.checks = [];
  }

  if (kind === "action") {
    if (!base.actions) base.actions = [];
  }

  if (kind === "questCheck") {
    if (!base.conditionMode) base.conditionMode = "ALL";
    if (!base.requirements) base.requirements = [];
  }

  if (kind === "taskEnd") {
    if (!base.questStatus) base.questStatus = "Completed";
    base.options = [];
  }

  if (kind === "questEntry") {
    base.options = [{ id: `opt_${crypto.randomUUID()}`, text: "进入任务" }];
  }

  if (kind === "npcEntry") {
    base.options = [{ id: `opt_${crypto.randomUUID()}`, text: "开始事件链" }];
    base.title = partial.title ?? "NPC 入口";
  }

  if (kind === "npcExit") {
    base.options = [];
    base.title = partial.title ?? "NPC 结尾";
    if (base.hideNpcOnEnd == null) base.hideNpcOnEnd = true;
  }

  if (kind === "dialog") {
    if (!base.dialogLines || base.dialogLines.length === 0) {
      const first = (partial.text ?? base.text ?? "").trim();
      base.dialogLines = [{ id: `line_${crypto.randomUUID()}`, text: first }];
    }
  }

  return base;
}

export function createGameMap(partial: Partial<GameMapDef>): GameMapDef {
  const graphId = partial.graphId ?? `graph_map_${crypto.randomUUID()}`;
  return {
    id: partial.id ?? `gm_${crypto.randomUUID()}`,
    mapCode: partial.mapCode ?? "new_map",
    mapId: partial.mapId ?? 0,
    mapName: partial.mapName,
    graphId,
    tileSize: partial.tileSize ?? 48,
    imagePath: partial.imagePath ?? "/maps/1.png",
    npcs: partial.npcs ?? [],
    tasks: partial.tasks,
    linkedGraphIds: partial.linkedGraphIds,
    parentGameMapId: partial.parentGameMapId ?? null,
    sortOrder: partial.sortOrder,
    mapPortalNodeId: partial.mapPortalNodeId,
  };
}

export function createGameMapNpc(partial: Partial<GameMapNpcDef> & { npcUid: string; npcName: string }): GameMapNpcDef {
  const zoneId = partial.zoneId ?? `zone_${partial.npcUid}`;
  const entryNodeId = partial.entryNodeId ?? `entry_${partial.npcUid}`;
  const exitNodeId = partial.exitNodeId ?? `exit_${partial.npcUid}`;
  return {
    npcUid: partial.npcUid,
    npcName: partial.npcName,
    npcResourceId: partial.npcResourceId ?? partial.npcUid,
    prefabKey: partial.prefabKey,
    x: partial.x ?? 192,
    y: partial.y ?? 192,
    zoneId,
    entryNodeId,
    exitNodeId,
    appear: partial.appear ?? { mode: "conditional", matchMode: "ALL", requirements: [] },
    subMapGameMapId: partial.subMapGameMapId,
  };
}
