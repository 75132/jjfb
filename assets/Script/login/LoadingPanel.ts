import { _decorator, Component, Node, Label, instantiate, Color, Sprite, SpriteFrame } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import { Logger } from '../global/Logger';

const { ccclass, property } = _decorator;

/** 登录页启动检测阶段（与服务端 client_boot_check.stage 对齐） */
export type BootStageId = 'check_update' | 'download_resources' | 'get_character' | 'loading';

interface BootStageDef {
    id: BootStageId;
    tip: string;
}

const BOOT_STAGES: BootStageDef[] = [
    { id: 'check_update', tip: '检查更新列表' },
    { id: 'download_resources', tip: '正在下载资源文件，请耐心等待' },
    { id: 'get_character', tip: '正在获取角色资料' },
    { id: 'loading', tip: '载入中，请稍等' },
];

const TIP_CONNECTING = '正在连接服务器';
const TIP_CONNECT_FAILED = '连接服务器失败，请退出重试';
const FAIL_TIP_COLOR = new Color(255, 64, 64, 255);

/**
 * Login 场景 Loading 面板。
 * Tip 与进度条绑定：每个业务阶段显示对应 Tip，进度条从 0 跑满后才进入下一阶段。
 */
@ccclass('LoadingPanel')
export class LoadingPanel extends Component {
    @property({ type: Node, tooltip: 'LoadingUI/Progress 模板节点（默认隐藏，开启后复制）' })
    progressTemplate: Node | null = null;

    @property({ type: Label, tooltip: 'LoadingUI/Tip 提示文案' })
    tipLabel: Label | null = null;

    @property({ type: Sprite, tooltip: '轮播图 Sprite（LoadingPanel/Show）' })
    showSprite: Sprite | null = null;

    @property({ type: [SpriteFrame], tooltip: '轮播图帧（show1/show2/show3）' })
    showFrames: SpriteFrame[] = [];

    @property({ tooltip: '轮播切换间隔（秒）' })
    showRotateSeconds: number = 3;

    @property({ tooltip: '进度块水平间隔' })
    progressSpacing: number = 15;

    @property({ tooltip: '进度块最大数量' })
    maxProgressBlocks: number = 12;

    @property({ tooltip: '进度块步进间隔（秒）；跑满一格阶段 ≈ 步进 × 块数' })
    progressStepSeconds: number = 0.12;

    @property({ tooltip: '连接服务器最长等待（秒），超时显示失败并停连' })
    connectTimeoutSeconds: number = 30;

    @property({ tooltip: '已连上后，单阶段请求失败是否仍用本地延时继续' })
    allowLocalFallback: boolean = true;

    @property({ tooltip: '单阶段请求超时（毫秒）' })
    stageRequestTimeoutMs: number = 2500;

    private _clones: Node[] = [];
    private _visibleCount: number = 0;
    private _running: boolean = false;
    private _connectFailed: boolean = false;
    private _baseX: number = 0;
    private _baseY: number = 0;
    private _baseZ: number = 0;
    private _onComplete: (() => void) | null = null;
    private _progressStepCb: (() => void) | null = null;
    private _progressResolve: (() => void) | null = null;
    private _tipNormalColor: Color = new Color(255, 255, 255, 255);
    private _showIndex: number = 0;
    private _showRotateCb: (() => void) | null = null;
    /** 连接等待倒计时（每秒回调，与重连解耦） */
    private _connectCountdownCb: (() => void) | null = null;
    private _connectCountdownSec: number = 0;

    onLoad() {
        this.node.active = true;
        if (this.progressTemplate) {
            const pos = this.progressTemplate.position;
            this._baseX = pos.x;
            this._baseY = pos.y;
            this._baseZ = pos.z;
            this.progressTemplate.active = false;
        }
        if (this.tipLabel) {
            this._tipNormalColor = this.tipLabel.color.clone();
            this.tipLabel.string = '';
        }
        this._applyShowFrame(0);
        this._startShowRotate();
    }

    /**
     * 开启加载 UI：先尝试连服；30s 内连上则跑业务阶段；超时则停掉本地自动重连并显示失败文案。
     */
    public startBootFlow(onComplete?: () => void): void {
        if (this._running) return;
        this._running = true;
        this._connectFailed = false;
        this._onComplete = onComplete ?? null;
        this.node.active = true;
        this._setTip(TIP_CONNECTING, false);
        this._ensureProgressClones();
        this._setVisibleBlocks(0);
        this._startShowRotate();
        // 每次进入 Loading 允许重新尝试连接（上一轮失败可能已 suspend）
        try { WebSocketManager.getInstance().allowConnectAttempts(); } catch {}
        void this._runStages();
    }

