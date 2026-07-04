import type { GameMapDef, GraphData, ProjectData, StoryNode, StoryOption } from "../types";

const DEFER_TEXT_RE =
  /暂缓|拒绝|算了|稍后再|下次再说|不感兴趣|离开|不做|还没准备好|再想想|稍后|暂不|未准备好|考虑一下/;

const DEFER_TIP_RE = /暂缓不会推进|任务未推进|未接取|未推进|不会推进|需要.*才能继续/;

const ACCEPT_TEXT_RE = /接受|同意|好的|愿意|出发|开始|继续|挑战|接取|加入|进入战斗|开战/;

/** 选项文案是否像「暂缓/拒绝」 */
export function looksDeclineChoiceText(text: string): boolean {
  return DEFER_TEXT_RE.test(String(text ?? "").trim());
}

/** 选项文案是否像「接取/接受」 */
export function looksAcceptChoiceText(text: string): boolean {
  return ACCEPT_TEXT_RE.test(String(text ?? "").trim());
}

/** 导出/校验用：识别「暂缓不推进」类选项（勿误伤战斗「重新挑战」） */
export function isDeferChoiceOption(
  opt: Pick<StoryOption, "text" | "systemTip" | "completesEvent" | "forcedResult" | "effectTaskAccept">,
  ctx?: { optionIndex?: number; peerOptions?: StoryOption[] },
): boolean {
  if (opt.completesEvent === false) return true;
  if (opt.forcedResult === "block") return true;

  const tip = String(opt.systemTip ?? "");
  if (DEFER_TIP_RE.test(tip)) return true;

  const text = String(opt.text ?? "").trim();
  if (looksDeclineChoiceText(text)) return true;

  const idx = ctx?.optionIndex;
  const peers = ctx?.peerOptions ?? [];
  if (idx != null && idx > 0 && !opt.effectTaskAccept) {
    const first = peers[0];
    const firstAccept = first && (first.effectTaskAccept || looksAcceptChoiceText(first.text ?? ""));
    if (firstAccept && !looksAcceptChoiceText(text) && text.length > 0) {
      return true;
    }
  }

  return false;
}

export function normalizeChoiceOptionForExport(opt: StoryOption): {
  id: string;
  text: string;
  npcReply?: string;
  systemTip?: string;
  completesEvent?: boolean;
  forcedResult?: StoryOption["forcedResult"];
} {
  const defer = isDeferChoiceOption(opt);
  if (defer) {
    return {
      id: opt.id,
      text: opt.text,
      npcReply: opt.npcReply,
      systemTip: opt.systemTip,
      completesEvent: false,
      forcedResult: "block",
    };
  }
  return {
    id: opt.id,
    text: opt.text,
    npcReply: opt.npcReply,
    systemTip: opt.systemTip,
    completesEvent: opt.completesEvent,
    forcedResult: opt.forcedResult,
  };
}

/** 写回编辑器 workspace：暂缓选项统一 completesEvent=false + forcedResult=block，并剥离 effectTaskAccept */
export function applyDeferChoiceDefaults(
  opt: StoryOption,
  ctx?: { optionIndex?: number; peerOptions?: StoryOption[] },
): boolean {
  if (!isDeferChoiceOption(opt, ctx)) return false;
  let changed = false;
  if (opt.completesEvent !== false) {
    opt.completesEvent = false;
    changed = true;
  }
  if (opt.forcedResult !== "block") {
    opt.forcedResult = "block";
    changed = true;
  }
  if (opt.effectTaskAccept != null) {
    delete opt.effectTaskAccept;
    changed = true;
  }
  if (opt.effectTaskComplete != null) {
    delete opt.effectTaskComplete;
    changed = true;
  }
  return changed;
}

export type NormalizeDeferResult = { optionsFixed: number; acceptStripped: number };

/** 全图 choice 节点：写回 defer 标志（repair / export 前） */
export function normalizeAllChoiceDeferFlags(
  project: ProjectData,
  graph: GraphData,
  gameMap?: GameMapDef | null,
): NormalizeDeferResult {
  let optionsFixed = 0;
  let acceptStripped = 0;
  const zoneIds = gameMap?.npcs.map((n) => n.zoneId).filter(Boolean) as string[] | undefined;

  for (const node of graph.nodes) {
    if (node.kind !== "choice" || !node.options.length) continue;
    if (zoneIds?.length && node.mapId && !zoneIds.includes(node.mapId)) continue;

    node.options.forEach((opt, optionIndex) => {
      const hadAccept = opt.effectTaskAccept != null;
      if (applyDeferChoiceDefaults(opt, { optionIndex, peerOptions: node.options })) {
        optionsFixed += 1;
        if (hadAccept) acceptStripped += 1;
      }
    });
  }

  return { optionsFixed, acceptStripped };
}

