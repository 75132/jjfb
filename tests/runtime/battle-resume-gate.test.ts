import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  applyResumeAfterRestore,
  beginResume,
  cachePendingResume,
  clearPendingResume,
  createBattleResumeGate,
  createDebounceSchedule,
  createPendingResumeCache,
  endResume,
  forceClearInFlight,
  invalidateForCharacterChange,
  isPendingResumeStillValid,
  isResumeResponseAcceptable,
  isStaleResume,
  markRoomApplied,
  RESUME_DEBOUNCE_MS,
  scheduleDebounced,
  shouldOpenBattlePanel,
  shouldSkipDuplicateRestore,
} from "../../assets/Script/Game/battle-resume-gate.ts";
import { validateBattleRestoreState } from "../../assets/Script/Game/battle-restore.ts";
import {
  resolveOnEnableAction,
  resumeIntentAllowsCreate,
  shouldPrefetchResumeBeforeCreate,
  validateStoryBattleCreate,
} from "../../assets/Script/Game/battle-entry-intent.ts";

function sampleState(overrides: Record<string, unknown> = {}) {
  return {
    room_id: "room-1",
    status: "in_progress",
    character_id: "cid-A",
    player: { hp: 100, name: "P", character_id: "cid-A" },
    enemy: { hp: 80, name: "E" },
    ...overrides,
  };
}

describe("battle-resume-gate", () => {
  it("opens panel only for in_progress room", () => {
    expect(
      shouldOpenBattlePanel({
        success: true,
        data: { has_room: true, state: { status: "in_progress", room_id: "a" } },
      }),
    ).toBe(true);
    expect(shouldOpenBattlePanel({ success: true, data: { has_room: false } })).toBe(false);
    expect(
      shouldOpenBattlePanel({
        success: true,
        data: { has_room: true, state: { status: "finished", room_id: "a" } },
      }),
    ).toBe(false);
  });

  it("serializes resume: second begin while in-flight keeps single logical flight", () => {
    const gate = createBattleResumeGate();
    const g1 = beginResume(gate, "cid-1");
    expect(gate.inFlight).toBe(true);
    const g2 = beginResume(gate, "cid-1");
    expect(g2).toBeGreaterThan(g1);
    expect(isStaleResume(gate, g1)).toBe(true);
    endResume(gate, g2);
    expect(gate.inFlight).toBe(false);
  });

  it("drops stale late response", () => {
    const gate = createBattleResumeGate();
    const oldGen = beginResume(gate, "cid-1");
    const newGen = beginResume(gate, "cid-1");
    endResume(gate, newGen);
    expect(isStaleResume(gate, oldGen)).toBe(true);
  });

  it("skips duplicate room restore", () => {
    const gate = createBattleResumeGate();
    const state = { room_id: "room-1", status: "in_progress" };
    markRoomApplied(gate, state);
    expect(shouldSkipDuplicateRestore(gate, state)).toBe(true);
    expect(shouldSkipDuplicateRestore(gate, { room_id: "room-2", status: "in_progress" })).toBe(false);
  });

  it("restore returns false does not mark room", () => {
    const gate = createBattleResumeGate();
    const state = sampleState();
    const result = applyResumeAfterRestore(gate, state, () => false);
    expect(result.restored).toBe(false);
    expect(result.marked).toBe(false);
    expect(gate.lastAppliedRoomId).toBeNull();
  });

  it("restore returns true then marks room", () => {
    const gate = createBattleResumeGate();
    const state = sampleState();
    const result = applyResumeAfterRestore(gate, state, () => true);
    expect(result.marked).toBe(true);
    expect(gate.lastAppliedRoomId).toBe("room-1");
  });

  it("caches pending when BattleScene not registered and applies after register", () => {
    const gate = createBattleResumeGate();
    const pending = createPendingResumeCache();
    const gen = beginResume(gate, "cid-A");
    endResume(gate, gen);
    const state = sampleState();
    cachePendingResume(pending, state, "cid-A", gate.generation);
    expect(pending.state).not.toBeNull();
    expect(gate.lastAppliedRoomId).toBeNull();

    const valid = isPendingResumeStillValid(gate, pending, "cid-A");
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    const applied = applyResumeAfterRestore(gate, valid.state, () => true);
    clearPendingResume(pending);
    expect(applied.marked).toBe(true);
    expect(pending.state).toBeNull();
  });

  it("discards pending cache belonging to old character", () => {
    const gate = createBattleResumeGate();
    const pending = createPendingResumeCache();
    beginResume(gate, "cid-A");
    endResume(gate, gate.generation);
    cachePendingResume(pending, sampleState(), "cid-A", gate.generation);
    const valid = isPendingResumeStillValid(gate, pending, "cid-B");
    expect(valid.ok).toBe(false);
  });

  it("five consecutive events via debounce only fire once", async () => {
    vi.useFakeTimers();
    const schedule = createDebounceSchedule();
    const runs: string[][] = [];
    for (const reason of [
      "boot",
      "auth_response",
      "select_character_response",
      "network_connect",
      "game_ids_saved",
    ]) {
      scheduleDebounced(schedule, reason, RESUME_DEBOUNCE_MS, (merged) => {
        runs.push(merged);
      });
    }
    expect(runs).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(RESUME_DEBOUNCE_MS + 10);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual([
      "boot",
      "auth_response",
      "select_character_response",
      "network_connect",
      "game_ids_saved",
    ]);
    vi.useRealTimers();
  });

  it("character change invalidates old response", () => {
    const gate = createBattleResumeGate();
    const pending = createPendingResumeCache();
    const gen = beginResume(gate, "cid-A");
    cachePendingResume(pending, sampleState(), "cid-A", gen);
    invalidateForCharacterChange(gate, pending, "cid-B");
    expect(gate.inFlight).toBe(false);
    expect(gate.lastAppliedRoomId).toBeNull();
    expect(pending.state).toBeNull();
    expect(isStaleResume(gate, gen)).toBe(true);
    const check = isResumeResponseAcceptable(gate, {
      requestGeneration: gen,
      requestCharacterId: "cid-A",
      currentCharacterId: "cid-B",
      authenticated: true,
      connected: true,
    });
    expect(check.ok).toBe(false);
  });

  it("timeout clears inFlight via forceClearInFlight", () => {
    const gate = createBattleResumeGate();
    beginResume(gate, "cid-A");
    expect(gate.inFlight).toBe(true);
    forceClearInFlight(gate);
    expect(gate.inFlight).toBe(false);
  });

  it("same room_id not reapplied", () => {
    const gate = createBattleResumeGate();
    const state = sampleState();
    applyResumeAfterRestore(gate, state, () => true);
    const again = applyResumeAfterRestore(gate, state, () => true);
    expect(again.reason).toBe("duplicate_room");
    expect(again.marked).toBe(false);
  });
});

