import { _decorator, Component, Node, Label, Button } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';

const { ccclass, property } = _decorator;

const REQUIRED_SECONDS = 3 * 60 * 60;
/** 与服务器校验大乐透状态；在线秒数建议 30s 上传一次，减少波动且符合防刷上限 45s */
const DALETOU_SYNC_INTERVAL_SEC = 30;

/** 今日开奖结果说明（完整文案） */
const RESULT_TIP: Record<number, string> = {
    1: '未获得参与资格\n您今日尚未获得参与资格，暂无法查看个人开奖详情。领取资格需满足：当日在线满 3 小时，每日仅可参与 1 次。',
    2: '已获得资格但未参与\n您今日已获得参与资格，但尚未参与抽奖，暂无法查看个人开奖结果。请在下次开奖前完成参与。',
    3: '已参与但未中奖\n您今日已参与抽奖，本次未中奖。感谢您的参与，明日 24:00 将开启新一轮抽奖。',
    4: '已参与且中奖\n恭喜您！今日成功中得头奖，1000 能量块已发放至您的账户。',
    5: '未到开奖时间\n今日开奖尚未开始，请在 24:00 后再次查看开奖结果。',
};

export interface DaletouSyncPayload {
    /** 大乐透自然日（Asia/Shanghai），如 YYYY-MM-DD */
    day?: string;
    /** 期号 YYYYMMDD（与服务器 issue 一致，优先用于展示） */
    issue?: string;
    energy_blocks?: number;
    role_name?: string;
    online_seconds?: number;
    seconds_until_eligible?: number;
    claimed?: boolean;
    result_tip_code?: number;
    server_time?: string;
    /** 今日头奖角色名（开奖后由服务器给出） */
    winner_display_name?: string;
    /** 服务端字段：自然日是否已过开奖展示时刻 */
    after_draw_time?: boolean;
    /** 服务端字段：是否已有开奖落库 */
    draw_finished?: boolean;
    /** 服务端字段：当前角色是否中头奖 */
    is_winner?: boolean;
}

@ccclass('MiniGame1')
export class MiniGame1 extends Component {
    @property({ type: Label, tooltip: '能量块' })
    energyLabel: Label | null = null;

    @property({ type: Label })
    onlineTimeLabel: Label | null = null;

    @property({ type: Label })
    timeUntilEligibleLabel: Label | null = null;

    @property({ type: Label })
    participateEligibleLabel: Label | null = null;

    @property({ type: Label })
    nowTimeLabel: Label | null = null;

    @property({ type: Node })
    errorPanel: Node | null = null;

    /** Error 弹窗内提示文案（未绑定时自动查找 Error 下名为 Label 的节点） */
    @property({ type: Label })
    errorTipLabel: Label | null = null;

    @property({ type: Node })
    todayLotteryResultPanel: Node | null = null;

    /** 领取成功提示（可与 Error 同结构；未放场景时回退用 Error 面板） */
    @property({ type: Node })
    claimSuccessPanel: Node | null = null;

    @property({ type: Label })
    claimSuccessTipLabel: Label | null = null;

    @property({ type: Label })
    resultPlayerNameLabel: Label | null = null;

    @property({ type: Label })
    resultTipLabel: Label | null = null;

    @property({ type: Node })
    backControlNode: Node | null = null;

    private ws: WebSocketManager = null!;
    private _lastPayload: DaletouSyncPayload | null = null;
    private _errorCloseTimer: number = -1;
    private _successCloseTimer: number = -1;
    private _claimWatchdogTimer: number = -1;
    private _mainClaimRequesting: boolean = false;

    /** 当前弹窗状态：确保同一时间只有一个面板处于 active，减少“混乱感”。 */
    private _popupState: 'none' | 'error' | 'success' | 'result' = 'none';

    /** NowTime：以服务端 server_time 为基准平滑推算（确保动态）。 */
    private _serverTimeBaseMs: number | null = null;
    private _serverTimeRecvAtMs: number = 0;

    /** 用于本地估算：上次成功 daletou_sync 的在线秒数基准 */
    private _lastSyncRecvAtMs: number = 0;
    private _lastSyncOnlineSecondsBase: number = 0;
    private _lastSyncDayKey: string = '';
    private _autoSyncedForEligibility: boolean = false;

