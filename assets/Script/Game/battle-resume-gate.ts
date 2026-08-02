/**
 * 战斗自动恢复门控（纯逻辑，无 Cocos 依赖）
 * BattleResumeController 使用本模块防止并发 resume 与旧响应覆盖。
 */

export type BattleRoomStateLike = {
    room_id?: string;
    roomId?: string;
    status?: string;
    character_id?: string;
    characterId?: string;
    player?: unknown;
    enemy?: unknown;
    [key: string]: unknown;
};

export type BattleResumeGate = {
    generation: number;
    inFlight: boolean;
    lastAppliedRoomId: string | null;
    currentCharacterId: string | null;
    requestCharacterId: string | null;
    requestGeneration: number | null;
};

export type PendingResumeCache = {
    state: BattleRoomStateLike | null;
    characterId: string | null;
    generation: number | null;
};

export const RESUME_DEBOUNCE_MS = 600;

export function createBattleResumeGate(): BattleResumeGate {
    return {
        generation: 0,
        inFlight: false,
        lastAppliedRoomId: null,
        currentCharacterId: null,
        requestCharacterId: null,
        requestGeneration: null,
    };
}

export function createPendingResumeCache(): PendingResumeCache {
    return { state: null, characterId: null, generation: null };
}

/** 发起新一轮 resume：提升 generation，标记 inFlight，记录请求角色 */
export function beginResume(gate: BattleResumeGate, characterId: string): number {
    gate.generation += 1;
    gate.inFlight = true;
    gate.requestCharacterId = characterId;
    gate.requestGeneration = gate.generation;
    gate.currentCharacterId = characterId;
    return gate.generation;
}

export function endResume(gate: BattleResumeGate, generation: number): void {
    if (gate.generation === generation) {
        gate.inFlight = false;
        gate.requestCharacterId = null;
        gate.requestGeneration = null;
    }
}

/** 强制解除 inFlight（超时 / 断线 / 销毁），不抬升 generation */
export function forceClearInFlight(gate: BattleResumeGate): void {
    gate.inFlight = false;
    gate.requestCharacterId = null;
    gate.requestGeneration = null;
}

/** 旧 generation 的返回应丢弃 */
export function isStaleResume(gate: BattleResumeGate, generation: number): boolean {
    return generation !== gate.generation;
}

/**
 * 响应可用性：generation、角色、会话均须匹配。
 */
export function isResumeResponseAcceptable(
    gate: BattleResumeGate,
    opts: {
        requestGeneration: number;
        requestCharacterId: string;
        currentCharacterId: string | null | undefined;
        authenticated: boolean;
        connected: boolean;
    },
): { ok: true } | { ok: false; reason: string } {
    if (!opts.connected) return { ok: false, reason: 'disconnected' };
    if (!opts.authenticated) return { ok: false, reason: 'unauthenticated' };
    if (isStaleResume(gate, opts.requestGeneration)) {
        return { ok: false, reason: 'stale_generation' };
    }
    if (!opts.currentCharacterId || opts.currentCharacterId !== opts.requestCharacterId) {
        return { ok: false, reason: 'character_changed' };
    }
    if (gate.requestCharacterId && gate.requestCharacterId !== opts.requestCharacterId) {
        return { ok: false, reason: 'request_character_mismatch' };
    }
    return { ok: true };
}

export function shouldOpenBattlePanel(resp: {
    success?: boolean;
    data?: {
        has_room?: boolean;
        state?: BattleRoomStateLike | null;
    } | null;
}): boolean {
    const state = resp?.data?.state;
    return !!(
        resp?.success === true &&
        resp?.data?.has_room === true &&
        state &&
        state.status === 'in_progress'
    );
}

export function roomIdOf(state: BattleRoomStateLike | null | undefined): string | null {
    if (!state) return null;
    const id = state.room_id ?? state.roomId;
    return id != null && String(id).length > 0 ? String(id) : null;
}

/**
 * 同一 room_id 已恢复过则不应再 apply / 播放入场动画。
 * 返回 true 表示应跳过应用。
 */
export function shouldSkipDuplicateRestore(
    gate: BattleResumeGate,
    state: BattleRoomStateLike,
): boolean {
    const rid = roomIdOf(state);
    if (!rid) return false;
    return gate.lastAppliedRoomId === rid;
}

