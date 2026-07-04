/**
 * Cocos / story_service 运行时地图 JSON 类型与校验（与 StoryManager + story_service 对齐）
 */
import { sanitizeNumericTaskId } from "./quest-logic";

export type RuntimeChoiceOption = {
  id: string;
  text: string;
  npcReply?: string;
  systemTip?: string;
  completesEvent?: boolean;
  forcedResult?: "start_battle" | "block" | "teleport";
};

export type RuntimeChoiceScript = {
  title: string;
  options: RuntimeChoiceOption[];
};

export type RuntimeDialogueScript = {
  speaker: string;
  lines: string[];
  line?: string;
  text?: string;
};

export type RuntimeTaskDef = {
  taskId: number;
  taskName?: string;
  mainlineStep?: number;
};

export type RuntimeServerEffect =
  | { action: "task_accept"; taskId: number; choiceId?: string }
  | { action: "task_complete"; taskId: number; choiceId?: string }
  | { action: "teleport"; toMapId: number; toX: number; toY: number; choiceId?: string }
  | { action: "reveal_npc"; npcUid: string; choiceId?: string }
  | {
      action: "spawn_npc";
      npcUid: string;
      npcName?: string;
      prefabKey?: string;
      x?: number;
      y?: number;
      choiceId?: string;
    }
  | { action: string; [key: string]: unknown };

export type RuntimeMapNpc = {
  npcUid?: string;
  npcName?: string;
  /** 头顶显示的角色名（与 npcName 任务链标题区分） */
  characterName?: string;
  prefabKey?: string;
  x?: number;
  y?: number;
  initialHidden?: boolean;
  appear?: {
    mode: "always" | "conditional";
    matchMode?: "ALL" | "ANY";
    requirements?: Array<{ type: string; taskId?: number; varId?: string; value?: unknown }>;
  };
  /** 剧情链全部完成后隐藏 NPC（来自 npcExit.hideNpcOnEnd） */
  hideWhenComplete?: boolean;
  events?: RuntimeMapEvent[];
};

export type RuntimeMapEvent = {
  eventId?: string;
  eventType?: string;
  eventTypeDesc?: string;
  order?: number;
  server?: {
    requirements?: unknown[];
    battleRef?: string;
    effects?: RuntimeServerEffect[];
    allowedChoiceIds?: string[];
  };
  client?: {
    dialogueScriptId?: string;
    choiceScriptId?: string;
    taskUiHint?: string;
    markerHint?: string;
    /** 须再次靠近 NPC 触发 */
    requiresApproach?: boolean;
    /** 本事件结束后结束当前接触会话 */
    endsSession?: boolean;
  };
};

export type RuntimeMapConfig = {
  configVersion?: string;
  mapId?: number;
  mapCode?: string;
  mapName?: string;
  tileSize?: number;
  /** 拼接/单图内容区宽（与 Cocos TiledMap Content Size 对齐校验） */
  mapWidth?: number;
  /** 拼接/单图内容区高 */
  mapHeight?: number;
  /** vertical_stitch | single */
  mapLayout?: string;
  /** 编辑器底图切片（运行时可选，便于核对） */
  imageSlices?: string[];
  tasks?: RuntimeTaskDef[];
  /** @deprecated 使用 tasks */
  quests?: RuntimeTaskDef[];
  client?: {
    dialogueScripts?: Record<string, RuntimeDialogueScript>;
    choiceScripts?: Record<string, RuntimeChoiceScript>;
  };
  npcs?: RuntimeMapNpc[];
  battles?: unknown[];
};

export type MapRuntimeIssueLevel = "error" | "warn" | "info";

export type MapRuntimeIssue = {
  level: MapRuntimeIssueLevel;
  path: string;
  message: string;
};

export type MapRuntimeReport = {
  ok: boolean;
  issues: MapRuntimeIssue[];
  normalized: RuntimeMapConfig | null;
};

function pushIssue(issues: MapRuntimeIssue[], level: MapRuntimeIssueLevel, path: string, message: string) {
  issues.push({ level, path, message });
}

/** quests → tasks，并补齐缺省字段 */
export function normalizeMapConfig(raw: unknown): RuntimeMapConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const cfg = JSON.parse(JSON.stringify(raw)) as RuntimeMapConfig;
  if (!cfg.tasks?.length && cfg.quests?.length) {
    cfg.tasks = cfg.quests;
    delete cfg.quests;
  }
  return cfg;
}