    /** 主界面「参与」按钮上的文案节点（ClaimParticipateQual 下 Label） */
    private mainClaimButtonLabel: Label | null = null;
    /** 主界面期号 */
    private mainIssueNumLabel: Label | null = null;
    /** 开奖结果弹窗期号 */
    private resultIssueNumLabel: Label | null = null;

    private _mainClaimBtnNode: Node | null = null;
    private _viewResultBtnNode: Node | null = null;
    private _innerClaimBtnNode: Node | null = null;
    private _backCtrlBtnNode: Node | null = null;

    /**
     * 从场景根挂载到名为 MiniGame1 的节点（场景未手动绑脚本时使用）
     */
    public static mountFromSceneRoot(root: Node): void {
        const scene = root.scene;
        if (!scene) return;
        const stack: Node[] = [...scene.children];
        while (stack.length) {
            const n = stack.pop()!;
            if (n.name === 'MiniGame1') {
                if (!n.getComponent(MiniGame1)) {
                    n.addComponent(MiniGame1);
                }
                return;
            }
            stack.push(...n.children);
        }
    }

    onLoad() {
        this.ws = WebSocketManager.getInstance();
        this.resolveBindings();
        if (this.errorPanel) this.errorPanel.active = false;
        if (this.todayLotteryResultPanel) this.todayLotteryResultPanel.active = false;
        if (this.claimSuccessPanel) this.claimSuccessPanel.active = false;
        this._popupState = 'none';
    }

    start() {
        this.bindButtons();
    }

    /** 定时同步（不能用 schedule(this.requestSync)：引擎会把 dt 当作第一个参数传给 requestSync，误当成 done 回调） */
    private readonly _scheduledSyncTick = () => {
        this.requestSync();
    };

    onEnable() {
        this.requestSync();
        this.schedule(this._scheduledSyncTick, DALETOU_SYNC_INTERVAL_SEC);
    }

    /** 每帧刷新 NowTime（无固定 1s 步进感）；服务端时间仍由 daletou_sync 定期校准 */
    update(): void {
        this.refreshNowTimeLabel();
        this.refreshOnlineTimeLabels();
        this.maybeAutoSyncForEligibility();
    }

    onDisable() {
        this.unschedule(this._scheduledSyncTick);
    }

    onDestroy() {
        this.unschedule(this._scheduledSyncTick);
        if (this._errorCloseTimer >= 0) {
            clearTimeout(this._errorCloseTimer);
        }
        if (this._successCloseTimer >= 0) {
            clearTimeout(this._successCloseTimer);
        }
        this.unbindButtons();
    }

    private refreshNowTimeLabel(): void {
        if (!this.nowTimeLabel?.isValid) return;
        if (this._serverTimeBaseMs != null) {
            const ms = this._serverTimeBaseMs + (Date.now() - this._serverTimeRecvAtMs);
            this.nowTimeLabel.string = this.formatDateToClock(new Date(ms));
            return;
        }
        this.nowTimeLabel.string = this.localClock();
    }

    /** 在线时间/剩余资格：用“上次服务器累计值 + 本地经过时间”持续显示，避免 UI 只隔 sync 才跳。 */
    private refreshOnlineTimeLabels(): void {
        if (!this._lastPayload) return;
        if (!this.onlineTimeLabel?.isValid && !this.timeUntilEligibleLabel?.isValid) return;

        const base = this._lastSyncOnlineSecondsBase ?? this._lastPayload.online_seconds ?? 0;
        const recvAt = this._lastSyncRecvAtMs || Date.now();
        const elapsedSec = (Date.now() - recvAt) / 1000;
        // 服务端每次累计 delta 最高 45s，这里用同样 cap 来估算
        const capped = Math.min(Math.max(elapsedSec, 0), 45);
        const estOnline = base + Math.floor(capped);

        if (this.onlineTimeLabel?.isValid) {
            this.onlineTimeLabel.string = this.fmtDuration(estOnline);
        }

        if (this.timeUntilEligibleLabel?.isValid) {
            const need = Math.max(0, REQUIRED_SECONDS - estOnline);
            this.timeUntilEligibleLabel.string = need > 0 ? this.fmtDuration(need) : '已达要求';
        }
    }

