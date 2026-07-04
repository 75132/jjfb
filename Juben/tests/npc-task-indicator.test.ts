import { describe, expect, it } from "vitest";
import {
  extractPrimaryTaskId,
  isCurrentSegmentAccepted,
  npcTaskIndicatorKindToIndex,
  resolveNpcTaskIndicatorKind,
  type NpcTaskEvent,
  type NpcTaskIndicatorContext,
} from "../../assets/Script/Game/npc-task-indicator";

const npc2Events: NpcTaskEvent[] = [
  { eventId: "npc_bda99300_2_e1", eventType: "dialog", order: 1, server: { requirements: [], effects: [] } },
  {
    eventId: "npc_bda99300_2_e2",
    eventType: "choice",
    order: 2,
    server: { requirements: [], effects: [{ action: "task_accept", taskId: 100004 }] },
  },
  {
    eventId: "npc_bda99300_2_e3",
    eventType: "battle",
    order: 3,
    server: { requirements: [], effects: [], battleRef: "battle_1-50" },
  },
  { eventId: "npc_bda99300_2_e4", eventType: "dialog", order: 4, server: { requirements: [], effects: [] } },
  {
    eventId: "npc_bda99300_2_e5",
    eventType: "task",
    order: 5,
    server: { requirements: [], effects: [{ action: "task_complete", taskId: 100004 }] },
  },
];

function makeCtx(overrides: {
  done?: Set<string>;
  battleWon?: Set<string>;
  outstandingBattles?: boolean;
}): NpcTaskIndicatorContext {
  const done = overrides.done ?? new Set<string>();
  const battleWon = overrides.battleWon ?? new Set<string>();
  const outstanding = overrides.outstandingBattles ?? false;
  return {
    stableEventId: (_uid, ev) => String(ev.eventId),
    isStepComplete: (_uid, ev) => {
      const eid = String(ev.eventId);
      if (ev.eventType === "battle") return battleWon.has(eid);
      return done.has(eid);
    },
    requirementsMet: () => true,
    hasOutstandingBattlesForChain: () => outstanding,
    pickNextInteract: () => {
      for (const ev of npc2Events) {
        const eid = String(ev.eventId);
        const complete =
          ev.eventType === "battle" ? battleWon.has(eid) : done.has(eid);
        if (!complete) return ev;
      }
      return null;
    },
  };
}

const chain4Giver: NpcTaskEvent[] = [
  { eventId: "c4_e1", eventType: "dialog", order: 1, server: { requirements: [], effects: [] } },
  {
    eventId: "c4_e2",
    eventType: "choice",
    order: 2,
    server: { requirements: [], effects: [{ action: "task_accept", taskId: 100001 }] },
  },
  {
    eventId: "c4_e3",
    eventType: "task",
    order: 3,
    server: {
      requirements: [
        { type: "event_done", eventId: "c4_enemy_e2" },
        { type: "event_done", eventId: "c4_enemy2_e2" },
        { type: "event_done", eventId: "c4_enemy3_e2" },
      ],
      effects: [{ action: "task_complete", taskId: 100001 }],
    },
  },
  { eventId: "c4_e4", eventType: "dialog", order: 4, server: { requirements: [], effects: [] } },
  {
    eventId: "c4_e5",
    eventType: "choice",
    order: 5,
    server: { requirements: [], effects: [{ action: "task_accept", taskId: 100001 }] },
  },
  { eventId: "c4_e6", eventType: "dialog", order: 6, server: { requirements: [], effects: [] } },
];

