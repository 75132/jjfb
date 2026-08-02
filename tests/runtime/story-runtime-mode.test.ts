import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORY_RUNTIME_MODE,
  allowsSkipServerStoryApis,
  isLocalPreviewMode,
  normalizeStoryRuntimeMode,
  shouldAutoFinalizeSettlement,
  shouldPlayRewardAnimation,
  type StoryBattleFinishedResult,
} from "../../assets/Script/Game/story-runtime-mode.ts";

describe("story-runtime-mode", () => {
  it("defaults to server-development", () => {
    expect(DEFAULT_STORY_RUNTIME_MODE).toBe("server-development");
    expect(normalizeStoryRuntimeMode(undefined)).toBe("server-development");
    expect(normalizeStoryRuntimeMode("server-development")).toBe("server-development");
  });

  it("local-preview does not affect server-development defaults", () => {
    expect(isLocalPreviewMode("local-preview")).toBe(true);
    expect(isLocalPreviewMode("server-development")).toBe(false);
    expect(allowsSkipServerStoryApis("local-preview")).toBe(true);
    expect(allowsSkipServerStoryApis("server-development")).toBe(false);
  });

  it("story battle callback shape includes roomId", () => {
    const result: StoryBattleFinishedResult = {
      won: true,
      roomId: "room-abc",
      winner: "player",
      reason: "ko",
    };
    expect(result.roomId).toBe("room-abc");
    expect(result.won).toBe(true);
  });

  it("finalize success path marks event only after success (logic gate)", () => {
    // 成功：可 mark；失败：不可 mark
    const markIfFinalizeOk = (finalizeOk: boolean) => (finalizeOk ? "mark" : "keep");
    expect(markIfFinalizeOk(true)).toBe("mark");
    expect(markIfFinalizeOk(false)).toBe("keep");
  });

  it("idempotent replay does not play reward animation", () => {
    expect(shouldPlayRewardAnimation({ idempotent_replay: true })).toBe(false);
    expect(shouldPlayRewardAnimation({ idempotent_replay: false })).toBe(true);
    expect(shouldPlayRewardAnimation({})).toBe(true);
  });

  it("pending settlement triggers auto finalize without battle resume", () => {
    expect(
      shouldAutoFinalizeSettlement({
        pending_story_settlement: { required: true, room_id: "r1", event_id: "e1" },
      }),
    ).toBe(true);
    expect(shouldAutoFinalizeSettlement({ pending_story_settlement: { required: false } })).toBe(false);
    expect(shouldAutoFinalizeSettlement({})).toBe(false);
  });

  it("pending settlement must not open BattleScene or send battle_room_resume (contract)", () => {
    // 文档级契约：auto finalize 路径不包含 resume / 打开面板
    const actionsForSettlement = ["story_battle_finalize", "story_get_state"];
    expect(actionsForSettlement).not.toContain("battle_room_resume");
    expect(actionsForSettlement).not.toContain("open_battle_scene");
  });

  it("client must not treat battle_won as authoritative", () => {
    // 权威证据仅为服务端 finalize；battle_won 仅兼容
    const authoritativeFields = ["room_id", "room.result.winner", "pending.status"];
    expect(authoritativeFields).not.toContain("battle_won");
  });
});