    private maybeAutoSyncForEligibility(): void {
        const p = this._lastPayload;
        if (!p) return;
        if (p.claimed) return;
        if (!this.ws.isConnected()) return;
        const day = (p.day || '').trim();
        if (!day) return;
        if (this._lastSyncDayKey !== day) {
            // 日切/期切：重置一次自动校验标记
            this._lastSyncDayKey = day;
            this._autoSyncedForEligibility = false;
        }
        if (this._autoSyncedForEligibility) return;
        const base = this._lastSyncOnlineSecondsBase ?? 0;
        const recvAt = this._lastSyncRecvAtMs || Date.now();
        const elapsedSec = (Date.now() - recvAt) / 1000;
        const capped = Math.min(Math.max(elapsedSec, 0), 45);
        const estOnline = base + Math.floor(capped);
        if (estOnline >= REQUIRED_SECONDS) {
            this._autoSyncedForEligibility = true;
            this.requestSync();
        }
    }

    private resolveBindings(): void {
        const g = (name: string) => this.findDeep(this.node, name);
        if (!this.energyLabel) this.energyLabel = g('Energy')?.getComponent(Label) ?? null;
        if (!this.onlineTimeLabel) this.onlineTimeLabel = g('OnlineTime')?.getComponent(Label) ?? null;
        if (!this.timeUntilEligibleLabel) this.timeUntilEligibleLabel = g('TimeUntilEligible')?.getComponent(Label) ?? null;
        if (!this.participateEligibleLabel) this.participateEligibleLabel = g('ParticipateEligible')?.getComponent(Label) ?? null;
        if (!this.nowTimeLabel) this.nowTimeLabel = g('NowTime')?.getComponent(Label) ?? null;
        if (!this.errorPanel) this.errorPanel = g('Error') ?? null;
        if (!this.errorTipLabel && this.errorPanel) {
            const ln = this.findDeep(this.errorPanel, 'Label');
            this.errorTipLabel = ln?.getComponent(Label) ?? null;
        }
        if (!this.todayLotteryResultPanel) this.todayLotteryResultPanel = g('TodayLotteryResult') ?? null;
        const tr = this.todayLotteryResultPanel;
        if (!this.resultPlayerNameLabel && tr) {
            this.resultPlayerNameLabel = this.findDeep(tr, 'PlayerName')?.getComponent(Label) ?? null;
        }
        if (!this.resultTipLabel && tr) {
            this.resultTipLabel = this.findDeep(tr, 'Tip')?.getComponent(Label) ?? null;
        }
        if (!this.backControlNode) this.backControlNode = g('BackControl') ?? null;

        if (!this.claimSuccessPanel) {
            this.claimSuccessPanel = g('ClaimSuccess') ?? g('Success') ?? null;
        }
        if (!this.claimSuccessTipLabel && this.claimSuccessPanel) {
            const sl = this.findDeep(this.claimSuccessPanel, 'Label');
            this.claimSuccessTipLabel = sl?.getComponent(Label) ?? null;
        }

        const trPanel = this.todayLotteryResultPanel;
        const claims: Node[] = [];
        const collectClaim = (root: Node) => {
            if (root.name === 'ClaimParticipateQual') claims.push(root);
            for (const c of root.children) collectClaim(c);
        };
        collectClaim(this.node);
        const mainClaim = claims.find((n) => !this.isUnderPanel(n, trPanel));
        if (mainClaim) {
            if (!this.mainIssueNumLabel) {
                this.mainIssueNumLabel = this.findDeep(mainClaim, 'issueNum')?.getComponent(Label) ?? null;
            }
            if (!this.mainClaimButtonLabel) {
                const ln = this.findDeep(mainClaim, 'Label');
                this.mainClaimButtonLabel = ln?.getComponent(Label) ?? null;
            }
        }
        if (trPanel && !this.resultIssueNumLabel) {
            this.resultIssueNumLabel = this.findDeep(trPanel, 'issueNum')?.getComponent(Label) ?? null;
        }
    }

    private findDeep(root: Node, name: string): Node | null {
        if (root.name === name) return root;
        for (const c of root.children) {
            const r = this.findDeep(c, name);
            if (r) return r;
        }
        return null;
    }

