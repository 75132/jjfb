/**
 * NPC 可见性统一判定：appear + mainline_step + 顺序显现（RMV 条件事件页）。
 */

import { evaluateAppearRequirements, type StoryRequirementContext } from './story-requirements';

export type NpcAppearConfig = {
    mode?: 'always' | 'conditional';
    matchMode?: 'ALL' | 'ANY';
    requirements?: unknown[];
};

export type NpcVisibilityRow = {
    npcUid?: string;
    initialHidden?: boolean;
    appear?: NpcAppearConfig;
    events?: unknown[];
};

export type NpcVisibilityState = {
    revealedNpcUids: ReadonlySet<string>;
    mainlineStep: number;
    taskDefs: ReadonlyMap<number, { mainlineStep?: number }>;
    sequentialReveal: boolean;
    storyNpcOrder: readonly string[];
    reqCtx: StoryRequirementContext;
    isBattleEnemyNpcUid: (uid: string) => boolean;
    hasActiveInteractEvent: (npcUid: string, events: unknown[]) => boolean;
    isNpcHiddenByAppear: (npcUid: string, row: NpcVisibilityRow | undefined) => boolean;
};

/** NPC 是否因 mainline_step 未达标而隐藏（读 tasks[].mainlineStep） */
export function isHiddenByMainlineStep(
    row: NpcVisibilityRow | undefined,
    state: NpcVisibilityState,
): boolean {
    if (!row?.events?.length) return false;
    let minStep = Number.POSITIVE_INFINITY;
    let hasStep = false;
    for (const raw of row.events) {
        const ev = raw as { server?: { requirements?: unknown[] } };
        for (const req of ev.server?.requirements ?? []) {
            const r = req as Record<string, unknown>;
            const t = String(r.type ?? r.action ?? '');
            if (t === 'mainline_step') {
                hasStep = true;
                minStep = Math.min(minStep, Number(r.value ?? 0));
            }
        }
    }
    if (!hasStep) return false;
    return state.mainlineStep < minStep;
}

export function resolveCurrentMainlineNpcUid(state: NpcVisibilityState): string | null {
    for (const uid of state.storyNpcOrder) {
        if (state.isBattleEnemyNpcUid(uid)) continue;
        if (state.isNpcHiddenByAppear(uid, undefined)) continue;
        const row = { npcUid: uid } as NpcVisibilityRow;
        if (isHiddenByMainlineStep(row, state)) continue;
        if (state.hasActiveInteractEvent(uid, [])) return uid;
    }
    return null;
}

export function isStaleMainlineGiver(
    npcUid: string,
    storyNpcOrder: readonly string[],
    isBattleEnemy: (uid: string) => boolean,
    isHiddenByAppear: (uid: string) => boolean,
    hasIncomplete: (uid: string) => boolean,
    hasInteract: (uid: string) => boolean,
): boolean {
    // 仍有未完成环（含战斗交付等暂不可对话的环）时，不得被后续链挤掉
    if (hasIncomplete(npcUid)) return false;
    if (hasInteract(npcUid)) return false;
    const myIdx = storyNpcOrder.indexOf(npcUid);
    if (myIdx < 0) return false;
    for (let i = myIdx + 1; i < storyNpcOrder.length; i++) {
        const later = storyNpcOrder[i];
        if (isBattleEnemy(later)) continue;
        if (isHiddenByAppear(later)) continue;
        if (hasIncomplete(later)) return true;
    }
    return false;
}

export function parseEnemyGiverUid(npcUid: string): string | null {
    const m = npcUid.match(/^(.+?)_enemy(?:_\d+)?$/);
    return m?.[1] ?? null;
}

export type NpcVisibilityDecision = {
    visible: boolean;
    colliderEnabled: boolean;
    isCurrentMainline: boolean;
};

export function decideNpcVisibility(
    npcUid: string,
    row: NpcVisibilityRow | undefined,
    events: unknown[],
    state: NpcVisibilityState,
    currentMainlineUid: string | null,
    isAncestorOfCurrent: boolean,
): NpcVisibilityDecision {
    if (state.isBattleEnemyNpcUid(npcUid)) {
        const show = state.hasActiveInteractEvent(npcUid, events);
        return { visible: show, colliderEnabled: show, isCurrentMainline: false };
    }

    if (state.isNpcHiddenByAppear(npcUid, row)) {
        return { visible: false, colliderEnabled: false, isCurrentMainline: false };
    }

    if (isHiddenByMainlineStep(row, state)) {
        return { visible: false, colliderEnabled: false, isCurrentMainline: false };
    }

    if (!state.sequentialReveal) {
        const active = state.hasActiveInteractEvent(npcUid, events);
        return {
            visible: active || (events?.length ?? 0) > 0,
            colliderEnabled: active,
            isCurrentMainline: false,
        };
    }

    if (currentMainlineUid === null) {
        const active = state.hasActiveInteractEvent(npcUid, events);
        if (active) {
            return { visible: true, colliderEnabled: true, isCurrentMainline: false };
        }
        return { visible: false, colliderEnabled: false, isCurrentMainline: false };
    }

    const isCurrent = npcUid === currentMainlineUid;
    const show = isCurrent || isAncestorOfCurrent;
    return {
        visible: show,
        colliderEnabled: isCurrent,
        isCurrentMainline: isCurrent,
    };
}

/** appear 条件是否满足（不含 reveal_npc 与 initialHidden） */
export function npcAppearRequirementsMet(
    row: NpcVisibilityRow | undefined,
    ctx: StoryRequirementContext,
): boolean {
    const appear = row?.appear;
    if (!appear || appear.mode !== 'conditional') return appear?.mode === 'always';
    return evaluateAppearRequirements(appear.requirements, appear.matchMode, ctx);
}

export function isNpcHiddenUntilReveal(
    npcUid: string,
    row: NpcVisibilityRow | undefined,
    revealedNpcUids: ReadonlySet<string>,
    ctx: StoryRequirementContext,
): boolean {
    if (!row) return false;
    if (revealedNpcUids.has(npcUid)) return false;
    if (row.appear?.mode === 'always') return false;
    if (npcAppearRequirementsMet(row, ctx)) return false;
    if (!row.appear && !row.initialHidden) return false;
    return true;
}
