import { describe, expect, it } from "vitest";
import { buildLocalCompletePayload } from "../../assets/Script/Game/story-local-mode";

describe("story-local-mode", () => {
    it("buildLocalCompletePayload filters effects by choiceId", () => {
        const ev = {
            server: {
                effects: [
                    { action: "task_accept", taskId: 100001, choiceId: "opt_a" },
                    { action: "task_accept", taskId: 100002, choiceId: "opt_b" },
                ],
            },
        };
        const data = buildLocalCompletePayload(ev, "opt_a");
        const applied = data.applied_effects as Array<{ taskId?: number; choiceId?: string }>;
        expect(applied).toHaveLength(1);
        expect(applied[0].taskId).toBe(100001);
    });
});
