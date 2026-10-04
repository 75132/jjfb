/**
 * 新角色开屏世界观标记（本地）。
 * 创建角色成功时写入 pending；进 Game 播完/跳过后清除。
 */

const PENDING_PREFIX = 'jjfb_intro_pending_';

function safeGet(key: string): string | null {
    try {
        if (typeof localStorage === 'undefined') return null;
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSet(key: string, value: string): void {
    try {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(key, value);
    } catch {
        /* ignore */
    }
}

function safeRemove(key: string): void {
    try {
        if (typeof localStorage === 'undefined') return;
        localStorage.removeItem(key);
    } catch {
        /* ignore */
    }
}

function pendingKey(characterId: string): string {
    return `${PENDING_PREFIX}${characterId}`;
}

/** 创建角色成功后调用：标记该角色下次进 Game 需播开屏 */
export function markNewCharacterNeedsIntro(characterId: string): void {
    const id = String(characterId || '').trim();
    if (!id) return;
    safeSet(pendingKey(id), '1');
}

/** 当前角色是否需要播开屏（仅新创建且尚未播完） */
export function shouldPlayIntro(characterId: string): boolean {
    const id = String(characterId || '').trim();
    if (!id) return false;
    return safeGet(pendingKey(id)) === '1';
}

/** 开屏播完或跳过后清除 pending */
export function clearIntroPending(characterId: string): void {
    const id = String(characterId || '').trim();
    if (!id) return;
    safeRemove(pendingKey(id));
}
