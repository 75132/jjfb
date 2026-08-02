/**
 * 战斗进入意图（纯逻辑）
 * onEnable 不得自行猜测来源，必须依赖显式 intent。
 */

export type BattleEntryIntent = 'new-pve' | 'story' | 'resume' | 'pvp';

export type OnEnableBattleAction =
    | 'create-pve'
    | 'story-wait'
    | 'resume-ready'
    | 'pvp-match'
    | 'reject';

export type StoryBattleCreateOpts = {
    eventId?: string | null;
    mapCode?: string | null;
    battleRef?: string | null;
    skipServerAuth?: boolean;
};

/** onEnable 根据唯一 entry intent 决定行为 */
export function resolveOnEnableAction(intent: BattleEntryIntent | null | undefined): OnEnableBattleAction {
    switch (intent) {
        case 'story':
            return 'story-wait';
        case 'resume':
            return 'resume-ready';
        case 'pvp':
            return 'pvp-match';
        case 'new-pve':
            return 'create-pve';
        default:
            // 未显式设置时按普通开战（兼容直接 active=true）
            return 'create-pve';
    }
}

/** 剧情开战前校验：缺少 event_id / map_code 时拒绝（非 skip 路径） */
export function validateStoryBattleCreate(opts: StoryBattleCreateOpts): { ok: true } | { ok: false; reason: string } {
    if (opts.skipServerAuth) {
        if (!opts.battleRef) {
            return { ok: false, reason: 'missing_battle_ref' };
        }
        return { ok: true };
    }
    if (!opts.eventId) {
        return { ok: false, reason: 'missing_event_id' };
    }
    if (!opts.mapCode) {
        return { ok: false, reason: 'missing_map_code' };
    }
    return { ok: true };
}

/** new-pve / resume / pvp 是否应先调用 resume（均不应） */
export function shouldPrefetchResumeBeforeCreate(intent: BattleEntryIntent): boolean {
    return false;
}

/** resume 意图是否允许发起 create */
export function resumeIntentAllowsCreate(intent: BattleEntryIntent): boolean {
    return intent !== 'resume';
}
