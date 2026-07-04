import { describe, expect, it } from "vitest";
import { decideNpcVisibility, isStaleMainlineGiver, parseEnemyGiverUid } from "../../assets/Script/Game/story-npc-visibility";
import type { StoryRequirementContext } from "../../assets/Script/Game/story-requirements";

const baseCtx: StoryRequirementContext = {
    completedEventIds: new Set(),
    battleClearedEventIds: new Set(),
    completedTaskIds: new Set(),
    acceptedTaskIds: new Set([100001]),
    activeTaskIds: new Set([100001]),
    mainlineStep: 1,
    playerLevel: 1,
    ownedItemIds: new Set(),
    isEventQuestStepComplete: () => false,
};

describe("story-npc-visibility", () => {
    it("parseEnemyGiverUid extracts giver from enemy uid", () => {
        expect(parseEnemyGiverUid("task_1_enemy")).toBe("task_1");
        expect(parseEnemyGiverUid("task_3_enemy")).toBe("task_3");
        expect(parseEnemyGiverUid("task_3_enemy_2")).toBe("task_3");
        expect(parseEnemyGiverUid("task_3")).toBeNull();
    });

    it("skips stale giver when later chain is active and giver fully done", () => {
        const order = ["task_1", "task_2", "task_3"];
        const incomplete = new Set(["task_3"]);
        const interact = new Set<string>();
        expect(
            isStaleMainlineGiver(
                "task_1",
                order,
                (u) => u.endsWith("_enemy"),
                () => false,
                (u) => incomplete.has(u),
                (u) => interact.has(u),
            ),
        ).toBe(true);
        expect(
            isStaleMainlineGiver(
                "task_1",
                order,
                (u) => u.endsWith("_enemy"),
                () => false,
                (u) => new Set(["task_1", "task_3"]).has(u),
                (u) => interact.has(u),
            ),
        ).toBe(false);
        expect(
            isStaleMainlineGiver(
                "task_3",
                order,
                (u) => u.endsWith("_enemy"),
                () => false,
                (u) => incomplete.has(u),
                (u) => interact.has(u),
            ),
        ).toBe(false);
    });

    it("battle enemy only visible when hasActiveInteractEvent allows (giver = current mainline)", () => {
        const makeState = (currentUid: string) => ({
            revealedNpcUids: new Set<string>(),
            mainlineStep: 1,
            taskDefs: new Map(),
            sequentialReveal: true,
            storyNpcOrder: ["task_1", "task_3", "task_1_enemy", "task_3_enemy"],
            reqCtx: baseCtx,
            isBattleEnemyNpcUid: (uid: string) => uid.endsWith("_enemy"),
            hasActiveInteractEvent: (uid: string) => {
                const giver = parseEnemyGiverUid(uid);
                return !giver || giver === currentUid;
            },
            isNpcHiddenByAppear: () => false,
        });
        const onTask3 = decideNpcVisibility(
            "task_3_enemy",
            { npcUid: "task_3_enemy" },
            [{}],
            makeState("task_3"),
            "task_3",
            false,
        );
        expect(onTask3.visible).toBe(true);

        const onTask1 = decideNpcVisibility(
            "task_1_enemy",
            { npcUid: "task_1_enemy" },
            [{}],
            makeState("task_3"),
            "task_3",
            false,
        );
        expect(onTask1.visible).toBe(false);
    });

    it("giver with incomplete blocked steps is not stale when later chain appeared", () => {
        const order = ["chain_1", "chain_2", "chain_3"];
        const incomplete = new Set(["chain_2"]);
        expect(
            isStaleMainlineGiver(
                "chain_2",
                order,
                () => false,
                (u) => u === "chain_3",
                (u) => incomplete.has(u),
                () => false,
            ),
        ).toBe(false);
    });

    it("sequential mode keeps battle enemy visible when fallback active interact", () => {
        const makeState = (currentUid: string) => ({
            revealedNpcUids: new Set<string>(),
            mainlineStep: 1,
            taskDefs: new Map(),
            sequentialReveal: true,
            storyNpcOrder: ["chain_2", "chain_2_enemy"],
            reqCtx: baseCtx,
            isBattleEnemyNpcUid: (uid: string) => uid.endsWith("_enemy"),
            hasActiveInteractEvent: (uid: string) => uid === "chain_2_enemy",
            isNpcHiddenByAppear: () => false,
        });
        const enemy = decideNpcVisibility(
            "chain_2_enemy",
            { npcUid: "chain_2_enemy" },
            [{}],
            makeState("chain_2"),
            "chain_2",
            false,
        );
        expect(enemy.visible).toBe(true);
    });
});
