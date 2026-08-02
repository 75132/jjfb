/**
 * 战斗恢复校验（纯逻辑，无 Cocos 依赖）
 */
import { roomIdOf, type BattleRoomStateLike } from './battle-resume-gate';

export type RestoreValidationResult =
    | { ok: true; roomId: string }
    | { ok: false; reason: string };

function hasActorData(actor: unknown): boolean {
    if (!actor || typeof actor !== 'object') return false;
    const a = actor as Record<string, unknown>;
    const hp = a.hp ?? a.max_hp ?? a.maxHp;
    return hp != null || a.raw != null || a.name != null;
}

/** 从房间 state 提取归属角色 ID */
export function characterIdOfState(state: BattleRoomStateLike): string | null {
    const top = state.character_id ?? state.characterId;
    if (top != null && String(top).length > 0) return String(top);
    const player = state.player as Record<string, unknown> | undefined;
    if (player) {
        const pcid = player.character_id ?? player.characterId;
        if (pcid != null && String(pcid).length > 0) return String(pcid);
    }
    return null;
}

/**
 * 校验服务端恢复 state 是否可安全应用。
 * 失败时不得副作用改写 BattleScene。
 */
export function validateBattleRestoreState(
    state: unknown,
    currentCharacterId: string | null | undefined,
): RestoreValidationResult {
    if (!state || typeof state !== 'object') {
        return { ok: false, reason: 'state_not_object' };
    }
    const s = state as BattleRoomStateLike;
    const roomId = roomIdOf(s);
    if (!roomId) {
        return { ok: false, reason: 'missing_room_id' };
    }
    if (s.status !== 'in_progress') {
        return { ok: false, reason: `status_not_in_progress:${String(s.status)}` };
    }
    if (!hasActorData(s.player)) {
        return { ok: false, reason: 'incomplete_player' };
    }
    if (!hasActorData(s.enemy)) {
        return { ok: false, reason: 'incomplete_enemy' };
    }
    const stateCid = characterIdOfState(s);
    if (currentCharacterId && stateCid && String(currentCharacterId) !== stateCid) {
        return { ok: false, reason: 'character_mismatch' };
    }
    if (currentCharacterId && !stateCid) {
        // 缺少归属字段时仍允许（兼容旧包），由 Controller 层 character 门控兜底
    }
    return { ok: true, roomId };
}
