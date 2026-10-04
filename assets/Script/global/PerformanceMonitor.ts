import { Logger } from './Logger';
/**
 * 轻量耗时埋点。超过阈值才打一条 warn，避免刷屏。
 */

export class PerformanceMonitor {
    private static instance: PerformanceMonitor | null = null;
    private timers: Map<string, number> = new Map();
    private static readonly SLOW_MS = 200;

    public static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) { PerformanceMonitor.instance = new PerformanceMonitor(); }
        return PerformanceMonitor.instance;
    }

    public startTimer(name: string): void { this.timers.set(name, Date.now()); }

    public endTimer(name: string): number {
        const startTime = this.timers.get(name);
        if (!startTime) { return 0; }
        const duration = Date.now() - startTime;
        this.timers.delete(name);
        if (duration >= PerformanceMonitor.SLOW_MS) {
            Logger.warn(`[Perf] ${name} ${duration}ms`);
        }
        return duration;
    }

    public logSceneTransition(fromScene: string, toScene: string, duration: number): void {
        if (duration >= PerformanceMonitor.SLOW_MS) {
            Logger.warn(`[Perf] scene ${fromScene} -> ${toScene} ${duration}ms`);
        }
    }

    public logMemoryUsage(_context: string): void {}
}
