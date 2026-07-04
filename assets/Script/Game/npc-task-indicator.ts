/**
 * NPC 头顶任务状态图标（TaskStatu1~4）判定逻辑
 *
 * 1 橙色 ! — 当前链段尚未接取（含对话中、已至接取选项但未点接受）
 * TaskStatu2 灰色 ? — 本链段已接取，目标/战斗未完成
 * TaskStatu3 橙色 ? — 本链段可交付（战斗与前置均已满足）
 * 4 灰色 ! — 暂不可接（前置/等级/道具等条件未满足）
 *
 * 整条链完成后返回 null → Name/Statu 隐藏（随 NPC 一起消失）
 *
 * map 内多 NPC 链共享同一 taskId 时，按「NPC 链段（segment）」判定，不用全局 active_tasks。
 */

export type NpcTaskIndicatorKind = 'available' | 'turn_in' | 'in_progress' | 'locked';

export type NpcTaskEvent = {
    eventId?: string;
    eventType?: string;
    order?: number;
    server?: {
        requirements?: unknown[];
        effects?: Array<{ action?: string; taskId?: number; choiceId?: string }>;
    };
};

export type NpcTaskIndicatorContext = {
    stableEventId: (npcUid: string, ev: NpcTaskEvent) => string;
    /** 该环是否已完成（战斗须胜利后才算完成） */
    isStepComplete: (npcUid: string, ev: NpcTaskEvent) => boolean;
    requirementsMet: (reqs: unknown[] | undefined) => boolean;
    pickNextInteract?: () => NpcTaskEvent | null;
    /** 本 NPC 链段内是否仍有未胜利的战斗（含关联战斗敌人 NPC） */
    hasOutstandingBattlesForChain?: (npcUid: string, events: NpcTaskEvent[]) => boolean;
};

const TASK_STATUS_FRAME_UUIDS = [
    'eae5753a-2ad0-41e1-a821-2701ad59fc76@f9941',
    'b7957c8e-d4fa-41a3-8b9f-4f1425f75426@f9941',
    '515f0c27-1a6b-4a17-8ab4-8e603a6b8698@f9941',
    '54dde559-12b9-4ecf-80a8-f79e67e414a9@f9941',
] as const;

export function npcTaskIndicatorKindToIndex(kind: NpcTaskIndicatorKind): number {
    switch (kind) {
        case 'available':
            return 0; // TaskStatu1 橙 !
        case 'in_progress':
            return 1; // TaskStatu2 灰 ?
        case 'turn_in':
            return 2; // TaskStatu3 橙 ?
        case 'locked':
            return 3; // TaskStatu4 灰 !
        default:
            return 0;
    }
}

export function getNpcTaskStatusFrameUuids(): readonly string[] {
    return TASK_STATUS_FRAME_UUIDS;
}

function eventHasEffect(ev: NpcTaskEvent, action: string, taskId?: number): boolean {
    const effects = ev.server?.effects ?? [];
    return effects.some((eff) => {
        if (String(eff.action ?? '') !== action) return false;
        if (taskId != null && Number(eff.taskId) !== taskId) return false;
        return true;
    });
}

function eventIsTaskAccept(ev: NpcTaskEvent): boolean {
    return (
        (ev.eventType === 'task' || ev.eventType === 'choice') && eventHasEffect(ev, 'task_accept')
    );
}

function eventIsTaskTurnIn(ev: NpcTaskEvent): boolean {
    return ev.eventType === 'task' && eventHasEffect(ev, 'task_complete');
}

/** 本链段是否已完成接取（task_accept 环）；task_complete 完成会重置段 */
export function isCurrentSegmentAccepted(
    sorted: NpcTaskEvent[],
    npcUid: string,
    ctx: NpcTaskIndicatorContext,
): boolean {
    let segmentAcceptEv: NpcTaskEvent | null = null;
    for (const ev of sorted) {
        if (eventIsTaskTurnIn(ev) && ctx.isStepComplete(npcUid, ev)) {
            segmentAcceptEv = null;
            continue;
        }
        if (!ctx.isStepComplete(npcUid, ev)) {
            if (eventIsTaskAccept(ev)) return false;
            return segmentAcceptEv != null;
        }
        if (eventIsTaskAccept(ev)) {
            segmentAcceptEv = ev;
        }
    }
    return false;
}

