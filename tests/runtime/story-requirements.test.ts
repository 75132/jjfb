import { describe, expect, it } from 'vitest';
import {
    evaluateSingleRequirement,
    type StoryRequirementContext,
} from '@game/story-requirements';

function ctx(partial: Partial<StoryRequirementContext> = {}): StoryRequirementContext {
    return {
        completedEventIds: new Set(),
        battleClearedEventIds: new Set(),
        completedTaskIds: new Set(),
        acceptedTaskIds: new Set(),
        activeTaskIds: new Set(),
        mainlineStep: 0,
        playerLevel: 10,
        ownedItemIds: new Set(),
        isEventQuestStepComplete: () => false,
        ...partial,
    };
}

describe('story-requirements (runtime strict)', () => {
    it('rejects planned types in server-development strict mode', () => {
        expect(evaluateSingleRequirement({ type: 'story_var_equals', varId: 'x', value: 1 }, ctx())).toBe(
            false,
        );
    });

    it('allows preview passthrough when unknownRequirementPasses=true', () => {
        expect(
            evaluateSingleRequirement(
                { type: 'story_var_equals', varId: 'x', value: 1 },
                ctx({ unknownRequirementPasses: true }),
            ),
        ).toBe(true);
    });
});
