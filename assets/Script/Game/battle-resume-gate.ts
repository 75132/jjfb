/**
 * 战斗自动恢复门控（纯逻辑，无 Cocos 依赖）
 * BattleResumeController 使用本模块防止并发 resume 与旧响应覆盖。
 */

export type BattleRoomStateLike = {
    room_id?: string;
    roomId?: string;
    status?: string;
    [key: string]: unknown;
};

export type BattleResumeGate = {
    generation: number;
    inFlight: boolean;
    lastAppliedRoomId: string | null;
};

export function createBattleResumeGate(): BattleResumeGate {
    return {
        generation: 0,
        inFlight: false,
        lastAppliedRoomId: null,
    };
}

/** 发起新一轮 resume：提升 generation，标记 inFlight */
export function beginResume(gate: BattleResumeGate): number {
    gate.generation += 1;
    gate.inFlight = true;
    return gate.generation;
}

export function endResume(gate: BattleResumeGate, generation: number): void {
    if (gate.generation === generation) {
        gate.inFlight = false;
    }
}

/** 旧 generation 的返回应丢弃 */
export function isStaleResume(gate: BattleResumeGate, generation: number): boolean {
    return generation !== gate.generation;
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
