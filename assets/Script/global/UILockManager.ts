/**
 * 全局 UI / 请求互斥锁：超时自动释放，防止连点卡住。
 */
export class UILockManager {
    private static _instance: UILockManager | null = null;
    static get instance(): UILockManager {
        if (!this._instance) this._instance = new UILockManager();
        return this._instance;
    }

    private _timers = new Map<string, ReturnType<typeof setTimeout>>();

    tryLock(key: string, ttlMs: number): boolean {
        if (this._timers.has(key)) return false;
        const t = setTimeout(() => this.unlock(key), ttlMs);
        this._timers.set(key, t);
        return true;
    }

    unlock(key: string): void {
        const t = this._timers.get(key);
        if (t) clearTimeout(t);
        this._timers.delete(key);
    }

    forceUnlockAll(): void {
        for (const t of this._timers.values()) clearTimeout(t);
        this._timers.clear();
    }
}
