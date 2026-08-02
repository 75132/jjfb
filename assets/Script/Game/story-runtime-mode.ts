/**
 * 剧情运行模式（纯逻辑，可单测）
 * - local-preview：Juben/制作预览，可跳过服务端剧情 API
 * - server-development：联调/正式运行，完整走服务端状态
 */
export type StoryRuntimeMode = 'local-preview' | 'server-development';

export const DEFAULT_STORY_RUNTIME_MODE: StoryRuntimeMode = 'server-development';

export function normalizeStoryRuntimeMode(raw: unknown): StoryRuntimeMode {
    if (raw === 'local-preview') return 'local-preview';
    return 'server-development';
}

export function isLocalPreviewMode(mode: unknown): boolean {
    return normalizeStoryRuntimeMode(mode) === 'local-preview';
}

/** local-preview 才允许跳过 get_state / interact / event_complete / 本地重置 */
export function allowsSkipServerStoryApis(mode: unknown): boolean {
    return isLocalPreviewMode(mode);
}

export type StoryBattleFinishedResult = {
    won: boolean;
    roomId: string;
    winner: 'player' | 'enemy';
    reason: string;
    errMsg?: string;
};

export function shouldPlayRewardAnimation(payload: {
    idempotent_replay?: boolean;
} | null | undefined): boolean {
    return payload?.idempotent_replay !== true;
}

export function shouldAutoFinalizeSettlement(state: {
    pending_story_settlement?: { required?: boolean; room_id?: string; event_id?: string } | null;
} | null | undefined): boolean {
    return !!(
        state?.pending_story_settlement?.required === true &&
        state.pending_story_settlement.room_id &&
        state.pending_story_settlement.event_id
    );
}