    public hideAndReset(): void {
        this._stopConnectCountdown();
        this._stopShowRotate();
        this._stopProgressFill();
        this._setVisibleBlocks(0);
        this._setTip('', false);
        this.node.active = false;
        this._running = false;
        this._connectFailed = false;
        this._onComplete = null;
    }

    public isRunning(): boolean {
        return this._running;
    }

    public isConnectFailed(): boolean {
        return this._connectFailed;
    }

    private _startShowRotate(): void {
        this._stopShowRotate();
        const frames = this._validShowFrames();
        if (!this.showSprite || frames.length <= 1) return;
        const interval = Math.max(0.5, this.showRotateSeconds);
        this._showRotateCb = () => {
            if (!this.isValid || !this.node.active) return;
            this._showIndex = (this._showIndex + 1) % frames.length;
            this._applyShowFrame(this._showIndex);
        };
        this.schedule(this._showRotateCb, interval);
    }

    private _stopShowRotate(): void {
        if (this._showRotateCb) {
            this.unschedule(this._showRotateCb);
            this._showRotateCb = null;
        }
    }

    private _validShowFrames(): SpriteFrame[] {
        return (this.showFrames || []).filter((f) => !!f);
    }

    private _applyShowFrame(index: number): void {
        if (!this.showSprite) return;
        const frames = this._validShowFrames();
        if (frames.length <= 0) return;
        const i = ((index % frames.length) + frames.length) % frames.length;
        this._showIndex = i;
        this.showSprite.spriteFrame = frames[i];
    }

    private _ensureProgressClones(): void {
        if (!this.progressTemplate) return;
        const parent = this.progressTemplate.parent;
        if (!parent) return;

        for (const n of this._clones) {
            if (n && n.isValid) n.destroy();
        }
        this._clones.length = 0;

        const count = Math.max(1, Math.floor(this.maxProgressBlocks));
        for (let i = 0; i < count; i++) {
            const node = instantiate(this.progressTemplate);
            node.name = `Progress_${i + 1}`;
            node.parent = parent;
            node.setPosition(this._baseX + i * this.progressSpacing, this._baseY, this._baseZ);
            node.active = false;
            this._clones.push(node);
        }
        this.progressTemplate.active = false;
        this._visibleCount = 0;
    }

    private _setVisibleBlocks(count: number): void {
        this._visibleCount = Math.max(0, Math.min(count, this._clones.length));
        for (let i = 0; i < this._clones.length; i++) {
            const n = this._clones[i];
            if (n && n.isValid) n.active = i < this._visibleCount;
        }
    }

    private _stopProgressFill(): void {
        if (this._progressStepCb) {
            this.unschedule(this._progressStepCb);
            this._progressStepCb = null;
        }
        if (this._progressResolve) {
            const resolve = this._progressResolve;
            this._progressResolve = null;
            resolve();
        }
    }

    /**
     * 进度条从 0 跑满一次（与 Tip/业务同阶段绑定，不独立循环切文案）。
     */
    private _fillProgressOnce(): Promise<void> {
        this._stopProgressFill();
        this._setVisibleBlocks(0);
        const total = this._clones.length;
        if (total <= 0) {
            return Promise.resolve();
        }
        const stepSec = Math.max(0.05, this.progressStepSeconds);
        return new Promise((resolve) => {
            this._progressResolve = resolve;
            this._progressStepCb = () => {
                if (!this.isValid || !this._running) {
                    this._stopProgressFill();
                    return;
                }
                const next = this._visibleCount + 1;
                this._setVisibleBlocks(next);
                if (next >= total) {
                    this._stopProgressFill();
                }
            };
            this.schedule(this._progressStepCb, stepSec);
        });
    }

    private async _runStages(): Promise<void> {
        const ws = WebSocketManager.getInstance();
        this._setTip(TIP_CONNECTING, false);
        // 连接中：进度条可反复跑满，Tip 固定「正在连接服务器」，连上后再进业务阶段
        const connected = await this._waitUntilConnected(ws, this.connectTimeoutSeconds);
        if (!this.isValid) return;
        // 等待过程中若已失败/取消，_running 可能已 false
        if (!this._running && !connected) return;

        if (!connected) {
            this._failConnect(ws);
            return;
        }

        for (const stage of BOOT_STAGES) {
            if (!this.isValid || !this._running) return;
            // Tip 与本阶段进度条绑定：先换文案，再从 0 跑满；业务请求与进度并行
            this._setTip(stage.tip, false);
            const work = this._requestStage(ws, stage.id);
            const bar = this._fillProgressOnce();
            await Promise.all([work, bar]);
        }
        if (!this.isValid) return;
        this._finish();
    }

