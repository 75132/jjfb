/**
 * 背包领域事件（任务/成就等可订阅）。保持轻量，避免与具体 UI 耦合。
 */
export type BagEventPayload =
    | { kind: 'refreshed'; category: number; page: number; itemCount: number }
    | { kind: 'mutated'; mutation: string; success: boolean; raw?: any };

type Handler = (p: BagEventPayload) => void;

export class BagEventHub {
    private static _subs = new Map<string, Set<Handler>>();

    static on(evt: string, fn: Handler): void {
        let set = this._subs.get(evt);
        if (!set) {
            set = new Set();
            this._subs.set(evt, set);
        }
        set.add(fn);
    }

    static off(evt: string, fn: Handler): void {
        const set = this._subs.get(evt);
        if (!set) return;
        set.delete(fn);
        if (set.size === 0) this._subs.delete(evt);
    }

    static emit(evt: string, payload: BagEventPayload): void {
        const set = this._subs.get(evt);
        if (!set) return;
        for (const fn of set) {
            try {
                fn(payload);
            } catch (e) {
                console.warn('[BagEvent]', evt, e);
            }
        }
    }
}
