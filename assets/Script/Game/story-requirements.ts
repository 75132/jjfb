/**
 * 剧情 requirement 求值（对齐 server/services/story_service.py check_requirements）。
 *
 * 契约：仅 manifest capabilities.requirements.supported 内的 type 有完整客户端求值。
 * 未知 / planned type 在 strict 模式下返回 false（默认）；local-preview 可设 unknownPasses=true。
 */

export type StoryRequirementContext = {
    completedEventIds: ReadonlySet<string>;
    battleClearedEventIds: ReadonlySet<string>;
    completedTaskIds: ReadonlySet<number>;
    acceptedTaskIds: ReadonlySet<number>;
    activeTaskIds: ReadonlySet<number>;
    mainlineStep: number;
    playerLevel: number;
    ownedItemIds: ReadonlySet<number>;
    /** 事件 id 是否已完成（战斗须胜利） */
    isEventQuestStepComplete: (eventId: string) => boolean;
    debugLog?: boolean;
    onUnknownRequirement?: (type: string) => void;
    /**
     * local-preview 专用：未知/planned requirement 视为通过（勿用于 server-development）。
     * 默认 false，与 manifest v2 strict 契约一致。
     */
    unknownRequirementPasses?: boolean;
};

/** manifest v2 planned — 客户端不实现，strict 下恒 false */
const PLANNED_REQUIREMENT_TYPES = new Set([
    'story_var_equals',
    'var_equals',
    'server_var_equals',
    'has_pet',
    'bag_space_at_least',
    'activity_switch_on',
]);

function reqType(raw: Record<string, unknown>): string {
    return String(raw.type ?? raw.action ?? '');
}

function isPlannedRequirementType(rtype: string): boolean {
    return PLANNED_REQUIREMENT_TYPES.has(rtype);
}

function unknownRequirementResult(rtype: string, ctx: StoryRequirementContext): boolean {
    ctx.onUnknownRequirement?.(rtype);
    return ctx.unknownRequirementPasses === true;
}

/** 单条 requirement；未知/planned 在 strict 模式下返回 false */
export function evaluateSingleRequirement(
    raw: unknown,
    ctx: StoryRequirementContext,
): boolean {
    if (!raw || typeof raw !== 'object') return true;
    const req = raw as Record<string, unknown>;
    const rtype = reqType(req);

    if (rtype === 'event_done' || rtype === 'event_completed') {
        const eid = String(req.eventId ?? '');
        return !eid || ctx.isEventQuestStepComplete(eid);
    }
    if (rtype === 'task_completed' || rtype === 'task_done') {
        const tid = Number(req.taskId ?? 0);
        return ctx.completedTaskIds.has(tid);
    }
    if (rtype === 'task_active' || rtype === 'task_accepted') {
        const tid = Number(req.taskId ?? 0);
        if (ctx.completedTaskIds.has(tid)) return true;
        return ctx.activeTaskIds.has(tid) || ctx.acceptedTaskIds.has(tid);
    }
    if (rtype === 'task_not_started') {
        const tid = Number(req.taskId ?? 0);
        if (ctx.completedTaskIds.has(tid)) return false;
        return !ctx.activeTaskIds.has(tid) && !ctx.acceptedTaskIds.has(tid);
    }
    if (rtype === 'task_failed') {
        return false;
    }
    if (rtype === 'mainline_step') {
        const need = Number(req.value ?? 0);
        return ctx.mainlineStep >= need;
    }
    if (rtype === 'level') {
        const need = Number(req.value ?? req.min ?? 1);
        if (ctx.playerLevel <= 0) return false;
        return ctx.playerLevel >= need;
    }
    if (rtype === 'item_owned') {
        const iid = Number(req.itemId ?? 0);
        return ctx.ownedItemIds.has(iid);
    }
    if (isPlannedRequirementType(rtype)) {
        return unknownRequirementResult(rtype, ctx);
    }
    if (rtype) {
        return unknownRequirementResult(rtype, ctx);
    }
    return true;
}

export function evaluateRequirements(
    reqs: unknown[] | undefined,
    ctx: StoryRequirementContext,
): boolean {
    if (!reqs?.length) return true;
    for (const raw of reqs) {
        if (!evaluateSingleRequirement(raw, ctx)) return false;
    }
    return true;
}

/** appear.requirements 支持 ANY 模式 */
export function evaluateAppearRequirements(
    reqs: unknown[] | undefined,
    matchMode: 'ALL' | 'ANY' | undefined,
    ctx: StoryRequirementContext,
): boolean {
    if (!reqs?.length) return false;
    if (matchMode === 'ANY') {
        for (const req of reqs) {
            if (evaluateSingleRequirement(req, ctx)) return true;
        }
        return false;
    }
    return evaluateRequirements(reqs, ctx);
}
