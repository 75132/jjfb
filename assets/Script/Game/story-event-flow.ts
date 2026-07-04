/**
 * 剧情事件流纯逻辑（可单测，不依赖 Cocos 运行时）。
 * 对标 RMV：一次确认 → 授权 → 展示 → 完成 → 续链。
 */

export type StoryChoiceOption = {
    id: string;
    text: string;
    npcReply?: string;
    systemTip?: string;
    forcedResult?: 'start_battle' | 'block' | 'teleport' | 'none';
    completesEvent?: boolean;
};

export type StoryEventServerSlice = {
    allowedChoiceIds?: string[];
    battleRef?: string;
};

export type StoryMapEventSlice = {
    eventType?: string;
    client?: { choiceScriptId?: string };
    server?: StoryEventServerSlice;
};

export type StoryInteractPayload = {
    action?: string;
    battle_ref?: string;
    choice_script_id?: string;
    dialogue_script_id?: string;
};

export type StoryWsResponse = {
    success?: boolean;
    message?: string;
    data?: Record<string, unknown>;
};

export type StoryFlowStep =
    | 'authenticate'
    | 'present'
    | 'awaitUser'
    | 'complete'
    | 'chainNext';

/** defer / allowedChoiceIds 判定：是否应调用 story_event_complete */
export function shouldCompleteChoice(
    opt: StoryChoiceOption,
    ev?: StoryMapEventSlice,
): boolean {
    if (opt.completesEvent === false) return false;
    if (opt.forcedResult === 'block' || opt.forcedResult === 'none') return false;
    const allowed = ev?.server?.allowedChoiceIds;
    if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(opt.id)) {
        return false;
    }
    return true;
}

/** 战前选项是否应进入战斗 */
export function shouldStartBattleFromChoice(
    opt: StoryChoiceOption,
    ev?: StoryMapEventSlice,
): boolean {
    if (!shouldCompleteChoice(opt, ev)) return false;
    if (opt.forcedResult === 'block' || opt.forcedResult === 'none') return false;
    if (opt.forcedResult === 'start_battle') return true;
    if (ev?.eventType === 'battle' && ev.client?.choiceScriptId) return false;
    return false;
}

export function isBattleInteractAction(
    payload: StoryInteractPayload | undefined,
    ev: StoryMapEventSlice,
): boolean {
    const action = payload?.action || ev.eventType;
    return action === 'battle' || action === 'choice_then_battle' || ev.eventType === 'battle';
}

export function isChoiceBlockedMessage(message: string | undefined): boolean {
    return message === 'choice_blocked';
}

/** 将 WebSocketManager.request 回调包装为 Promise */
export function promisifyWsRequest<T extends StoryWsResponse>(
    request: (
        route: string,
        payload: Record<string, unknown>,
        callback: (resp: T) => void,
        useRequestId?: boolean,
        timeoutMs?: number,
    ) => void,
    route: string,
    payload: Record<string, unknown>,
    timeoutMs = 8000,
): Promise<T> {
    return new Promise((resolve, reject) => {
        request(
            route,
            payload,
            (resp) => {
                if (!resp?.success) {
                    reject(new Error(resp?.message || `${route} failed`));
                    return;
                }
                resolve(resp);
            },
            true,
            timeoutMs,
        );
    });
}