describe("battle-restore validation", () => {
  it("rejects incomplete state", () => {
    expect(validateBattleRestoreState(null, "cid-A").ok).toBe(false);
    expect(validateBattleRestoreState({ status: "in_progress" }, "cid-A").ok).toBe(false);
    expect(
      validateBattleRestoreState(
        { room_id: "r1", status: "finished", player: { hp: 1 }, enemy: { hp: 1 } },
        "cid-A",
      ).ok,
    ).toBe(false);
    expect(
      validateBattleRestoreState(
        { room_id: "r1", status: "in_progress", player: { hp: 1 }, enemy: { hp: 1 }, character_id: "cid-B" },
        "cid-A",
      ).ok,
    ).toBe(false);
  });

  it("accepts valid in_progress state", () => {
    const r = validateBattleRestoreState(sampleState(), "cid-A");
    expect(r.ok).toBe(true);
  });
});

describe("battle-entry-intent", () => {
  it("resume intent does not trigger create", () => {
    expect(resolveOnEnableAction("resume")).toBe("resume-ready");
    expect(resumeIntentAllowsCreate("resume")).toBe(false);
  });

  it("story intent missing event_id rejects create", () => {
    const r = validateStoryBattleCreate({ mapCode: "m1", battleRef: "br1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_event_id");
  });

  it("new-pve intent does not prefetch resume", () => {
    expect(resolveOnEnableAction("new-pve")).toBe("create-pve");
    expect(shouldPrefetchResumeBeforeCreate("new-pve")).toBe(false);
  });

  it("BattleScene disable does not imply room finished (gate keeps mark)", () => {
    // 关闭面板不应 clearAppliedRoom；仅 notifyRoomFinished 才清
    const gate = createBattleResumeGate();
    markRoomApplied(gate, sampleState());
    // 模拟 onDisable：不调用 clearAppliedRoom
    expect(gate.lastAppliedRoomId).toBe("room-1");
  });
});
