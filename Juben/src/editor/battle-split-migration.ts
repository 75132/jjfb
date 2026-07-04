/**
 * 战斗链迁移：统一为「单 NPC 任务链 + 分支」，并将旧分离式 _battle 摆点合并回链内。
 */
import type { GameMapDef, GraphData, ProjectData, StoryNode } from "../types";
import { getOptionTargets, setOptionTargets } from "../types";
import { collectNpcEventChain, resolveNodeEventId } from "./map-export";
import { normalizeQuestBattlePatterns } from "./quest-battle-normalize";
import { hasBattleCompanion, isBattleOnlyNpc } from "./battle-npc-utils";

export type BattleSplitMigrationReport = {
  detected: number;
  migrated: number;
  skipped: number;
  choiceOptionsFixed: number;
  turnInEventDoneFixed: number;
  battleAppearFixed: number;
  details: string[];
};

function giverUidFromBattleNpc(battleUid: string): string | null {
  if (!battleUid.endsWith("_battle")) return null;
  return battleUid.slice(0, -"_battle".length);
}

/** 将分离式 _battle 摆点合并回任务 NPC 同一剧情链 */
export function mergeSplitBattleCompanion(
  project: ProjectData,
  gameMap: GameMapDef,
  battleNpcUid: string,
): boolean {
  const giverUid = giverUidFromBattleNpc(battleNpcUid);
  if (!giverUid) return false;

  const graph = project.graphs.find((g) => g.id === gameMap.graphId);
  if (!graph || graph.kind !== "map") return false;

  const giver = gameMap.npcs.find((n) => n.npcUid === giverUid);
  const battleNpc = gameMap.npcs.find((n) => n.npcUid === battleNpcUid);
  if (!giver?.zoneId || !battleNpc?.zoneId) return false;

  const battleZoneId = battleNpc.zoneId;
  const giverZoneId = giver.zoneId;

  const battleNodes = graph.nodes.filter(
    (n) => n.mapId === battleZoneId && n.kind !== "npcEntry" && n.kind !== "npcExit",
  );
  if (battleNodes.length === 0) {
    gameMap.npcs = gameMap.npcs.filter((n) => n.npcUid !== battleNpcUid);
    graph.nodes = graph.nodes.filter((n) => n.mapId !== battleZoneId);
    graph.maps = (graph.maps ?? []).filter((m) => m.id !== battleZoneId);
    return true;
  }

  for (const node of battleNodes) {
    node.mapId = giverZoneId;
  }

  const battleNode = battleNodes.find((n) => n.kind === "battle");
  const giverChain = collectNpcEventChain(graph, giver.entryNodeId);
  const turnIn = giverChain.find((n) => n.kind === "questUpdate" && n.questStatus === "Completed");

  if (battleNode && turnIn) {
    const preds = graph.nodes.filter((n) =>
      n.options.some((o) => getOptionTargets(o).includes(turnIn.id)),
    );
    for (const pred of preds) {
      for (const opt of pred.options) {
        if (getOptionTargets(opt).includes(turnIn.id)) {
          setOptionTargets(opt, [battleNode.id]);
        }
      }
    }
    if (preds.length === 0) {
      const hint = giverChain.find((n) => n.kind === "dialog" || n.kind === "action");
      if (hint) {
        setOptionTargets(hint.options[0] ?? { id: `opt_${crypto.randomUUID()}`, text: "继续" }, [
          battleNode.id,
        ]);
      }
    }
    connectChain(battleNode, turnIn.id);

    const battleEventId = resolveNodeEventId(graph, giver, battleNode.id, project);
    if (battleEventId) {
      turnIn.requirements = [{ kind: "eventDone", eventId: battleEventId }];
    }
  }

  graph.nodes = graph.nodes.filter(
    (n) => !(n.mapId === battleZoneId && (n.kind === "npcEntry" || n.kind === "npcExit")),
  );
  graph.maps = (graph.maps ?? []).filter((m) => m.id !== battleZoneId);
  gameMap.npcs = gameMap.npcs.filter((n) => n.npcUid !== battleNpcUid);

  return true;
}

function connectChain(from: StoryNode, toId: string) {
  if (from.options.length === 0) {
    from.options.push({ id: `opt_${crypto.randomUUID()}`, text: "继续" });
  }
  const opt = from.options[0]!;
  const targets = getOptionTargets(opt);
  if (!targets.includes(toId)) setOptionTargets(opt, [...targets, toId]);
}

export function detectSplitBattleCompanions(gameMap: GameMapDef): string[] {
  return gameMap.npcs.filter((n) => n.npcUid.endsWith("_battle")).map((n) => n.npcUid);
}

export function migrateQuestBattlePatterns(
  project: ProjectData,
  gameMap?: GameMapDef,
): BattleSplitMigrationReport {
  const report: BattleSplitMigrationReport = {
    detected: 0,
    migrated: 0,
    skipped: 0,
    choiceOptionsFixed: 0,
    turnInEventDoneFixed: 0,
    battleAppearFixed: 0,
    details: [],
  };

  const maps = gameMap ? [gameMap] : (project.gameMaps ?? []);
  for (const gm of maps) {
    const splitUids = detectSplitBattleCompanions(gm);
    report.detected += splitUids.length;

    for (const battleUid of splitUids) {
      const ok = mergeSplitBattleCompanion(project, gm, battleUid);
      if (ok) {
        report.migrated += 1;
        report.details.push(`已合并分离摆点：${battleUid} → 任务链内分支`);
      } else {
        report.skipped += 1;
      }
    }

    const norm = normalizeQuestBattlePatterns(project, gm);
    report.choiceOptionsFixed += norm.choiceOptionsFixed;
    report.turnInEventDoneFixed += norm.turnInEventDoneFixed;
    report.battleAppearFixed += norm.battleAppearFixed;
  }

  return report;
}