    private isUnderPanel(node: Node, panel: Node | null): boolean {
        if (!panel) return false;
        let p: Node | null = node.parent;
        while (p) {
            if (p === panel) return true;
            p = p.parent;
        }
        return false;
    }

    private bindButtons(): void {
        const claims: Node[] = [];
        const collect = (root: Node) => {
            if (root.name === 'ClaimParticipateQual') claims.push(root);
            for (const c of root.children) collect(c);
        };
        collect(this.node);
        const tr = this.todayLotteryResultPanel;
        const mainClaim = claims.find((n) => !this.isUnderPanel(n, tr));
        const innerClaim = claims.find((n) => this.isUnderPanel(n, tr));

        this._mainClaimBtnNode = mainClaim ?? null;
        if (mainClaim) {
            const b = mainClaim.getComponent(Button);
            if (b) b.node.on(Button.EventType.CLICK, this.onMainClaimClick, this);
            else mainClaim.on(Node.EventType.TOUCH_END, this.onMainClaimClick, this);
        }

        const viewResult = this.findDeep(this.node, 'ViewTodayLotteryResult');
        this._viewResultBtnNode = viewResult;
        if (viewResult) {
            const b2 = viewResult.getComponent(Button);
            if (b2) b2.node.on(Button.EventType.CLICK, this.onViewResultClick, this);
            else viewResult.on(Node.EventType.TOUCH_END, this.onViewResultClick, this);
        }

        this._innerClaimBtnNode = innerClaim ?? null;
        if (innerClaim) {
            const b3 = innerClaim.getComponent(Button);
            if (b3) b3.node.on(Button.EventType.CLICK, this.closeResultPanel, this);
            else innerClaim.on(Node.EventType.TOUCH_END, this.closeResultPanel, this);
        }

        if (this.backControlNode) {
            const bb = this.backControlNode.getComponent(Button);
            if (bb) {
                this._backCtrlBtnNode = bb.node;
                bb.node.on(Button.EventType.CLICK, this.onBackControl, this);
            } else {
                const innerBtn = this.findDeep(this.backControlNode, 'Button');
                if (innerBtn) {
                    const ib = innerBtn.getComponent(Button);
                    if (ib) {
                        this._backCtrlBtnNode = ib.node;
                        ib.node.on(Button.EventType.CLICK, this.onBackControl, this);
                    } else {
                        this._backCtrlBtnNode = innerBtn;
                        innerBtn.on(Node.EventType.TOUCH_END, this.onBackControl, this);
                    }
                } else {
                    this._backCtrlBtnNode = this.backControlNode;
                    this.backControlNode.on(Node.EventType.TOUCH_END, this.onBackControl, this);
                }
            }
        }
    }

    private unbindButtons(): void {
        const offClick = (btnNode: Node | null, handler: (...args: any[]) => void) => {
            if (!btnNode?.isValid) return;
            const b = btnNode.getComponent(Button);
            if (b) b.node.off(Button.EventType.CLICK, handler, this);
            else btnNode.off(Node.EventType.TOUCH_END, handler, this);
        };
        offClick(this._mainClaimBtnNode, this.onMainClaimClick);
        offClick(this._viewResultBtnNode, this.onViewResultClick);
        offClick(this._innerClaimBtnNode, this.closeResultPanel);
        offClick(this._backCtrlBtnNode, this.onBackControl);
    }

    private hideAllPopups(): void {
        if (this.todayLotteryResultPanel) this.todayLotteryResultPanel.active = false;
        if (this.claimSuccessPanel) this.claimSuccessPanel.active = false;
        if (this.errorPanel) this.errorPanel.active = false;
        if (this._errorCloseTimer >= 0) clearTimeout(this._errorCloseTimer);
        if (this._successCloseTimer >= 0) clearTimeout(this._successCloseTimer);
        this._errorCloseTimer = -1;
        this._successCloseTimer = -1;
        this._popupState = 'none';
    }

    private setMainClaimInteractable(enabled: boolean): void {
        const btn = this._mainClaimBtnNode?.getComponent(Button);
        if (btn) btn.interactable = enabled;
    }

    private cancelErrorPopup(): void {
        if (!this.errorPanel) return;
        if (this.errorPanel.active) this.errorPanel.active = false;
        if (this._errorCloseTimer >= 0) {
            clearTimeout(this._errorCloseTimer);
            this._errorCloseTimer = -1;
        }
        if (this._popupState === 'error') this._popupState = 'none';
    }

