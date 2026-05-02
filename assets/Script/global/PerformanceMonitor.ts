/**
 * 性能监控工具
 * 用于监控场景跳转和加载性能
 */

export class PerformanceMonitor {
    private static instance: PerformanceMonitor | null = null;
    private timers: Map<string, number> = new Map();
    public static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) { PerformanceMonitor.instance = new PerformanceMonitor(); }
        return PerformanceMonitor.instance;
    }
    public startTimer(name: string): void { this.timers.set(name, Date.now()); }
    public endTimer(name: string): number {
        const startTime = this.timers.get(name);
        if (!startTime) { return 0; }
        const duration = Date.now() - startTime; this.timers.delete(name); return duration;
    }
    public logSceneTransition(fromScene: string, toScene: string, duration: number): void {}
    public logMemoryUsage(context: string): void {}
}