/** 当前链段内第一个未完成的交付环 */
function findCurrentSegmentTurnIn(
    sorted: NpcTaskEvent[],
    npcUid: string,
    ctx: NpcTaskIndicatorContext,
): NpcTaskEvent | null {
    let segmentStartOrder = 0;
    for (const ev of sorted) {
        if (eventIsTaskTurnIn(ev) && ctx.isStepComplete(npcUid, ev)) {
            segmentStartOrder = (ev.order ?? 0) + 1;
        }
    }
    for (const ev of sorted) {
        if ((ev.order ?? 0) < segmentStartOrder) continue;
        if (!eventIsTaskTurnIn(ev)) continue;
        if (!ctx.isStepComplete(npcUid, ev)) return ev;
    }
    return null;
}

function hasPendingTurnInRequirements(
    turnInEv: NpcTaskEvent,
    ctx: NpcTaskIndicatorContext,
): boolean {
    const reqs = turnInEv.server?.requirements as unknown[] | undefined;
    if (!reqs?.length) return false;
    return !ctx.requirementsMet(reqs);
}

function hasIncompleteBattleBeforeTurnIn(
    sorted: NpcTaskEvent[],
    npcUid: string,
    turnInEv: NpcTaskEvent,
    ctx: NpcTaskIndicatorContext,
): boolean {
    const turnOrder = turnInEv.order ?? Number.MAX_SAFE_INTEGER;
    for (const ev of sorted) {
        if ((ev.order ?? 0) >= turnOrder) break;
        if (ev.eventType !== 'battle') continue;
        if (!ctx.isStepComplete(npcUid, ev)) return true;
    }
    return false;
}

function isTurnInReady(
    sorted: NpcTaskEvent[],
    npcUid: string,
    turnInEv: NpcTaskEvent,
    ctx: NpcTaskIndicatorContext,
): boolean {
    if (hasIncompleteBattleBeforeTurnIn(sorted, npcUid, turnInEv, ctx)) return false;
    if (hasPendingTurnInRequirements(turnInEv, ctx)) return false;
    const turnOrder = turnInEv.order ?? Number.MAX_SAFE_INTEGER;
    for (const ev of sorted) {
        if ((ev.order ?? 0) >= turnOrder) continue;
        if (eventIsTaskTurnIn(ev)) continue;
        if (!ctx.isStepComplete(npcUid, ev)) return false;
    }
    return true;
}

export function extractPrimaryTaskId(events: NpcTaskEvent[]): number | null {
    for (const ev of events) {
        for (const eff of ev.server?.effects ?? []) {
            const action = String(eff.action ?? '');
            if (action === 'task_accept' || action === 'task_complete') {
                const tid = Number(eff.taskId ?? 0);
                if (tid > 0) return tid;
            }
        }
    }
    return null;
}

export function resolveNpcTaskIndicatorKind(
    npcUid: string,
    events: NpcTaskEvent[] | null | undefined,
    ctx: NpcTaskIndicatorContext,
): NpcTaskIndicatorKind | null {
    const list = events ?? [];
    if (!list.length) return null;

    const sorted = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    let firstIncomplete: NpcTaskEvent | null = null;
    for (const ev of sorted) {
        if (!ctx.isStepComplete(npcUid, ev)) {
            firstIncomplete = ev;
            break;
        }
    }
    if (!firstIncomplete) return null;

    const segmentAccepted = isCurrentSegmentAccepted(sorted, npcUid, ctx);
    const reqs = firstIncomplete.server?.requirements as unknown[] | undefined;
    if (!ctx.requirementsMet(reqs)) {
        // 已接取段的交付环：战斗/前置未满足 → 灰 ?，不是灰 !
        if (segmentAccepted && eventIsTaskTurnIn(firstIncomplete)) {
            return 'in_progress';
        }
        return 'locked';
    }

    if (!segmentAccepted) {
        return 'available';
    }

    if (ctx.hasOutstandingBattlesForChain?.(npcUid, list)) {
        return 'in_progress';
    }

    const turnInEv = findCurrentSegmentTurnIn(sorted, npcUid, ctx);
    if (turnInEv && isTurnInReady(sorted, npcUid, turnInEv, ctx)) {
        return 'turn_in';
    }

    return 'in_progress';
}