describe("resolveNpcTaskIndicatorKind", () => {
  it("战斗逃跑后应显示进行中（灰色 ?），不是可提交", () => {
    const ctx = makeCtx({
      done: new Set(["npc_bda99300_2_e1", "npc_bda99300_2_e2"]),
      battleWon: new Set(),
      outstandingBattles: true,
    });
    expect(resolveNpcTaskIndicatorKind("npc_bda99300_2", npc2Events, ctx)).toBe("in_progress");
  });

  it("战斗胜利且前置环完成时显示可提交（橙色 ?）", () => {
    const ctx = makeCtx({
      done: new Set([
        "npc_bda99300_2_e1",
        "npc_bda99300_2_e2",
        "npc_bda99300_2_e4",
      ]),
      battleWon: new Set(["npc_bda99300_2_e3"]),
      outstandingBattles: false,
    });
    expect(resolveNpcTaskIndicatorKind("npc_bda99300_2", npc2Events, ctx)).toBe("turn_in");
  });

  it("战斗环在 completed 里但未胜利时，不可提交", () => {
    const ctx = makeCtx({
      done: new Set([
        "npc_bda99300_2_e1",
        "npc_bda99300_2_e2",
        "npc_bda99300_2_e3",
        "npc_bda99300_2_e4",
      ]),
      battleWon: new Set(),
      outstandingBattles: true,
    });
    expect(resolveNpcTaskIndicatorKind("npc_bda99300_2", npc2Events, ctx)).toBe("in_progress");
  });

  it("choice 接取环已完成 → 灰色进行中", () => {
    const events: NpcTaskEvent[] = [
      { eventId: "e1", eventType: "dialog", order: 1, server: { requirements: [], effects: [] } },
      {
        eventId: "e2",
        eventType: "choice",
        order: 2,
        server: { requirements: [], effects: [{ action: "task_accept", taskId: 100001 }] },
      },
      { eventId: "e3", eventType: "dialog", order: 3, server: { requirements: [], effects: [] } },
    ];
    const ctx: NpcTaskIndicatorContext = {
      stableEventId: (_u, ev) => String(ev.eventId),
      isStepComplete: (_u, ev) => ["e1", "e2"].includes(String(ev.eventId)),
      requirementsMet: () => true,
      hasOutstandingBattlesForChain: () => true,
      pickNextInteract: () => events[2]!,
    };
    expect(resolveNpcTaskIndicatorKind("giver", events, ctx)).toBe("in_progress");
  });

  it("chain_1：e1 对话完成、e2 接取未完成 → 仍为橙色可接", () => {
    const chain1: NpcTaskEvent[] = [
      { eventId: "c1_e1", eventType: "dialog", order: 1, server: { requirements: [], effects: [] } },
      {
        eventId: "c1_e2",
        eventType: "choice",
        order: 2,
        server: { requirements: [], effects: [{ action: "task_accept", taskId: 100001 }] },
      },
      {
        eventId: "c1_e3",
        eventType: "task",
        order: 3,
        server: { requirements: [], effects: [{ action: "task_complete", taskId: 100001 }] },
      },
    ];
    const ctx: NpcTaskIndicatorContext = {
      stableEventId: (_u, ev) => String(ev.eventId),
      isStepComplete: (_u, ev) => String(ev.eventId) === "c1_e1",
      requirementsMet: () => true,
    };
    expect(resolveNpcTaskIndicatorKind("chain_1", chain1, ctx)).toBe("available");
  });

  it("chain_1：接取后 map 内仍有未胜战斗 → 灰色进行中", () => {
    const chain1: NpcTaskEvent[] = [
      { eventId: "c1_e1", eventType: "dialog", order: 1, server: { requirements: [], effects: [] } },
      {
        eventId: "c1_e2",
        eventType: "choice",
        order: 2,
        server: { requirements: [], effects: [{ action: "task_accept", taskId: 100001 }] },
      },
      {
        eventId: "c1_e3",
        eventType: "task",
        order: 3,
        server: { requirements: [], effects: [{ action: "task_complete", taskId: 100001 }] },
      },
    ];
    const ctx: NpcTaskIndicatorContext = {
      stableEventId: (_u, ev) => String(ev.eventId),
      isStepComplete: (_u, ev) => ["c1_e1", "c1_e2"].includes(String(ev.eventId)),
      requirementsMet: () => true,
      hasOutstandingBattlesForChain: () => true,
    };
    expect(resolveNpcTaskIndicatorKind("chain_1", chain1, ctx)).toBe("in_progress");
  });

  it("chain_2：确认出击后、战斗未胜 → 灰色进行中", () => {
    const chain2Giver: NpcTaskEvent[] = [
      { eventId: "c2_e1", eventType: "dialog", order: 1, server: { requirements: [], effects: [] } },
      { eventId: "c2_e2", eventType: "dialog", order: 2, server: { requirements: [], effects: [] } },
      {
        eventId: "c2_e3",
        eventType: "choice",
        order: 3,
        server: {
          requirements: [],
          effects: [{ action: "task_accept", taskId: 100001, choiceId: "opt_accept" }],
        },
      },
      {
        eventId: "c2_e4",
        eventType: "task",
        order: 4,
        server: {
          requirements: [
            { type: "event_done", eventId: "c2_enemy_e2" },
            { type: "event_done", eventId: "c2_enemy2_e2" },
          ],
          effects: [{ action: "task_complete", taskId: 100001 }],
        },
      },
      { eventId: "c2_e5", eventType: "dialog", order: 5, server: { requirements: [], effects: [] } },
    ];
    const ctx: NpcTaskIndicatorContext = {
      stableEventId: (_u, ev) => String(ev.eventId),
      isStepComplete: (_u, ev) => ["c2_e1", "c2_e2", "c2_e3"].includes(String(ev.eventId)),
      requirementsMet: (reqs) => {
        if (!reqs?.length) return true;
        for (const raw of reqs) {
          const req = raw as { type?: string; eventId?: string };
          if (req.type === "event_done" && req.eventId?.startsWith("c2_enemy")) return false;
        }
        return true;
      },
      hasOutstandingBattlesForChain: () => true,
    };
    expect(resolveNpcTaskIndicatorKind("chain_2", chain2Giver, ctx)).toBe("in_progress");
  });

  it("chain_2：两场战斗均胜 → 橙色可交付", () => {
    const chain2Giver: NpcTaskEvent[] = [
      { eventId: "c2_e1", eventType: "dialog", order: 1, server: { requirements: [], effects: [] } },
      { eventId: "c2_e2", eventType: "dialog", order: 2, server: { requirements: [], effects: [] } },
      {
        eventId: "c2_e3",
        eventType: "choice",
        order: 3,
        server: {
          requirements: [],
          effects: [{ action: "task_accept", taskId: 100001, choiceId: "opt_accept" }],
        },
      },
      {
        eventId: "c2_e4",
        eventType: "task",
        order: 4,
        server: {
          requirements: [
            { type: "event_done", eventId: "c2_enemy_e2" },
            { type: "event_done", eventId: "c2_enemy2_e2" },
          ],
          effects: [{ action: "task_complete", taskId: 100001 }],
        },
      },
    ];
    const ctx: NpcTaskIndicatorContext = {
      stableEventId: (_u, ev) => String(ev.eventId),
      isStepComplete: (_u, ev) => ["c2_e1", "c2_e2", "c2_e3"].includes(String(ev.eventId)),
      requirementsMet: () => true,
      hasOutstandingBattlesForChain: () => false,
    };
    expect(resolveNpcTaskIndicatorKind("chain_2", chain2Giver, ctx)).toBe("turn_in");
  });

  it("chain_2：choice 确认出击后灰色进行中", () => {
    const events: NpcTaskEvent[] = [
      { eventId: "c2_e1", eventType: "dialog", order: 1, server: { requirements: [], effects: [] } },
      { eventId: "c2_e2", eventType: "dialog", order: 2, server: { requirements: [], effects: [] } },
      {
        eventId: "c2_e3",
        eventType: "choice",
        order: 3,
        server: {
          requirements: [],
          effects: [{ action: "task_accept", taskId: 100001, choiceId: "opt_accept" }],
          allowedChoiceIds: ["opt_accept"],
        },
      },
      { eventId: "c2_e4", eventType: "dialog", order: 4, server: { requirements: [], effects: [] } },
    ];
    const ctx: NpcTaskIndicatorContext = {
      stableEventId: (_u, ev) => String(ev.eventId),
      isStepComplete: (_u, ev) => ["c2_e1", "c2_e2", "c2_e3"].includes(String(ev.eventId)),
      requirementsMet: () => true,
      hasOutstandingBattlesForChain: () => true,
    };
    expect(resolveNpcTaskIndicatorKind("chain_2", events, ctx)).toBe("in_progress");
  });

  it("task_2：e1 接取环完成即灰色进行中", () => {
    const task2Events: NpcTaskEvent[] = [
      {
        eventId: "task_2_e1",
        eventType: "task",
        order: 1,
        server: { requirements: [], effects: [{ action: "task_accept", taskId: 100001 }] },
      },
      { eventId: "task_2_e2", eventType: "dialog", order: 2, server: { requirements: [], effects: [] } },
      {
        eventId: "task_2_e3",
        eventType: "task",
        order: 3,
        server: {
          requirements: [{ type: "event_done", eventId: "task_2_e6" }],
          effects: [{ action: "task_complete", taskId: 100001 }],
        },
      },
      { eventId: "task_2_e4", eventType: "dialog", order: 4, server: { requirements: [], effects: [] } },
      { eventId: "task_2_e5", eventType: "dialog", order: 5, server: { requirements: [], effects: [] } },
      { eventId: "task_2_e6", eventType: "dialog", order: 6, server: { requirements: [], effects: [] } },
    ];
    const ctx: NpcTaskIndicatorContext = {
      stableEventId: (_u, ev) => String(ev.eventId),
      isStepComplete: (_u, ev) => String(ev.eventId) === "task_2_e1",
      requirementsMet: (reqs) => {
        if (!reqs?.length) return true;
        return false;
      },
      hasOutstandingBattlesForChain: () => true,
    };
    expect(resolveNpcTaskIndicatorKind("task_2", task2Events, ctx)).toBe("in_progress");
  });

  it("未接取时对话已推进仍显示橙色可接（非灰色）", () => {
    const npc1Events: NpcTaskEvent[] = [
      { eventId: "e1", eventType: "dialog", order: 1, server: { requirements: [], effects: [] } },
      {
        eventId: "e2",
        eventType: "choice",
        order: 2,
        server: {
          requirements: [],
          effects: [{ action: "task_accept", taskId: 100004, choiceId: "opt_no" }],
        },
      },
      { eventId: "e3", eventType: "dialog", order: 3, server: { requirements: [], effects: [] } },
      {
        eventId: "e4",
        eventType: "task",
        order: 4,
        server: { requirements: [], effects: [{ action: "task_complete", taskId: 100004 }] },
      },
    ];
    const ctx: NpcTaskIndicatorContext = {
      stableEventId: (_u, ev) => String(ev.eventId),
      isStepComplete: (_u, ev) => String(ev.eventId) === "e1",
      requirementsMet: () => true,
    };
    expect(extractPrimaryTaskId(npc1Events)).toBe(100004);
    expect(resolveNpcTaskIndicatorKind("npc1", npc1Events, ctx)).toBe("available");
  });

  it("chain_4 刚出现零进度 → 橙色可接（不受全局 task active 影响）", () => {
    const ctx: NpcTaskIndicatorContext = {
      stableEventId: (_u, ev) => String(ev.eventId),
      isStepComplete: () => false,
      requirementsMet: () => true,
      hasOutstandingBattlesForChain: () => true,
    };
    expect(resolveNpcTaskIndicatorKind("chain_4", chain4Giver, ctx)).toBe("available");
  });

  it("chain_4：e2 接取完成、3 场战斗未胜 → 灰色进行中", () => {
    const ctx: NpcTaskIndicatorContext = {
      stableEventId: (_u, ev) => String(ev.eventId),
      isStepComplete: (_u, ev) => ["c4_e1", "c4_e2"].includes(String(ev.eventId)),
      requirementsMet: (reqs) => {
        if (!reqs?.length) return true;
        return false;
      },
      hasOutstandingBattlesForChain: () => true,
    };
    expect(resolveNpcTaskIndicatorKind("chain_4", chain4Giver, ctx)).toBe("in_progress");
  });

  it("chain_4：三场战斗均胜 → 橙色可交付", () => {
    const ctx: NpcTaskIndicatorContext = {
      stableEventId: (_u, ev) => String(ev.eventId),
      isStepComplete: (_u, ev) => ["c4_e1", "c4_e2"].includes(String(ev.eventId)),
      requirementsMet: () => true,
      hasOutstandingBattlesForChain: () => false,
    };
    expect(resolveNpcTaskIndicatorKind("chain_4", chain4Giver, ctx)).toBe("turn_in");
  });

  it("chain_4：e3 交付完成、e5 未接取 → 下一段橙色可接", () => {
    const ctx: NpcTaskIndicatorContext = {
      stableEventId: (_u, ev) => String(ev.eventId),
      isStepComplete: (_u, ev) => ["c4_e1", "c4_e2", "c4_e3"].includes(String(ev.eventId)),
      requirementsMet: () => true,
      hasOutstandingBattlesForChain: () => false,
    };
    expect(isCurrentSegmentAccepted(chain4Giver, "chain_4", ctx)).toBe(false);
    expect(resolveNpcTaskIndicatorKind("chain_4", chain4Giver, ctx)).toBe("available");
  });
});