    /**
     * 连接等待（断网测试友好）：
     * - Tip 每秒刷新「正在连接服务器（Ns）」
     * - 期间尝试 connect（WS 自身有限次重连即可）
     * - 满 30s 仍连不上 → false，上层 abort + 显示失败文案，本地不再自动连
     */
    private _waitUntilConnected(ws: WebSocketManager, maxSeconds: number): Promise<boolean> {
        return new Promise((resolve) => {
            if (ws && ws.isConnected()) {
                resolve(true);
                return;
            }

            const limit = Math.max(1, Math.floor(maxSeconds));
            let settled = false;
            let pumpActive = true;

            const finish = (ok: boolean) => {
                if (settled) return;
                settled = true;
                pumpActive = false;
                this._stopConnectCountdown();
                this._stopProgressFill();
                resolve(ok);
            };

            this._connectCountdownSec = 0;
            this._setTip(`${TIP_CONNECTING}（0s）`, false);
            this._stopConnectCountdown();
            this._connectCountdownCb = () => {
                if (settled) return;
                if (!this.isValid || !this._running) {
                    finish(false);
                    return;
                }
                if (ws && ws.isConnected()) {
                    finish(true);
                    return;
                }
                this._connectCountdownSec += 1;
                this._setTip(`${TIP_CONNECTING}（${this._connectCountdownSec}s）`, false);
                if (this._connectCountdownSec >= limit) {
                    finish(false);
                }
            };
            this.schedule(this._connectCountdownCb, 1.0);

            const pumpBar = async () => {
                while (pumpActive && this.isValid && this._running && !settled) {
                    if (ws && ws.isConnected()) break;
                    await this._fillProgressOnce();
                }
            };

            try { ws.connect(); } catch {}
            void pumpBar();
        });
    }

    private _stopConnectCountdown(): void {
        if (this._connectCountdownCb) {
            this.unschedule(this._connectCountdownCb);
            this._connectCountdownCb = null;
        }
    }

    private _failConnect(ws: WebSocketManager): void {
        this._connectFailed = true;
        this._running = false;
        this._onComplete = null;
        this._stopConnectCountdown();
        this._stopProgressFill();
        this._setVisibleBlocks(0);
        // 先停掉本地一切自动连接，再显示失败文案
        try {
            ws.abortConnectAttempts();
        } catch (e) {
            Logger.warn('[LoadingPanel] 取消连接失败', e);
        }
        this._setTip(TIP_CONNECT_FAILED, true);
        this._startShowRotate();
        Logger.warn('[LoadingPanel] 30s 未连上，已停止本地自动连接');
    }

    private _setTip(text: string, asError: boolean): void {
        if (!this.tipLabel) return;
        this.tipLabel.string = text;
        this.tipLabel.color = asError ? FAIL_TIP_COLOR : this._tipNormalColor;
    }

    private _requestStage(ws: WebSocketManager, stage: BootStageId): Promise<void> {
        return new Promise((resolve) => {
            const done = () => resolve();

            if (!ws || !ws.isConnected()) {
                if (this.allowLocalFallback) {
                    Logger.debug(`[LoadingPanel] 本地阶段 ${stage}（未连接服务器）`);
                }
                done();
                return;
            }

            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                done();
            };

            try {
                ws.request(
                    GameConfig.MESSAGE_TYPES.CLIENT_BOOT_CHECK,
                    { stage },
                    (response: any) => {
                        if (response && response.success === false && response.code === 408) {
                            Logger.warn(`[LoadingPanel] 阶段 ${stage} 超时，继续本地流程`);
                        } else if (response && response.success === false) {
                            Logger.warn(`[LoadingPanel] 阶段 ${stage} 失败:`, response.message || response);
                        } else {
                            Logger.debug(`[LoadingPanel] 阶段 ${stage} 完成`, response?.data || response);
                        }
                        finish();
                    },
                    false,
                    this.stageRequestTimeoutMs
                );
            } catch (e) {
                Logger.warn(`[LoadingPanel] 阶段 ${stage} 请求异常，本地继续`, e);
                finish();
            }
        });
    }

    private _finish(): void {
        this._stopConnectCountdown();
        this._stopShowRotate();
        this._stopProgressFill();
        this._setVisibleBlocks(this._clones.length);
        this._running = false;
        const cb = this._onComplete;
        this._onComplete = null;
        this.node.active = false;
        if (cb) cb();
    }

    onDestroy() {
        this._stopConnectCountdown();
        this._stopShowRotate();
        this._stopProgressFill();
        for (const n of this._clones) {
            if (n && n.isValid) n.destroy();
        }
        this._clones.length = 0;
    }
}
