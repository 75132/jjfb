import { describe, expect, it } from "vitest";
import {
  isBattleInteractAction,
  isChoiceBlockedMessage,
  shouldCompleteChoice,
  shouldStartBattleFromChoice,
} from "../../assets/Script/Game/story-event-flow";

describe("story-event-flow", () => {
  it("shouldCompleteChoice respects defer and allowedChoiceIds", () => {
    expect(shouldCompleteChoice({ id: "no", completesEvent: false }, { server: { allowedChoiceIds: ["yes"] } })).toBe(
      false,
    );
    expect(shouldCompleteChoice({ id: "no", forcedResult: "block" }, { server: { allowedChoiceIds: ["yes"] } })).toBe(
      false,
    );
    expect(shouldCompleteChoice({ id: "yes" }, { server: { allowedChoiceIds: ["yes"] } })).toBe(true);
    expect(shouldCompleteChoice({ id: "maybe" }, { server: { allowedChoiceIds: ["yes"] } })).toBe(false);
  });

  it("shouldStartBattleFromChoice only when start_battle or explicit battle opt", () => {
    expect(
      shouldStartBattleFromChoice({ id: "go", forcedResult: "start_battle" }, { eventType: "battle" }),
    ).toBe(true);
    expect(
      shouldStartBattleFromChoice({ id: "flee", forcedResult: "block" }, {
        eventType: "battle",
        client: { choiceScriptId: "pre" },
      }),
    ).toBe(false);
    expect(
      shouldStartBattleFromChoice({ id: "go" }, {
        eventType: "battle",
        client: { choiceScriptId: "pre" },
      }),
    ).toBe(false);
  });

  it("isBattleInteractAction detects battle flows", () => {
    expect(isBattleInteractAction({ action: "choice_then_battle" }, { eventType: "dialog" })).toBe(true);
    expect(isBattleInteractAction({ action: "dialog" }, { eventType: "battle" })).toBe(true);
    expect(isBattleInteractAction(undefined, { eventType: "choice" })).toBe(false);
  });

  it("isChoiceBlockedMessage", () => {
    expect(isChoiceBlockedMessage("choice_blocked")).toBe(true);
    expect(isChoiceBlockedMessage("ok")).toBe(false);
  });
});