    private onMainClaimClick = () => {
        if (!this.ws.isConnected()) {
            this.showErrorAutoClose('网络未连接\n请连接后重试');
            return;
        }
        if (this._mainClaimRequesting) return;

        const sec = this._lastPayload?.seconds_until_eligible ?? REQUIRED_SECONDS;
        if (sec > 0) {
            this.showErrorAutoClose(
                `未获得参与资格\n当日在线满3小时才可领取，约还差${this.fmtDuration(sec)}`
            );
            return;
        }
        if (this._lastPayload?.claimed) {
            this.showErrorAutoClose('今日已领取\n无需重复领取');
            return;
        }

        this._mainClaimRequesting = true;
        this.setMainClaimInteractable(false);
        if (this._claimWatchdogTimer >= 0) clearTimeout(this._claimWatchdogTimer);
        // 兜底：避免极端情况下回调未触发，导致按钮永久不可点
        this._claimWatchdogTimer = window.setTimeout(() => {
            this._mainClaimRequesting = false;
            this.setMainClaimInteractable(!(this._lastPayload?.claimed ?? false));
            this._claimWatchdogTimer = -1;
        }, 16000) as unknown as number;

        this.ws.request(
            'daletou_claim',
            {},
            (resp: any) => {
                if (resp?.success && resp?.data) {
                    const data = resp.data as DaletouSyncPayload;
                    this.applyPayload(data);
                    if (data.claimed) {
                        // 成功不再弹 Error/Success 弹窗：只改文字（applyPayload 已把按钮改为“已参与”）
                        this.cancelErrorPopup();
                    }
                } else {
                    this.showErrorAutoClose(this.formatClaimErrorMessage(resp));
                }
                if (this._claimWatchdogTimer >= 0) {
                    clearTimeout(this._claimWatchdogTimer);
                    this._claimWatchdogTimer = -1;
                }
                this._mainClaimRequesting = false;
                this.setMainClaimInteractable(!(this._lastPayload?.claimed ?? false));
            },
            true,
            15000
        );
    };

    private onViewResultClick = () => {
        this.requestSync(() => {
            this.openResultPanel();
        });
    };

    private closeResultPanel = () => {
        if (this.todayLotteryResultPanel) this.todayLotteryResultPanel.active = false;
        if (this._popupState === 'result') this._popupState = 'none';
    };

    private onBackControl = () => {
        if (this.todayLotteryResultPanel?.active) {
            this.todayLotteryResultPanel.active = false;
            return;
        }
        if (this.claimSuccessPanel?.active) {
            this.claimSuccessPanel.active = false;
            if (this._successCloseTimer >= 0) {
                clearTimeout(this._successCloseTimer);
                this._successCloseTimer = -1;
            }
            return;
        }
        if (this.errorPanel?.active) {
            this.errorPanel.active = false;
            if (this._errorCloseTimer >= 0) {
                clearTimeout(this._errorCloseTimer);
                this._errorCloseTimer = -1;
            }
            return;
        }
        this.node.active = false;
    };

    /** 多行/长文案自动延长展示时间，避免读不完就关闭 */
    private errorPopupDurationMs(text: string): number {
        const lines = text.split('\n').length;
        const len = text.length;
        const base = 2500;
        const extraLines = Math.max(0, lines - 1) * 550;
        const extraChars = Math.max(0, len - 48) * 22;
        return Math.min(5600, base + extraLines + extraChars);
    }

    /**
     * Error 弹窗：建议两行——第一行结论，第二行说明（与场景里 Label 换行一致）。
     */
    private showErrorAutoClose(text: string): void {
        if (!this.errorPanel) return;
        this.hideAllPopups();
        if (this.errorTipLabel) this.errorTipLabel.string = text;
        this.errorPanel.active = true;
        this._popupState = 'error';
        if (this._errorCloseTimer >= 0) clearTimeout(this._errorCloseTimer);
        const ms = this.errorPopupDurationMs(text);
        this._errorCloseTimer = window.setTimeout(() => {
            if (this.errorPanel?.isValid) this.errorPanel.active = false;
            this._errorCloseTimer = -1;
            if (this._popupState === 'error') this._popupState = 'none';
        }, ms) as unknown as number;
    }