export function markRoomApplied(gate: BattleResumeGate, state: BattleRoomStateLike): void {
    const rid = roomIdOf(state);
    if (rid) gate.lastAppliedRoomId = rid;
}

export function clearAppliedRoom(gate: BattleResumeGate): void {
    gate.lastAppliedRoomId = null;
}

/** 角色切换：彻底失效旧请求与缓存 */
export function invalidateForCharacterChange(
    gate: BattleResumeGate,
    pending: PendingResumeCache,
    characterId?: string | null,
): void {
    gate.generation += 1;
    gate.inFlight = false;
    gate.lastAppliedRoomId = null;
    gate.requestCharacterId = null;
    gate.requestGeneration = null;
    gate.currentCharacterId = characterId != null && String(characterId).length > 0
        ? String(characterId)
        : null;
    pending.state = null;
    pending.characterId = null;
    pending.generation = null;
}

export function cachePendingResume(
    pending: PendingResumeCache,
    state: BattleRoomStateLike,
    characterId: string,
    generation: number,
): void {
    pending.state = state;
    pending.characterId = characterId;
    pending.generation = generation;
}

export function clearPendingResume(pending: PendingResumeCache): void {
    pending.state = null;
    pending.characterId = null;
    pending.generation = null;
}

/** 注册 BattleScene 时：缓存是否仍可应用 */
export function isPendingResumeStillValid(
    gate: BattleResumeGate,
    pending: PendingResumeCache,
    currentCharacterId: string | null | undefined,
): { ok: true; state: BattleRoomStateLike } | { ok: false; reason: string } {
    if (!pending.state) return { ok: false, reason: 'no_pending' };
    if (pending.generation == null || pending.generation !== gate.generation) {
        return { ok: false, reason: 'stale_generation' };
    }
    if (!currentCharacterId || pending.characterId !== currentCharacterId) {
        return { ok: false, reason: 'character_mismatch' };
    }
    return { ok: true, state: pending.state };
}

/** 识别 create 因已有活动房间而冲突 */
export function isActiveRoomConflict(resp: {
    success?: boolean;
    code?: number;
    error_code?: string;
    message?: string;
} | null | undefined): boolean {
    if (!resp || resp.success) return false;
    if (resp.error_code === 'ACTIVE_BATTLE_ROOM') return true;
    if (resp.code === 409) return true;
    const msg = String(resp.message || '');
    return /已有.*战斗房间|活动房间|active.?battle.?room/i.test(msg);
}

/** debounce 调度状态（纯逻辑） */
export type DebounceSchedule = {
    timerId: ReturnType<typeof setTimeout> | null;
    reasons: string[];
};

export function createDebounceSchedule(): DebounceSchedule {
    return { timerId: null, reasons: [] };
}

/**
 * 合并触发：新触发覆盖尚未执行的旧调度，同一轮只执行一次。
 * 返回是否安排了新 timer（由调用方用 schedule.timerId 取消）。
 */
export function scheduleDebounced(
    schedule: DebounceSchedule,
    reason: string,
    delayMs: number,
    run: (mergedReasons: string[]) => void,
): void {
    schedule.reasons.push(reason);
    if (schedule.timerId != null) {
        clearTimeout(schedule.timerId);
        schedule.timerId = null;
    }
    schedule.timerId = setTimeout(() => {
        const merged = schedule.reasons.slice();
        schedule.reasons = [];
        schedule.timerId = null;
        run(merged);
    }, delayMs);
}

export function cancelDebounced(schedule: DebounceSchedule): void {
    if (schedule.timerId != null) {
        clearTimeout(schedule.timerId);
        schedule.timerId = null;
    }
    schedule.reasons = [];
}

/**
 * Controller 应用路径决策（成功才 mark）。
 * restoreFn 返回 true 表示 BattleScene 已成功应用。
 */
export function applyResumeAfterRestore(
    gate: BattleResumeGate,
    state: BattleRoomStateLike,
    restoreFn: (state: BattleRoomStateLike) => boolean,
): { marked: boolean; restored: boolean; reason?: string } {
    if (shouldSkipDuplicateRestore(gate, state)) {
        return { marked: false, restored: false, reason: 'duplicate_room' };
    }
    const restored = restoreFn(state);
    if (!restored) {
        return { marked: false, restored: false, reason: 'restore_failed' };
    }
    markRoomApplied(gate, state);
    return { marked: true, restored: true };
}