export function validateMapConfig(raw: unknown): MapRuntimeReport {
  const issues: MapRuntimeIssue[] = [];
  const normalized = normalizeMapConfig(raw);
  if (!normalized) {
    pushIssue(issues, "error", "$", "根对象不是有效 JSON 对象");
    return { ok: false, issues, normalized: null };
  }

  if (normalized.quests?.length) {
    pushIssue(issues, "warn", "quests", "请改用 tasks 字段（quests 已废弃，服务端仅读 tasks）");
  }
  if (!normalized.mapCode) {
    pushIssue(issues, "error", "mapCode", "缺少 mapCode");
  }
  if (!normalized.configVersion) {
    pushIssue(issues, "warn", "configVersion", "建议填写 configVersion 便于热更新");
  }

  const taskIds = new Set<number>();
  for (const t of normalized.tasks ?? []) {
    const tid = sanitizeNumericTaskId(t.taskId);
    if (tid == null) pushIssue(issues, "error", "tasks[]", "任务缺少 taskId");
    else taskIds.add(tid);
  }

  const dlg = normalized.client?.dialogueScripts ?? {};
  const ch = normalized.client?.choiceScripts ?? {};
  const eventIds = new Set<string>();

  for (let ni = 0; ni < (normalized.npcs ?? []).length; ni++) {
    const npc = normalized.npcs![ni]!;
    const npcPath = `npcs[${ni}]`;
    if (!npc.npcUid) pushIssue(issues, "error", npcPath, "缺少 npcUid");
    const events = [...(npc.events ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (let ei = 0; ei < events.length; ei++) {
      const ev = events[ei]!;
      const evPath = `${npcPath}.events[${ei}]`;
      const eid = ev.eventId ?? `${npc.npcUid ?? "npc"}#order_${ev.order ?? ei}`;
      if (eventIds.has(eid)) {
        pushIssue(issues, "error", evPath, `eventId 重复：${eid}`);
      }
      eventIds.add(eid);

      const et = ev.eventType ?? "";
      const client = ev.client ?? {};
      const server = ev.server ?? {};

      if (et === "dialog") {
        const sid = client.dialogueScriptId;
        if (!sid) pushIssue(issues, "error", evPath, "dialog 事件缺少 dialogueScriptId");
        else if (!dlg[sid]) pushIssue(issues, "error", evPath, `对白脚本不存在：${sid}`);
      }

      if (et === "battle") {
        if (!server.battleRef) pushIssue(issues, "error", evPath, "battle 事件缺少 server.battleRef");
        if (client.choiceScriptId && !ch[client.choiceScriptId]) {
          pushIssue(issues, "error", evPath, `选项脚本不存在：${client.choiceScriptId}`);
        }
      }

      if (client.choiceScriptId && et !== "battle" && et !== "teleport" && et !== "choice") {
        pushIssue(
          issues,
          "warn",
          evPath,
          `eventType=${et} 但配置了 choiceScriptId，请确认类型应为 choice/battle/teleport`,
        );
      }

      if (client.choiceScriptId) {
        const script = ch[client.choiceScriptId];
        if (script) {
          for (let oi = 0; oi < (script.options ?? []).length; oi++) {
            const opt = script.options[oi]!;
            if (opt.completesEvent === false && server.allowedChoiceIds?.includes(opt.id)) {
              pushIssue(
                issues,
                "error",
                `client.choiceScripts.${client.choiceScriptId}.options[${oi}]`,
                `选项 ${opt.id} 设 completesEvent=false 却在 allowedChoiceIds 中`,
              );
            }
          }
        }
      }

      for (const eff of server.effects ?? []) {
        if (!eff || typeof eff !== "object") continue;
        const action = String((eff as RuntimeServerEffect).action ?? "");
        if (action === "task_accept" || action === "task_complete") {
          const tid = sanitizeNumericTaskId((eff as { taskId?: unknown }).taskId);
          if (tid == null) {
            pushIssue(issues, "error", evPath, `effects.${action} 缺少有效 taskId`);
          } else if (!taskIds.has(tid)) {
            pushIssue(issues, "error", evPath, `effects.${action} 引用未知 taskId=${tid}`);
          }
        }
        if (action === "teleport") {
          const tp = eff as { toMapId?: number; toX?: number; toY?: number };
          if (tp.toMapId == null) pushIssue(issues, "error", evPath, "teleport effect 缺少 toMapId");
        }
        if (action === "reveal_npc") {
          const uid = String((eff as { npcUid?: string }).npcUid ?? "").trim();
          if (!uid) pushIssue(issues, "error", evPath, "reveal_npc 缺少 npcUid");
        }
        if (action === "spawn_npc") {
          const uid = String((eff as { npcUid?: string }).npcUid ?? "").trim();
          if (!uid) pushIssue(issues, "error", evPath, "spawn_npc 缺少 npcUid");
        }
      }
    }
  }

  const errors = issues.filter((i) => i.level === "error").length;
  return { ok: errors === 0, issues, normalized };
}

export function formatMapRuntimeReport(report: MapRuntimeReport): string {
  if (report.issues.length === 0) return "校验通过：未发现结构问题。";
  return report.issues.map((i) => `[${i.level.toUpperCase()}] ${i.path}: ${i.message}`).join("\n");
}

/** 将运行时 choice 字段同步到编辑器 StoryOption（供导入辅助） */
export function runtimeChoiceToEditorOption(opt: RuntimeChoiceOption) {
  return {
    id: opt.id,
    text: opt.text,
    npcReply: opt.npcReply,
    systemTip: opt.systemTip,
    completesEvent: opt.completesEvent,
    forcedResult: opt.forcedResult,
  };
}
