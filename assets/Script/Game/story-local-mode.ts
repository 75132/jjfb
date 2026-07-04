/** 本地剧情模式：不依赖 story_get_state / story_interact / story_event_complete。
 * resetLocalStoryOnEnter（StoryManager 默认 true）：每次进场景清进度，方便测试。
 */

export type LocalStoryPersist = {
    completed_event_ids?: string[];
    battle_cleared_event_ids?: string[];
    accepted_task_ids?: number[];
    completed_task_ids?: number[];
    revealed_npc_uids?: string[];
    mainline_step?: number;
};

const STORAGE_PREFIX = 'jjfb_story_local_';

export function localStoryStorageKey(mapCode: string, characterId?: string | null): string {
    const cid = characterId?.trim();
    return `${STORAGE_PREFIX}${mapCode}${cid ? `_${cid}` : ''}`;
}

export function loadLocalStoryPersist(key: string): LocalStoryPersist | null {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as LocalStoryPersist;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

export function saveLocalStoryPersist(key: string, data: LocalStoryPersist): void {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch {
        /* ignore quota / private mode */
    }
}

export function clearLocalStoryPersist(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        /* ignore */
    }
}

/** 从 map JSON 的 server.effects 构造与 story_event_complete 同形的 applied_effects */
export function buildLocalCompletePayload(
    ev: { server?: { effects?: unknown[] } },
    choiceId?: string,
): Record<string, unknown> {
    const applied: Record<string, unknown>[] = [];
    for (const raw of ev.server?.effects ?? []) {
        if (!raw || typeof raw !== 'object') continue;
        const eff = raw as Record<string, unknown>;
        const effChoice = String(eff.choiceId ?? '').trim();
        if (effChoice && choiceId && effChoice !== choiceId) continue;
        applied.push({ ...eff });
    }
    return { applied_effects: applied };
}