    /**
     * 领取成功弹窗：优先 ClaimSuccess / Success 节点；若无则用 Error 面板样式（延长展示时间）。
     */
    private showClaimSuccess(text: string): void {
        const duration = 2200;
        this.hideAllPopups();
        if (this.claimSuccessPanel && this.claimSuccessTipLabel) {
            this.claimSuccessTipLabel.string = text;
            this.claimSuccessPanel.active = true;
            this._popupState = 'success';
            if (this._successCloseTimer >= 0) clearTimeout(this._successCloseTimer);
            this._successCloseTimer = window.setTimeout(() => {
                if (this.claimSuccessPanel?.isValid) this.claimSuccessPanel.active = false;
                this._successCloseTimer = -1;
                if (this._popupState === 'success') this._popupState = 'none';
            }, duration) as unknown as number;
            return;
        }
        // 场景未单独做成功弹窗时：沿用 Error 节点，时间略长
        const prev = this._errorCloseTimer;
        if (prev >= 0) clearTimeout(prev);
        if (!this.errorPanel) return;
        if (this.errorTipLabel) this.errorTipLabel.string = text;
        this.errorPanel.active = true;
        this._popupState = 'success';
        this._errorCloseTimer = window.setTimeout(() => {
            if (this.errorPanel?.isValid) this.errorPanel.active = false;
            this._errorCloseTimer = -1;
            if (this._popupState === 'success') this._popupState = 'none';
        }, duration) as unknown as number;
    }

    /** 将服务端 daletou_claim 失败转为可读文案 */
    private formatClaimErrorMessage(resp: any): string {
        const msg = String(resp?.message ?? '').trim();
        const code = resp?.code;

        if (code === 401 || msg.includes('未登录')) {
            return '无法领取\n请先登录游戏';
        }
        if (msg.includes('未选择角色') || msg.includes('no_character')) {
            return '无法领取\n请先选择角色';
        }
        if (msg.includes('未满3小时') || msg.includes('not_enough_online')) {
            return '未获得参与资格\n当日在线未满3小时';
        }
        if (msg.includes('player_not_found') || msg.includes('not_found')) {
            return '领取失败\n角色数据异常，请稍后重试';
        }
        if (msg.includes('already_claimed') || msg.includes('已领取')) {
            return '今日已领取\n无需重复领取';
        }
        if (msg.includes('429') || code === 429) {
            return '操作过于频繁\n请稍后再试';
        }
        if (msg) {
            return `领取失败\n${msg}`;
        }
        return '领取失败\n请稍后重试';
    }

    private requestSync = (done?: () => void) => {
        if (!this.ws.isConnected()) return;
        this.ws.request(
            'daletou_sync',
            {},
            (resp: any) => {
                if (resp?.success && resp?.data) {
                    this.applyPayload(resp.data as DaletouSyncPayload);
                }
                done?.();
            },
            true,
            12000
        );
    };

    private applyPayload(d: DaletouSyncPayload): void {
        this._lastPayload = d;
        if (this.energyLabel) {
            const eb = d.energy_blocks;
            this.energyLabel.string =
                eb !== undefined && eb !== null && Number.isFinite(Number(eb)) ? String(eb) : '—';
        }
        if (this.onlineTimeLabel) {
            this.onlineTimeLabel.string = this.fmtDuration(d.online_seconds ?? 0);
        }
        if (this.timeUntilEligibleLabel) {
            const need = d.seconds_until_eligible ?? 0;
            this.timeUntilEligibleLabel.string = need > 0 ? this.fmtDuration(need) : '已达要求';
        }
        if (this.participateEligibleLabel) {
            const base = d.claimed ? '已领取' : '未领取';
            const rn = (d.role_name || '').trim();
            this.participateEligibleLabel.string = rn ? `${base}（${rn}）` : base;
        }
        if (this.nowTimeLabel) {
            if (d.server_time) {
                const parsed = this.parseServerTimeToMs(d.server_time);
                if (parsed != null) {
                    this._serverTimeBaseMs = parsed;
                    this._serverTimeRecvAtMs = Date.now();
                    this.nowTimeLabel.string = this.formatDateToClock(new Date(parsed));
                } else {
                    // 解析失败则退回本地时间显示
                    this.nowTimeLabel.string = this.localClock();
                }
            } else {
                this.nowTimeLabel.string = this.localClock();
            }
        }

        // 更新本地“在线估算”基准
        this._lastSyncRecvAtMs = Date.now();
        this._lastSyncOnlineSecondsBase = d.online_seconds ?? 0;
        this._lastSyncDayKey = (d.day || '').trim();
        this._autoSyncedForEligibility = false;

        const issueKey = this.getIssueKey(d);
        if (this.mainIssueNumLabel) this.mainIssueNumLabel.string = issueKey;
        if (this.resultIssueNumLabel) this.resultIssueNumLabel.string = issueKey;

        if (this.mainClaimButtonLabel) {
            this.mainClaimButtonLabel.string = d.claimed ? '已参与' : '参与游戏';
        }

        // 已领取资格后：直接禁止再次点“领取”，减少误触造成的“今日已领取”弹窗错觉
        this.setMainClaimInteractable(!d.claimed && !this._mainClaimRequesting);

        // 若用户正停留在“开奖结果”面板，则同步刷新减少错觉/信息滞后
        if (this.todayLotteryResultPanel?.active) {
            this.openResultPanel();
        }
    }

