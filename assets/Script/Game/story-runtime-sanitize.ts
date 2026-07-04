/**
 * 运行时 JSON 清洗：battle 环不得带「胜利/失败」伪选项，战斗结果由对战验证。
 * Juben 导出管线与 Cocos StoryManager 加载时共用。
 */

export type RuntimeChoiceOptionLike = {
    id?: string;
    text?: string;
    completesEvent?: boolean;
    forcedResult?: string;
};

export type RuntimeChoiceScriptLike = {
    title?: string;
    options?: RuntimeChoiceOptionLike[];
};

export type RuntimeMapEventLike = {
    eventType?: string;
    eventId?: string | number;
    client?: { choiceScriptId?: string; [k: string]: unknown };
    server?: { allowedChoiceIds?: string[]; [k: string]: unknown };
};

export type RuntimeMapNpcLike = {
    npcUid?: string;
    events?: RuntimeMapEventLike[];
};

export type RuntimeMapLike = {
    client?: { choiceScripts?: Record<string, RuntimeChoiceScriptLike> };
    npcs?: RuntimeMapNpcLike[];
};

const PSEUDO_WIN_TEXT = /^(胜利|成功)$/;
const PSEUDO_LOSE_TEXT = /^失败$/;

export function isPseudoBattleResultScript(script: RuntimeChoiceScriptLike | undefined): boolean {
    const opts = script?.options ?? [];
    if (opts.length === 0) return false;
    const hasPseudoWin = opts.some((o) => PSEUDO_WIN_TEXT.test(String(o.text ?? '').trim()));
    const hasPseudoLose = opts.some((o) => PSEUDO_LOSE_TEXT.test(String(o.text ?? '').trim()));
    return hasPseudoWin && hasPseudoLose;
}

export type SanitizeBattlePseudoResult = {
    battleEventsFixed: number;
    scriptsRemoved: number;
};

/** 移除 battle 事件上的「胜利/失败」伪选项，保留独立战前 choice 环 */
export function sanitizeBattlePseudoChoicesInRuntime(map: RuntimeMapLike): SanitizeBattlePseudoResult {
    const scripts = map.client?.choiceScripts ?? {};
    const removedScriptIds = new Set<string>();
    let battleEventsFixed = 0;

    for (const npc of map.npcs ?? []) {
        for (const ev of npc.events ?? []) {
            if (ev.eventType !== 'battle') continue;
            const sid = ev.client?.choiceScriptId;
            if (!sid) continue;
            const script = scripts[sid];
            if (!isPseudoBattleResultScript(script)) continue;

            if (ev.client) {
                delete ev.client.choiceScriptId;
            }
            if (ev.server?.allowedChoiceIds) {
                delete ev.server.allowedChoiceIds;
            }
            removedScriptIds.add(sid);
            battleEventsFixed += 1;
        }
    }

    for (const sid of removedScriptIds) {
        delete scripts[sid];
    }

    return { battleEventsFixed, scriptsRemoved: removedScriptIds.size };
}