describe("resolveNpcTaskIndicatorKind — split giver/battle NPC", () => {
  const giverEvents: NpcTaskEvent[] = [
    { eventId: "giver_e1", eventType: "dialog", order: 1, server: { requirements: [], effects: [] } },
    {
      eventId: "giver_e2",
      eventType: "choice",
      order: 2,
      server: { requirements: [], effects: [{ action: "task_accept", taskId: 100004 }] },
    },
    { eventId: "giver_e3", eventType: "dialog", order: 3, server: { requirements: [], effects: [] } },
    {
      eventId: "giver_e4",
      eventType: "task",
      order: 4,
      server: {
        requirements: [{ type: "event_done", eventId: "battle_e1" }],
        effects: [{ action: "task_complete", taskId: 100004 }],
      },
    },
  ];

  const battleEvents: NpcTaskEvent[] = [
    {
      eventId: "battle_e0",
      eventType: "choice",
      order: 1,
      server: { requirements: [], effects: [{ action: "task_accept", taskId: 100004 }] },
    },
    {
      eventId: "battle_e1",
      eventType: "battle",
      order: 2,
      server: { requirements: [], effects: [], battleRef: "battle_1-50" },
    },
  ];

  function makeSplitCtx(overrides: {
    done?: Set<string>;
    battleWon?: Set<string>;
    eventDone?: Set<string>;
  }): NpcTaskIndicatorContext {
    const done = overrides.done ?? new Set<string>();
    const battleWon = overrides.battleWon ?? new Set<string>();
    const eventDone = overrides.eventDone ?? new Set<string>();

    const isBattleWon = (eid: string) => battleWon.has(eid) || eventDone.has(eid);

    return {
      stableEventId: (_uid, ev) => String(ev.eventId),
      isStepComplete: (_uid, ev) => {
        const eid = String(ev.eventId);
        if (ev.eventType === "battle") return isBattleWon(eid);
        return done.has(eid);
      },
      requirementsMet: (reqs) => {
        if (!reqs?.length) return true;
        for (const raw of reqs) {
          const req = raw as { type?: string; eventId?: string };
          if (req.type === "event_done" && req.eventId) {
            if (!isBattleWon(String(req.eventId))) return false;
          }
        }
        return true;
      },
      hasOutstandingBattlesForChain: () => !isBattleWon("battle_e1"),
    };
  }

  it("任务 NPC：已接取且战斗未胜 → 进行中", () => {
    const ctx = makeSplitCtx({
      done: new Set(["giver_e1", "giver_e2", "giver_e3"]),
    });
    expect(resolveNpcTaskIndicatorKind("giver", giverEvents, ctx)).toBe("in_progress");
  });

  it("任务 NPC：战斗已胜 → 可提交", () => {
    const ctx = makeSplitCtx({
      done: new Set(["giver_e1", "giver_e2", "giver_e3"]),
      battleWon: new Set(["battle_e1"]),
    });
    expect(resolveNpcTaskIndicatorKind("giver", giverEvents, ctx)).toBe("turn_in");
  });

  it("任务 NPC：战斗逃跑 → 不可提交", () => {
    const ctx = makeSplitCtx({
      done: new Set(["giver_e1", "giver_e2", "giver_e3"]),
      battleWon: new Set(),
    });
    expect(resolveNpcTaskIndicatorKind("giver", giverEvents, ctx)).toBe("in_progress");
  });

  it("战斗 NPC：接取后、战斗未胜 → 进行中", () => {
    const ctx: NpcTaskIndicatorContext = {
      stableEventId: (_u, ev) => String(ev.eventId),
      isStepComplete: (_u, ev) => String(ev.eventId) === "battle_e0",
      requirementsMet: () => true,
      hasOutstandingBattlesForChain: () => true,
    };
    expect(resolveNpcTaskIndicatorKind("battle", battleEvents, ctx)).toBe("in_progress");
  });

  it("kind → 帧索引与 TaskStatu2 灰 ? / TaskStatu3 橙 ? 对齐", () => {
    expect(npcTaskIndicatorKindToIndex("available")).toBe(0);
    expect(npcTaskIndicatorKindToIndex("in_progress")).toBe(1);
    expect(npcTaskIndicatorKindToIndex("turn_in")).toBe(2);
    expect(npcTaskIndicatorKindToIndex("locked")).toBe(3);
  });
});