    private openResultPanel(): void {
        if (!this.todayLotteryResultPanel) return;
        this.hideAllPopups();
        const d = this._lastPayload;
        const code = d?.result_tip_code ?? 5;

        if (this.resultPlayerNameLabel) {
            // 始终显示本期中奖玩家名字（若无人中奖则给出占位）
            const winName = (d?.winner_display_name || '').trim();
            this.resultPlayerNameLabel.string = winName.length > 0 ? winName : '本期暂无中奖玩家';
        }

        if (this.resultTipLabel) {
            let tip = RESULT_TIP[code] ?? RESULT_TIP[5];
            const winName = (d?.winner_display_name || '').trim();
            // 已开奖且 tip 未强调「谁中了」时，补一行头奖公示（避免与中奖名单区信息脱节）
            if (winName && (d?.draw_finished || d?.after_draw_time) && code !== 4 && code !== 1) {
                tip += `\n\n本期头奖：${winName}`;
            }
            if (code === 4 && d?.is_winner) {
                tip += '\n\n奖励已发放至当前角色。';
            }
            this.resultTipLabel.string = tip;
        }

        const issueKey = this.getIssueKey(d ?? null);
        if (this.resultIssueNumLabel) this.resultIssueNumLabel.string = issueKey;

        this.todayLotteryResultPanel.active = true;
        this._popupState = 'result';
    }

    private fmtDuration(sec: number): string {
        const s = Math.max(0, Math.floor(sec));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const r = s % 60;
        return `${h}小时${m}分${r}秒`;
    }

    private localClock(): string {
        const t = new Date();
        const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`;
    }

    /** 期号：优先服务端 issue，否则由 day / 本地推算 */
    private getIssueKey(d?: DaletouSyncPayload | null): string {
        const iss = (d?.issue ?? '').trim();
        if (iss.length === 8 && /^\d{8}$/.test(iss)) return iss;
        return this.formatIssueKeyFromDay(d?.day);
    }

    private formatIssueKeyFromDay(day?: string): string {
        if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
            return day.replace(/-/g, '');
        }
        const st = this._lastPayload?.server_time ?? '';
        if (st.length >= 10) {
            const head = st.slice(0, 10).replace(/-/g, '');
            if (head.length === 8 && /^\d{8}$/.test(head)) return head;
        }
        const t = new Date();
        const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        return `${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}`;
    }

    private parseServerTimeToMs(serverTime: string): number | null {
        // server_time 格式：YYYY-MM-DD HH:mm:ss（无时区信息，按本机本地时间解释用于展示）
        const s = String(serverTime || '').trim();
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
        if (!m) return null;
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const d = parseInt(m[3], 10);
        const h = parseInt(m[4], 10);
        const mi = parseInt(m[5], 10);
        const se = parseInt(m[6], 10);
        const dt = new Date(y, mo, d, h, mi, se);
        const ms = dt.getTime();
        return Number.isFinite(ms) ? ms : null;
    }

    private formatDateToClock(dt: Date): string {
        const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}`;
    }
}
