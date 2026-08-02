import { describe, expect, it } from "vitest";
import {
  beginResume,
  createBattleResumeGate,
  endResume,
  isActiveRoomConflict,
  isStaleResume,
  markRoomApplied,
  shouldOpenBattlePanel,
  shouldSkipDuplicateRestore,
} from "../../assets/Script/Game/battle-resume-gate.ts";

describe("battle-resume-gate", () => {
  it("opens panel only for in_progress room", () => {
    expect(
      shouldOpenBattlePanel({
        success: true,
        data: { has_room: true, state: { status: "in_progress", room_id: "a" } },
      }),
    ).toBe(true);
    expect(
      shouldOpenBattlePanel({
        success: true,
        data: { has_room: false },
      }),
    ).toBe(false);
    expect(
      shouldOpenBattlePanel({
        success: true,
        data: { has_room: true, state: { status: "finished", room_id: "a" } },
      }),
    ).toBe(false);
  });

  it("serializes resume: second begin while in-flight keeps single logical flight", () => {
    const gate = createBattleResumeGate();
    const g1 = beginResume(gate);
    expect(gate.inFlight).toBe(true);
    // Controller skips if inFlight; gate itself allows generation bump for stale drop
    const g2 = beginResume(gate);
    expect(g2).toBeGreaterThan(g1);
    expect(isStaleResume(gate, g1)).toBe(true);
    expect(isStaleResume(gate, g2)).toBe(false);
    endResume(gate, g2);
    expect(gate.inFlight).toBe(false);
  });

  it("drops stale late response", () => {
    const gate = createBattleResumeGate();
    const oldGen = beginResume(gate);
    const newGen = beginResume(gate);
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

  it("detects active room conflict from create", () => {
    expect(
      isActiveRoomConflict({
        success: false,
        code: 409,
        error_code: "ACTIVE_BATTLE_ROOM",
        message: "已有进行中的战斗房间，请先恢复",
      }),
    ).toBe(true);
    expect(isActiveRoomConflict({ success: true })).toBe(false);
  });

  it("resume failure / no room must not imply create", () => {
    // 文档级断言：gate 不含 create 能力；失败路径 shouldOpen=false
    expect(shouldOpenBattlePanel({ success: false })).toBe(false);
    expect(
      shouldOpenBattlePanel({ success: true, data: { has_room: false } }),
    ).toBe(false);
  });
});
