import { _decorator, Component, director } from 'cc';
const { ccclass } = _decorator;

@ccclass('SceneLoadMonitor')
export class SceneLoadMonitor extends Component {
    private static instance: SceneLoadMonitor | null = null;
    private sceneLoadStartTime: number = 0;
    private componentInitTimes: Map<string, number> = new Map();
    private initCheckTimer: ReturnType<typeof setTimeout> | null = null;
    public static getInstance(): SceneLoadMonitor { if (!SceneLoadMonitor.instance) { SceneLoadMonitor.instance = new SceneLoadMonitor(); } return SceneLoadMonitor.instance; }
    onLoad() { SceneLoadMonitor.instance = this; this.sceneLoadStartTime = Date.now(); }
    start() { const loadTime = Date.now() - this.sceneLoadStartTime; this.monitorComponentInitialization(); }
    private monitorComponentInitialization(): void {
        this.initCheckTimer = setTimeout(() => {
            this.initCheckTimer = null;
            if (!this.node?.isValid) return;
            this.checkComponentInitialization();
        }, 500);
    }
    onDestroy() {
        if (this.initCheckTimer !== null) {
            clearTimeout(this.initCheckTimer);
            this.initCheckTimer = null;
        }
    }
    private checkComponentInitialization(): void { const componentChecks = ['GameControl','GameMenu','RobotAttributePanel','MechAttributeTEST']; componentChecks.forEach(componentName => { const found = this.findComponentInScene(componentName); }); }
    private findComponentInScene(componentName: string): boolean { const scene = director.getScene(); return this.searchNodeRecursively(scene, componentName); }
    private searchNodeRecursively(node: any, componentName: string): boolean { const component = node.getComponent(componentName); if (component) { return true; } for (let i = 0; i < node.children.length; i++) { if (this.searchNodeRecursively(node.children[i], componentName)) { return true; } } return false; }
    public recordComponentInit(componentName: string, startTime: number): void { const duration = Date.now() - startTime; this.componentInitTimes.set(componentName, duration); }
    public getPerformanceReport(): void { }
}
