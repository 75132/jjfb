import { describe, expect, it } from "vitest";
import {
  isPseudoBattleResultScript,
  sanitizeBattlePseudoChoicesInRuntime,
} from "../../assets/Script/Game/story-runtime-sanitize";

describe("story-runtime-sanitize", () => {
  it("detects win/lose pseudo battle result script", () => {
    expect(
      isPseudoBattleResultScript({
        title: "战斗",
        options: [
          { id: "w", text: "胜利", forcedResult: "start_battle" },
          { id: "l", text: "失败", completesEvent: false, forcedResult: "block" },
        ],
      }),
    ).toBe(true);
    expect(
      isPseudoBattleResultScript({
        title: "战前选择",
        options: [
          { id: "go", text: "进入战斗", forcedResult: "start_battle" },
          { id: "no", text: "稍后再来", completesEvent: false, forcedResult: "block" },
        ],
      }),
    ).toBe(false);
  });

  it("strips pseudo choices from battle events but keeps pre-battle choice events", () => {
    const map = {
      client: {
        choiceScripts: {
          pre_battle: {
            title: "战前",
            options: [
              { id: "go", text: "进入战斗", forcedResult: "start_battle" },
              { id: "no", text: "稍后再来", completesEvent: false, forcedResult: "block" },
            ],
          },
          pseudo_result: {
            title: "战斗",
            options: [
              { id: "w", text: "胜利", forcedResult: "start_battle" },
              { id: "l", text: "失败", completesEvent: false, forcedResult: "block" },
            ],
          },
        },
      },
      npcs: [
        {
          npcUid: "enemy",
          events: [
            {
              eventType: "choice",
              eventId: "e1",
              client: { choiceScriptId: "pre_battle" },
            },
            {
              eventType: "battle",
              eventId: "e2",
              client: { choiceScriptId: "pseudo_result" },
              server: { allowedChoiceIds: ["w"], battleRef: "battle_1-50" },
            },
          ],
        },
      ],
    };

    const result = sanitizeBattlePseudoChoicesInRuntime(map);
    expect(result.battleEventsFixed).toBe(1);
    expect(result.scriptsRemoved).toBe(1);
    expect(map.client?.choiceScripts?.pseudo_result).toBeUndefined();
    expect(map.client?.choiceScripts?.pre_battle).toBeTruthy();

    const battleEv = map.npcs?.[0]?.events?.[1];
    expect(battleEv?.client?.choiceScriptId).toBeUndefined();
    expect(battleEv?.server?.allowedChoiceIds).toBeUndefined();
    expect(battleEv?.server?.battleRef).toBe("battle_1-50");
  });
});