/** 镜像 StoryManager._shouldCompleteChoice（单测 / 预览用） */
export function shouldRuntimeCompleteChoice(
  opt: { id: string; completesEvent?: boolean; forcedResult?: string },
  allowedChoiceIds?: string[],
): boolean {
  if (opt.completesEvent === false) return false;
  if (opt.forcedResult === "block" || opt.forcedResult === "none") return false;
  if (Array.isArray(allowedChoiceIds) && allowedChoiceIds.length > 0 && !allowedChoiceIds.includes(opt.id)) {
    return false;
  }
  return true;
}

export type FixRuntimeDeferResult = { optionsFixed: number; allowedFixed: number; effectsStripped: number };

/** 修补已发布 runtime JSON 中错误的 defer 契约（无 workspace 时 audit --fix 用） */
export function fixRuntimeMapDeferContracts(
  config: import("./map-runtime").RuntimeMapConfig,
): FixRuntimeDeferResult {
  const scripts = config.client?.choiceScripts ?? {};
  let optionsFixed = 0;
  let allowedFixed = 0;
  let effectsStripped = 0;

  for (const npc of config.npcs ?? []) {
    for (const ev of npc.events ?? []) {
      if (ev.eventType !== "choice" && ev.eventType !== "teleport") continue;
      const sid = ev.client?.choiceScriptId;
      if (!sid) continue;
      const script = scripts[sid];
      if (!script?.options?.length) continue;

      for (let i = 0; i < script.options.length; i++) {
        const opt = script.options[i]!;
        const ctx = { optionIndex: i, peerOptions: script.options };
        if (!isDeferChoiceOption(opt, ctx)) continue;
        if (opt.completesEvent !== false) {
          opt.completesEvent = false;
          optionsFixed += 1;
        }
        if (opt.forcedResult !== "block") {
          opt.forcedResult = "block";
          optionsFixed += 1;
        }
      }

      const allowed = script.options
        .filter((o, i) => !isDeferChoiceOption(o, { optionIndex: i, peerOptions: script.options }))
        .map((o) => o.id);
      const prevAllowed = ev.server?.allowedChoiceIds ?? [];
      const nextAllowed = allowed.length ? allowed : undefined;
      const allowedChanged =
        prevAllowed.length !== (nextAllowed?.length ?? 0) ||
        prevAllowed.some((id, idx) => id !== nextAllowed?.[idx]);
      if (allowedChanged) {
        if (!ev.server) ev.server = {};
        ev.server.allowedChoiceIds = nextAllowed;
        allowedFixed += 1;
      }

      const deferIds = new Set(
        script.options
          .filter((o, i) => isDeferChoiceOption(o, { optionIndex: i, peerOptions: script.options }))
          .map((o) => o.id),
      );
      if (deferIds.size && ev.server?.effects?.length) {
        const before = ev.server.effects.length;
        ev.server.effects = ev.server.effects.filter((eff) => {
          const cid = (eff as { choiceId?: string }).choiceId;
          return !cid || !deferIds.has(cid);
        });
        effectsStripped += before - ev.server.effects.length;
      }
    }
  }

  return { optionsFixed, allowedFixed, effectsStripped };
}

/** 从导出 JSON 摘要 choice 事件（MapRuntimePanel 用） */
export function summarizeExportedChoiceEvents(
  config: import("./map-runtime").RuntimeMapConfig,
): Array<{ npcUid: string; eventId: string; options: string[] }> {
  const scripts = config.client?.choiceScripts ?? {};
  const out: Array<{ npcUid: string; eventId: string; options: string[] }> = [];
  for (const npc of config.npcs ?? []) {
    for (const ev of npc.events ?? []) {
      if (ev.eventType !== "choice" && ev.eventType !== "teleport") continue;
      const sid = ev.client?.choiceScriptId;
      if (!sid) continue;
      const script = scripts[sid];
      if (!script?.options?.length) continue;
      const allowed = ev.server?.allowedChoiceIds ?? [];
      const lines = script.options.map((o, optionIndex) => {
        const defer =
          isDeferChoiceOption(o, { optionIndex, peerOptions: script.options }) ||
          !shouldRuntimeCompleteChoice(o, allowed);
        return `${defer ? "暂缓" : "推进"} · ${o.text ?? o.id}${allowed.length && !allowed.includes(o.id) ? " (不在 allowed)" : ""}`;
      });
      out.push({
        npcUid: npc.npcUid ?? "?",
        eventId: String(ev.eventId ?? ""),
        options: lines,
      });
    }
  }
  return out;
}
