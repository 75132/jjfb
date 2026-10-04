import { GameConfig } from './GameConfig';

export const enum Level {
    Debug,
    Info,
    Warn,
    Error,
}

/**
 * 客户端日志门控。
 * debug 只在 GameConfig.DEBUG_MODE 为 true 时输出；warn / error 始终输出。
 * ws 只看 LOG_WS_TRAFFIC，与 DEBUG_MODE 独立（入站流量日志原有开关）。
 */
export class Logger {
    static enabled = GameConfig.DEBUG_MODE;

    static debug(...a: any[]) {
        if (Logger.enabled) console.log('[D]', ...a);
    }

    static info(...a: any[]) {
        console.log('[I]', ...a);
    }

    static warn(...a: any[]) {
        console.warn('[W]', ...a);
    }

    static error(...a: any[]) {
        console.error('[E]', ...a);
    }

    static ws(...a: any[]) {
        if (GameConfig.LOG_WS_TRAFFIC) console.log('[D]', ...a);
    }
}
