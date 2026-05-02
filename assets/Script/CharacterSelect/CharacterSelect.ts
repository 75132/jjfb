import { _decorator, Component, Node, Sprite, SpriteFrame, Label, Button, director } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import { DataCacheManager } from '../global/DataCacheManager';
import { RobotShow } from '../Game/RobotShow';
import { getEnergyBlocksFromPayload } from '../global/MessageTypes';
import { CharacterCreatePanel } from './CharacterPanel';
const { ccclass, property } = _decorator;

@ccclass('CharacterSelect')
export class CharacterSelect extends Component {
    @property([Node])
    roleSlots: Node[] = [];
    @property(SpriteFrame)
    normalBg: SpriteFrame = null!;
    @property(SpriteFrame)
    selectedBg: SpriteFrame = null!;
    @property([SpriteFrame])
    characterSprites: SpriteFrame[] = [];
    @property(Label) roleNameLabel: Label = null!;
    @property(Label) allianceLabel: Label = null!;
    @property(Label) goldLabel: Label = null!;
    @property(Label) energyBlocksLabel: Label = null!;
    @property(Label) levelLabel: Label = null!;
    @property(Label) recordLabel: Label = null!;
    @property(Label) robotcountLabel: Label = null!;
    @property(Label) positionLabel: Label = null!;
    @property(Label) rankLabel: Label = null!;
    @property(Node) createPanel: Node = null!;
    @property([Button]) deleteButtons: Button[] = [];
    @property([Button]) startgameButtons: Button[] = [];
    @property([Button]) createButtons: Button[] = [];
    @property(Node) deleteonfirm: Node = null!;
    @property(Button) okButton: Button = null!;
    @property(Button) cancelButton: Button = null!;
    
    // 新增：Loading节点（在场景中绑定到`Loading`节点）
    @property({ type: Node, tooltip: '切换到Game场景前的加载遮罩' })
    loadingNode: Node | null = null;

    @property({ type: Label, tooltip: '首次进入选角的操作提示（可选绑定，约5秒后自动隐藏）' })
    slotHintLabel: Label | null = null;

    private wsManager: WebSocketManager = null!;
    private selectedIndex: number = 0;
    private requestIdToSlotIndex: { [key: string]: number } = {};
    private lastClickTime: number = 0;
    private lastClickSlot: number = -1;
    private showBtnSlot: number = -1;
    private slotRoleData: any[] = [];
    private pendingDeleteSlot: number = -1;
    private hasLoadedCharacters: boolean = false; // 标记是否已加载角色数据（本场景列表是否已拉到）
    /** 已成功应用到槽位 UI 的批量列表指纹；与本次响应一致则跳过重复重绘 */
    private lastAppliedAllCharsFp: string = '';
    private pendingStartGameSlot: number = -1; // 等待进入游戏的槽位索引
    private selectCharacterTimeout: any = null; // 选择角色超时定时器
    private slotDataFallbackTimer: any = null; // 批量加载慢时的兜底单槽位请求
    // 修复点：删除/开始游戏过程状态标记，防止高频点击导致多次请求和状态错乱
    private isDeleting: boolean = false;
    private isStartingGame: boolean = false;
    /** 假定会话仍有效的兜底定时器（从游戏返回时可能收不到第二次 auth_response） */
    private staleSessionFallbackTimer: any = null;
    /** 初始化阶段 one-shot 定时器，场景销毁时一并清理，避免残留回调 */
    private initOneShotTimers: any[] = [];

    private trackInitTimer(handle: any): void {
        if (handle !== undefined && handle !== null) {
            this.initOneShotTimers.push(handle);
        }
    }

    private clearInitOneShotTimers(): void {
        for (const h of this.initOneShotTimers) {
            try {
                clearTimeout(h);
            } catch (_) {}
        }
        this.initOneShotTimers.length = 0;
    }

    /** 坐标分量显示为整数（四舍五入），避免浮点误差拉出长小数 */
    private roundCoordForDisplay(v: any): number | null {
        const n = Number(v);
        if (!Number.isFinite(n)) return null;
        return Math.round(n);
    }

    /** 详情里职位/坐标一行：只显示 x, y（整数），避免整段 JSON（含 updated_at 等）撑爆界面 */
    private formatPositionForLabel(position: any): string {
        if (position == null) return '';
        let p: any = position;
        if (typeof p === 'string') {
            const s = p.trim();
            if (!s) return '';
            try {
                p = JSON.parse(s);
            } catch {
                return '';
            }
        }
        if (Array.isArray(p) && p.length >= 2) {
            const xr = this.roundCoordForDisplay(p[0]);
            const yr = this.roundCoordForDisplay(p[1]);
            if (xr === null || yr === null) return '';
            return `${xr}, ${yr}`;
        }
        if (typeof p === 'object') {
            const x = p.x ?? p.X;
            const y = p.y ?? p.Y;
            if (x !== undefined && x !== null && y !== undefined && y !== null) {
                const xr = this.roundCoordForDisplay(x);
                const yr = this.roundCoordForDisplay(y);
                if (xr === null || yr === null) return '';
                return `${xr}, ${yr}`;
            }
        }
        return '';
    }

    onLoad() {
        if (this.createPanel) this.createPanel.active = false;
        if (this.deleteonfirm) this.deleteonfirm.active = false;
        // 默认隐藏Loading
        if (this.loadingNode) this.loadingNode.active = false;
    }

    start() {
        console.log('🎮 CharacterSelect组件启动');
        // 预加载Game场景，提高跳转速度
        this.preloadGameScene();
        
        // 重置状态（鉴权态由 WebSocketManager.sessionAuthenticated 统一管理）
        this.hasLoadedCharacters = false;
        this.lastAppliedAllCharsFp = '';
        
        // 延迟初始化，避免引擎内部错误；组件销毁后不再执行
        const startDelay = setTimeout(() => {
            // 修复点：组件销毁后不再初始化，避免访问已销毁节点/事件
            if (!this.isValid) return;
            console.log('🔧 开始初始化组件');
            this.initializeComponents();
        }, 200);
        this.trackInitTimer(startDelay);
    }

    // 预加载状态标记
    private gameScenePreloaded: boolean = false;
    // 是否因点击进入游戏而触发的预加载
    private preloadingForJump: boolean = false;
    // 是否在等待预加载完成后立即跳转
    private waitJumpAfterPreload: boolean = false;

    /**
     * 预加载Game场景
     */
    private preloadGameScene(): void {
        const startTime = Date.now();
        
        director.preloadScene(GameConfig.SCENE_NAMES.GAME, () => {}, (error) => {
            if (error) {
                this.gameScenePreloaded = false;
            } else {
                this.gameScenePreloaded = true;
                // 如果是为跳转触发的预加载，完成后立即跳转并隐藏Loading
                if (this.waitJumpAfterPreload) {
                    this.hideLoading();
                    this.waitJumpAfterPreload = false;
                    this.jumpToGameScene();
                }
            }
        });
    }

    private showLoading(): void {
        if (this.loadingNode && !this.loadingNode.active) {
            this.loadingNode.active = true;
        }
    }

    private hideLoading(): void {
        if (this.loadingNode && this.loadingNode.active) {
            this.loadingNode.active = false;
        }
    }

    private initializeComponents() {
        // 获取WebSocketManager实例
        try {
            this.wsManager = WebSocketManager.getInstance();
            if (this.wsManager) {
                // 恢复事件监听：服务器返回的是 'all_characters_response'，不是 'get_all_characters_response'
                this.wsManager.on('character_info_response', this.onCharacterInfo, this);
                this.wsManager.on('all_characters_response', this.onAllCharactersResponse, this); // 批量响应
                this.wsManager.on('delete_character_response', this.onDeleteCharacterResponse, this);
                this.wsManager.on('robotcount_update', this.onRobotCountUpdate, this);
                this.wsManager.on('create_character_response', this.onCreateCharacterSuccess, this); // 监听创建角色响应
                // 注意：不再监听 select_character_response 事件，因为 request 方法已经处理了响应
                // this.wsManager.on('select_character_response', this.onSelectCharacterResponse, this);
                
                // 监听认证响应，认证成功后再加载角色数据
                this.wsManager.on('auth_response', this.onAuthResponse, this);
                
                // 检查是否有token和userId，如果有则自动加载角色数据
                const token = this.wsManager.getToken();
                const userId = this.wsManager.getUserId();
                console.log('🔍 检查登录状态 - token:', token ? '存在' : '不存在', ', userId:', userId ? '存在' : '不存在');
                
                if (token && userId) {
                    console.log('✅ 检测到已登录，准备加载角色数据');
                    
                    // 重置状态标记（每次进入场景都重新加载列表；会话是否已鉴权请看 WebSocketManager）
                    this.hasLoadedCharacters = false;
                    this.lastAppliedAllCharsFp = '';
                    
                    // 确保 WebSocket 已建立（切换角色回选角后可能刚重连）
                    if (!this.wsManager.isConnected()) {
                        console.log('🔄 WebSocket未连接，正在重新连接...');
                        this.wsManager.connect();
                        // 等待认证完成后再加载（通过onAuthResponse回调）
                        // 设置超时，如果2秒后还没认证成功，假定会话有效并尝试拉列表（避免卡死）
                        const t2 = setTimeout(() => {
                            if (!this.isValid) return;
                            if (!this.hasLoadedCharacters && !this.wsManager.isSessionAuthenticated()) {
                                console.warn('⚠️ 认证响应超时（2秒），假定会话仍有效并尝试加载角色');
                                this.tryAssumeSessionAndRefresh('reconnect_2s');
                            }
                        }, 2000);
                        this.trackInitTimer(t2);
                    } else {
                        // 如果已经连接，检查是否需要重新认证
                        // WebSocketManager在连接时会自动发送auth_request，但如果是已存在的连接，可能需要手动触发
                        console.log('✅ WebSocket已连接，检查认证状态');
                        
                        // 如果连接已建立但还没认证，主动发送认证请求
                        const currentToken = this.wsManager.getToken();
                        if (currentToken && !this.wsManager.isSessionAuthenticated()) {
                            console.log('🔄 主动发送认证请求');
                            // 使用GameConfig中的消息类型
                            this.wsManager.send({
                                type: 'auth_request',
                                token: currentToken
                            }, false);
                        }
                        
                        // 已连接但从游戏返回时，服务端可能不再下发第二次 auth_response，需兜底拉列表
                        this.scheduleStaleSessionFallback();
                        
                        // 若短暂等待后仍无认证事件，再尝试一次（不把 hasLoadedCharacters 假置 true）
                        const t15 = setTimeout(() => {
                            if (!this.isValid) return;
                            if (!this.hasLoadedCharacters && !this.wsManager.isSessionAuthenticated()) {
                                console.warn('⚠️ 认证响应超时（1.5秒），假定会话仍有效并尝试加载角色');
                                this.tryAssumeSessionAndRefresh('connected_1_5s');
                            }
                        }, 1500);
                        this.trackInitTimer(t15);
                    }
                } else {
                    console.warn('⚠️ 未检测到登录信息，无法加载角色数据');
                }
            }
        } catch (error) {
            console.error('❌ 初始化组件失败:', error);
        }
        
        // 绑定创建面板事件
        if (this.createPanel) {
            try {
                this.createPanel.on('refresh_slots_and_hide_buttons', () => {
                    this.refreshAllSlots();
                    this.hideAllSlotButtons();
                }, this);
            } catch (error) {}
        }
        
        // 绑定槽位点击事件
        this.roleSlots.forEach((node, idx) => {
            if (node && typeof node.on === 'function') {
                try { node.on(Node.EventType.TOUCH_END, () => this.onSelectRole(idx), this); } catch {}
            }
        });
        
        // 绑定删除按钮事件
        this.deleteButtons.forEach((btn, idx) => {
            if (btn && btn.node && typeof btn.node.on === 'function') {
                try { btn.node.on(Button.EventType.CLICK, () => this.onDeleteClick(idx), this); btn.node.active = false; } catch {}
            }
        });
        
        // 绑定开始游戏按钮事件
        this.startgameButtons.forEach((btn, idx) => {
            if (btn && btn.node && typeof btn.node.on === 'function') {
                try { btn.node.on(Button.EventType.CLICK, () => this.onStartGameClick(idx), this); btn.node.active = false; } catch {}
            }
        });
        
        // 绑定创建按钮事件
        this.createButtons.forEach((btn, idx) => {
            if (btn && btn.node && typeof btn.node.on === 'function') {
                try { btn.node.on(Button.EventType.CLICK, () => this.onCreateClick(idx), this); btn.node.active = false; } catch {}
            }
        });
        
        // 绑定确认/取消删除
        if (this.okButton && this.okButton.node && typeof this.okButton.node.on === 'function') {
            try { this.okButton.node.on(Button.EventType.CLICK, this.onOkDelete, this); } catch {}
        }
        if (this.cancelButton && this.cancelButton.node && typeof this.cancelButton.node.on === 'function') {
            try { this.cancelButton.node.on(Button.EventType.CLICK, this.onCancelDelete, this); } catch {}
        }
        
            // 首次选中第 0 槽（背景与详情面板）；列表数据由 refreshAllSlots / 批量响应刷新
        try { this.applySlotSelection(0, false); this.refreshAllSlots(); } catch {}
        this.scheduleSlotHintOnce();
    }

    /** 首次进入时提示：单击槽位即可显示创建/进入游戏等按钮；快速双击同一槽可收起 */
    private scheduleSlotHintOnce(): void {
        if (!this.slotHintLabel || !this.slotHintLabel.node) return;
        this.slotHintLabel.node.active = true;
        this.slotHintLabel.string = '单击角色槽位可选中并显示操作；同一槽位快速双击可收起按钮';
        this.scheduleOnce(() => {
            if (this.slotHintLabel && this.slotHintLabel.isValid) {
                this.slotHintLabel.node.active = false;
            }
        }, 5);
    }

    /**
     * 仅更新槽位背景高亮，不触发双击逻辑、不抢发单槽请求
     */
    private applySlotSelection(idx: number, updateDetailFromCache: boolean): void {
        this.selectedIndex = idx;
        this.roleSlots.forEach((node, i) => {
            if (!node) return;
            const bgSpriteNode = node.getChildByName('BgSprite');
            if (bgSpriteNode) {
                const bgSprite = bgSpriteNode.getComponent(Sprite);
                if (bgSprite) {
                    bgSprite.spriteFrame = (i === idx) ? this.selectedBg : this.normalBg;
                }
            }
        });
        if (updateDetailFromCache) {
            this.refreshDetailPanelForSlot(idx);
        }
    }

    /**
     * 根据已缓存的 slotRoleData 刷新右侧详情（批量数据到达后调用，无需再点一次槽位）
     */
    private refreshDetailPanelForSlot(idx: number): void {
        const data = this.slotRoleData[idx];
        if (!data || !data.role_name || data.role_name === 0 || data.role_name === '0') {
            this.setLabelsActive(false);
            return;
        }
        if (this.roleNameLabel) this.roleNameLabel.string = data.role_name;
        if (this.goldLabel) this.goldLabel.string = data.gold != null ? String(data.gold) : '';
        if (this.levelLabel) this.levelLabel.string = data.level != null ? String(data.level) : '';
        if (this.energyBlocksLabel) this.energyBlocksLabel.string = String(getEnergyBlocksFromPayload(data));
        if (this.allianceLabel) this.allianceLabel.string = data.alliance || '';
        if (this.recordLabel) this.recordLabel.string = data.record || '';
        if (this.robotcountLabel) this.robotcountLabel.string = data.robotcount != null ? String(data.robotcount) : '';
        if (this.positionLabel) this.positionLabel.string = this.formatPositionForLabel(data.position);
        if (this.rankLabel) this.rankLabel.string = data.rank || '';
        this.setLabelsActive(true);
    }

    /**
     * 从游戏返回时连接未断，可能不会再次收到 auth_response，此时假定会话仍有效并拉列表
     */
    private scheduleStaleSessionFallback(): void {
        if (this.staleSessionFallbackTimer) {
            clearTimeout(this.staleSessionFallbackTimer);
            this.staleSessionFallbackTimer = null;
        }
        this.staleSessionFallbackTimer = setTimeout(() => {
            this.staleSessionFallbackTimer = null;
            if (!this.isValid) return;
            if (this.wsManager.isSessionAuthenticated() || this.hasLoadedCharacters) return;
            if (!this.wsManager?.isConnected()) return;
            const token = this.wsManager.getToken();
            const userId = this.wsManager.getUserId();
            if (!token || !userId) return;
            console.log('ℹ️ [CharacterSelect] 已连接但未收到 auth_response，假定会话有效并拉取角色列表');
            this.tryAssumeSessionAndRefresh('stale_session_800ms');
        }, 800) as any;
    }

    private tryAssumeSessionAndRefresh(reason: string): void {
        if (!this.isValid || !this.wsManager) return;
        if (!this.wsManager.isConnected()) return;
        const token = this.wsManager.getToken();
        const userId = this.wsManager.getUserId();
        if (!token || !userId) return;
        // 已认证且列表已成功拉取，避免兜底重复拉列表
        if (this.wsManager.isSessionAuthenticated() && this.hasLoadedCharacters) {
            return;
        }
        if (!this.wsManager.isSessionAuthenticated()) {
            if (!this.wsManager.tryMarkSessionAuthenticatedIfConnected()) return;
            console.log(`🔄 [CharacterSelect] 假定会话仍有效 (${reason})，请求角色列表`);
        } else {
            console.log(`🔄 [CharacterSelect] 会话已由 WebSocketManager 标记有效，补拉角色列表 (${reason})`);
        }
        this.refreshAllSlots();
    }

    refreshAllSlots() {
        if (!this.wsManager) {
            console.warn('⚠️ refreshAllSlots: wsManager不存在');
            return;
        }
        
        const token = this.wsManager.getToken();
        if (!token) {
            console.warn('⚠️ refreshAllSlots: token不存在');
            return;
        }
        
        if (!this.wsManager.isConnected()) {
            console.warn('⚠️ refreshAllSlots: WebSocket未连接');
            return;
        }
        
        // 鉴权态由 WebSocketManager 统一管理（含不断线返回选角）
        if (!this.wsManager.isSessionAuthenticated()) {
            console.warn('⚠️ refreshAllSlots: 尚未标记会话已鉴权，等待 auth_response 或短重试');
            let retryCount = 0;
            const maxRetries = 5;
            const checkAuth = () => {
                if (!this.isValid) {
                    return;
                }
                retryCount++;
                if (this.wsManager.isSessionAuthenticated()) {
                    console.log('✅ 会话已鉴权，重新尝试加载角色数据');
                    this.refreshAllSlots();
                } else if (retryCount < maxRetries) {
                    setTimeout(checkAuth, 100);
                } else {
                    console.warn('⚠️ 短重试内仍未鉴权，假定会话仍有效并尝试拉取角色列表');
                    this.tryAssumeSessionAndRefresh('auth_retry_exhausted');
                }
            };
            setTimeout(checkAuth, 100);
            return;
        }
        
        console.log('🔄 批量获取所有角色信息（立即请求）');
        this.wsManager.requestGetAllCharactersNow(true);
    }
    
    /**
     * 处理批量角色信息响应（优化：一次性接收所有槽位数据）
     * 修复：确保 this 绑定正确，避免 "is not a function" 错误
     * 注意：这是事件监听器，会被 WebSocketManager 调用
     */
    private onAllCharactersResponse = (data: any): void => {
        console.log('📥 收到批量角色信息响应:', data);
        
        // 兼容标准格式（data字段）和直接格式
        const resp = data.data || data;
        
        if (!resp) {
            console.error('❌ 批量角色信息响应为空');
            return;
        }
        
        if (resp.success && resp.characters && typeof resp.characters === 'object') {
            const fp = WebSocketManager.fingerprintAllCharactersPayload(resp.characters);
            if (this.hasLoadedCharacters && fp && fp === this.lastAppliedAllCharsFp) {
                console.log('ℹ️ [CharacterSelect] 角色列表与当前界面一致，跳过重复刷新');
                return;
            }

            const characterCount = Object.keys(resp.characters).length;
            console.log(`✅ 批量接收 ${characterCount} 个槽位的角色数据`);
            
            // 处理每个槽位的数据
            for (const slotIndexStr in resp.characters) {
                const slotIndex = parseInt(slotIndexStr);
                if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= this.roleSlots.length) {
                    console.warn(`⚠️ 无效的槽位索引: ${slotIndexStr}`);
                    continue;
                }
                
                const charData = resp.characters[slotIndex];
                if (charData && typeof charData === 'object') {
                    // 确保 slot_index 正确设置
                    charData.slot_index = slotIndex;
                    // 使用现有的onCharacterInfo方法处理单个槽位数据
                    this.onCharacterInfo(charData);
                } else {
                    // 空槽位，清空数据但保留槽位结构
                    console.log(`ℹ️ 槽位 ${slotIndex} 为空`);
                    this.slotRoleData[slotIndex] = {
                        slot_index: slotIndex,
                        role_name: '',
                        Sprite: 0
                    };
                    // 更新显示
                    const slotNode = this.roleSlots[slotIndex];
                    if (slotNode) {
                        const characterSpriteNode = slotNode.getChildByName('Sprite');
                        if (characterSpriteNode) {
                            const characterSprite = characterSpriteNode.getComponent(Sprite);
                            if (characterSprite) {
                                characterSprite.spriteFrame = null;
                                characterSpriteNode.active = false;
                            }
                        }
                    }
                }
            }
            console.log('✅ 批量角色数据加载完成');
            // 批量加载成功：后续不要再抢发单槽位 get_character_info
            this.hasLoadedCharacters = true;
            this.lastAppliedAllCharsFp = fp;
            if (this.slotDataFallbackTimer) {
                clearTimeout(this.slotDataFallbackTimer);
                this.slotDataFallbackTimer = null;
            }
            // 数据已就绪：立即同步当前选中槽的立绘与详情（避免必须再点一次槽位）
            this.scheduleOnce(() => {
                if (!this.isValid) return;
                this.applySlotSelection(this.selectedIndex, true);
            }, 0);
        } else {
            const errorMsg = resp.message || resp.error || '未知错误';
            console.error('❌ 批量获取角色信息失败:', errorMsg);
        }
    };

    onSelectRole(idx: number) {
        this.selectedIndex = idx;
        this.roleSlots.forEach((node, i) => {
            if (!node) return;
            
            const bgSpriteNode = node.getChildByName('BgSprite');
            if (bgSpriteNode) {
                const bgSprite = bgSpriteNode.getComponent(Sprite);
                if (bgSprite) {
                    bgSprite.spriteFrame = (i === idx) ? this.selectedBg : this.normalBg;
                }
            }
        });
        
        const now = Date.now();
        const doubleTapSame = this.lastClickSlot === idx && now - this.lastClickTime < 400;
        if (doubleTapSame) {
            if (this.showBtnSlot === idx) {
                this.hideAllSlotButtons();
            } else {
                this.showSlotButtons(idx);
            }
        } else {
            this.showSlotButtons(idx);
        }
        this.lastClickSlot = idx;
        this.lastClickTime = now;
        
        // 修复：如果数据不存在或可能过期，先请求数据
        // 但不要清空已有数据，避免角色消失
        if (!this.slotRoleData[idx] || !this.slotRoleData[idx].character_id) {
            // 批量数据还没回（网页端更容易慢）：先等一会儿，避免抢发单槽位请求导致超时/重试拖慢进入
            if (!this.hasLoadedCharacters) {
                if (this.slotDataFallbackTimer) {
                    clearTimeout(this.slotDataFallbackTimer);
                    this.slotDataFallbackTimer = null;
                }
                this.slotDataFallbackTimer = setTimeout(() => {
                    this.slotDataFallbackTimer = null;
                    // 仍未批量加载完成时才兜底，并且只在用户仍停留该槽位时请求
                    if (!this.hasLoadedCharacters && this.selectedIndex === idx) {
                        this.requestSlotData(idx);
                    }
                }, 1200);
                return;
            }

            this.requestSlotData(idx);
        } else {
            // 如果数据已存在，也更新一下label显示
            const data = this.slotRoleData[idx];
            if (data.role_name && data.role_name !== 0 && data.role_name !== '0') {
                if (this.roleNameLabel) this.roleNameLabel.string = data.role_name;
                if (this.goldLabel) this.goldLabel.string = data.gold != null ? String(data.gold) : '';
                if (this.levelLabel) this.levelLabel.string = data.level != null ? String(data.level) : '';
                if (this.energyBlocksLabel) this.energyBlocksLabel.string = String(getEnergyBlocksFromPayload(data));
                if (this.allianceLabel) this.allianceLabel.string = data.alliance || '';
                if (this.recordLabel) this.recordLabel.string = data.record || '';
                if (this.robotcountLabel) this.robotcountLabel.string = data.robotcount != null ? String(data.robotcount) : '';
                if (this.positionLabel) this.positionLabel.string = this.formatPositionForLabel(data.position);
                if (this.rankLabel) this.rankLabel.string = data.rank || '';
                this.setLabelsActive(true);
            } else {
                this.setLabelsActive(false);
            }
        }
    }

    requestSlotData(idx: number) {
        if (!this.wsManager) {
            console.warn('⚠️ requestSlotData: wsManager不存在');
            return;
        }
        
        const token = this.wsManager.getToken();
        if (!token) {
            console.warn('⚠️ requestSlotData: token不存在');
            return;
        }
        
        // 确保 requestIdToSlotIndex 已初始化
        if (!this.requestIdToSlotIndex) {
            this.requestIdToSlotIndex = {};
        }
        
        const requestId = `char_info_${Date.now()}_${idx}`;
        // 提前设置 requestId 映射，避免回调中访问时出错
        this.requestIdToSlotIndex[requestId] = idx;
        
        this.wsManager.request(
            'get_character_info',
            {
                slot_index: idx,
                request_id: requestId
            },
            undefined,  // 不使用 request 回调，改为依赖全局事件 character_info_response
            true,
            10000
        );
    }

    showSlotButtons(idx: number) {
        this.hideAllSlotButtons();
        this.showBtnSlot = idx;
        
        // 确保槽位数据是最新的（如果数据不存在或可能过期，先请求一次）
        const data = this.slotRoleData[idx];
        if (!data) {
            // 如果数据不存在，先请求数据，然后显示创建按钮（因为可能是空槽位）
            console.log(`⚠️ 槽位 ${idx} 数据不存在，先请求数据`);
            // 批量加载还没完成时（网页端更容易慢），避免抢发单槽位请求导致超时/重试拖慢进入
            if (!this.hasLoadedCharacters) {
                setTimeout(() => {
                    // 只在用户仍停留在该槽位时重试
                    if (!this.hasLoadedCharacters && this.selectedIndex === idx) {
                        this.showSlotButtons(idx);
                    }
                }, 300);
                return;
            }

            this.requestSlotData(idx);
            // 延迟显示按钮，等待数据加载
            setTimeout(() => {
                const updatedData = this.slotRoleData[idx];
                if (updatedData) {
                    this.showSlotButtons(idx); // 重新判断
                } else {
                    // 如果还是没有数据，显示创建按钮
            if (this.createButtons[idx] && this.createButtons[idx].node) {
                this.createButtons[idx].node.active = true;
            }
                }
            }, 300);
            return;
        }
        
        // 检查是否有角色（使用更严格的判断）
        const hasCharacter = data.role_name && 
                            data.role_name !== 0 && 
                            data.role_name !== '0' && 
                            data.role_name !== '' &&
                            data.Sprite && 
                            data.Sprite !== 0 && 
                            data.Sprite !== '0';
        
        if (!hasCharacter) {
            // 空槽位，显示创建按钮
            if (this.createButtons[idx] && this.createButtons[idx].node) {
                this.createButtons[idx].node.active = true;
            }
        } else {
            // 有角色，显示删除和开始游戏按钮
            if (this.deleteButtons[idx] && this.deleteButtons[idx].node) {
                this.deleteButtons[idx].node.active = true;
            }
            if (this.startgameButtons[idx] && this.startgameButtons[idx].node) {
                this.startgameButtons[idx].node.active = true;
            }
        }
    }
    
    hideAllSlotButtons() {
        this.showBtnSlot = -1;
        this.deleteButtons.forEach(btn => {
            if (btn && btn.node) {
                btn.node.active = false;
            }
        });
        this.startgameButtons.forEach(btn => {
            if (btn && btn.node) {
                btn.node.active = false;
            }
        });
        this.createButtons.forEach(btn => {
            if (btn && btn.node) {
                btn.node.active = false;
            }
        });
    }

    onCharacterInfo(data: any) {
        console.log('📥 收到角色信息响应:', data);
        
        // 对于失败响应（如 408/503），只做最小处理：不参与 request_id 严格匹配与 UI 覆盖
        // 避免出现 “request_id 在映射中不存在” 的噪音，以及错误数据把界面抹掉
        if (data && data.success === false) {
            return;
        }

        // 关键修复：确保 requestIdToSlotIndex 已初始化
        if (!this.requestIdToSlotIndex) {
            this.requestIdToSlotIndex = {};
        }
        
        // 兼容标准格式（data字段）和直接格式
        if (data && data.success && data.data && typeof data.data === 'object') {
            data = { ...data, ...data.data };
        }
        let slotIndex = this.selectedIndex;

        // 优先使用服务端返回的 slot_index，避免在重试/重复响应时退回 selectedIndex 导致错位覆盖
        if (data && data.slot_index !== undefined && data.slot_index !== null) {
            const parsedSlot = parseInt(String(data.slot_index), 10);
            if (!isNaN(parsedSlot)) {
                slotIndex = parsedSlot;
            }
        }
        
        // 关键修复：添加更严格的检查，避免访问 null 对象
        const requestId = data?.request_id;
        if (requestId && this.requestIdToSlotIndex && typeof this.requestIdToSlotIndex === 'object') {
            const mappedSlot = this.requestIdToSlotIndex[requestId];
            if (mappedSlot !== undefined) {
                slotIndex = mappedSlot;
                delete this.requestIdToSlotIndex[requestId];
                console.log(`✅ 通过request_id匹配到槽位: ${slotIndex}`);
            } else {
                // 映射缺失通常是超时重试/重复响应导致；此时改用服务端 slot_index，避免 UI 被错槽位覆盖
                console.warn(`⚠️ request_id ${requestId} 在映射中不存在，使用返回的 slot_index: ${slotIndex}`);
            }
        } else if (data?.slot_index === undefined) {
            console.warn('⚠️ 无法确定槽位索引，使用当前选中槽位:', slotIndex);
        }
        
        // 防御：roleSlots 可能在绑定丢失时为 null，避免读取 length 抛异常
        if (!this.roleSlots || this.roleSlots.length === 0) {
            // 这里更多是初始化时序问题或临时未绑定状态，将错误降级为警告，避免在控制台刷红
            console.warn('⚠️ onCharacterInfo: roleSlots 为空或未绑定（多半是初始化时机问题），请仅在确实未绑定时关注此日志');
            return;
        }

        if (slotIndex < 0 || slotIndex >= this.roleSlots.length) {
            console.error(`❌ 槽位索引超出范围: ${slotIndex}, 总槽位数: ${this.roleSlots.length}`);
            return;
        }
        
        console.log(`✅ 处理槽位 ${slotIndex} 的角色信息`);
        
        const slotNode = this.roleSlots[slotIndex];
        if (!slotNode) return;
        
        // 修复：保留原有数据中的 user_id / character_id / 形象字段，避免服务器推送部分字段时把已有形象“抹掉”
        const existingData = this.slotRoleData[slotIndex] || {};
        this.slotRoleData[slotIndex] = {
            ...existingData,  // 保留原有数据
            ...data,          // 用新数据覆盖
            // 确保关键字段存在（如果新数据中没有，使用原有数据）
            user_id: data.user_id || existingData.user_id,
            character_id: data.character_id || existingData.character_id,
            Sprite: data.Sprite ?? existingData.Sprite,
            role_name: data.role_name ?? existingData.role_name,
            slot_index: slotIndex  // 确保slot_index正确
        };
        const mergedData = this.slotRoleData[slotIndex];
        
        // 设置精灵图片（修复：基于合并后的 mergedData 判断，避免部分字段推送导致误判为空槽位）
        const characterSpriteNode = slotNode.getChildByName('Sprite');
        if (characterSpriteNode) {
            const characterSprite = characterSpriteNode.getComponent(Sprite);
            if (characterSprite) {
                // 更严格的判断：只有当明确是空槽位时才隐藏精灵
                const isEmptySlot = (
                    !mergedData.role_name || 
                    mergedData.role_name === 0 || 
                    mergedData.role_name === '0' || 
                    mergedData.role_name === '' ||
                    !mergedData.Sprite || 
                    mergedData.Sprite === 0 || 
                    mergedData.Sprite === '0'
                );
                
                if (isEmptySlot) {
                    // 空槽位：隐藏精灵
                    characterSprite.spriteFrame = null;
                    characterSpriteNode.active = false;
                } else {
                    // 有角色：显示精灵（使用合并后的 Sprite 索引）
                    const spriteValue = parseInt(String(mergedData.Sprite), 10);
                    if (!isNaN(spriteValue) && spriteValue > 0 && this.characterSprites && this.characterSprites[spriteValue - 1]) {
                        characterSprite.spriteFrame = this.characterSprites[spriteValue - 1];
                        characterSpriteNode.active = true;
                        console.log(`✅ 槽位 ${slotIndex} 设置精灵: Sprite=${spriteValue}`);
                    } else {
                        console.warn(`⚠️ 槽位 ${slotIndex} 精灵索引无效: Sprite=${mergedData.Sprite}, spriteValue=${spriteValue}`);
                        // 如果精灵索引无效，但角色名存在，保留精灵显示（可能是数据不完整）
                        if (mergedData.role_name && mergedData.role_name !== '0' && mergedData.role_name !== 0) {
                            console.log(`ℹ️ 保留槽位 ${slotIndex} 的精灵显示（角色名存在但精灵索引无效）`);
                        } else {
                            characterSprite.spriteFrame = null;
                            characterSpriteNode.active = false;
                        }
                    }
                }
            }
        }
        
        // 只更新当前选中槽位的 label（同样基于合并后的 mergedData）
        if (slotIndex === this.selectedIndex) {
            if (mergedData.role_name === 0 || mergedData.role_name === '0' || !mergedData.role_name) {
                this.setLabelsActive(false);
            } else {
                if (this.roleNameLabel) this.roleNameLabel.string = mergedData.role_name;
                if (this.goldLabel) this.goldLabel.string = mergedData.gold != null ? String(mergedData.gold) : '';
                if (this.levelLabel) this.levelLabel.string = mergedData.level != null ? String(mergedData.level) : '';
                if (this.energyBlocksLabel) this.energyBlocksLabel.string = String(getEnergyBlocksFromPayload(mergedData));
                if (this.allianceLabel) this.allianceLabel.string = mergedData.alliance || '';
                if (this.recordLabel) this.recordLabel.string = mergedData.record || '';
                if (this.robotcountLabel) this.robotcountLabel.string = mergedData.robotcount != null ? String(mergedData.robotcount) : '';
                if (this.positionLabel) this.positionLabel.string = this.formatPositionForLabel(mergedData.position);
                if (this.rankLabel) this.rankLabel.string = mergedData.rank || '';
                this.setLabelsActive(true);
            }
        }
    }

    onDeleteClick(idx: number) {
        if (this.deleteonfirm) this.deleteonfirm.active = true;
        this.pendingDeleteSlot = idx;
    }
    
    onOkDelete() {
        // 修复点：删除确认增加防抖，避免高频点击导致多次删除请求
        if (this.isDeleting) {
            return;
        }
        if (!this.wsManager) return;
        
        const idx = this.pendingDeleteSlot;
        const data = this.slotRoleData[idx];
        if (!data) return;
        
        this.isDeleting = true;
        if (this.okButton && this.okButton.node) {
            this.okButton.interactable = false;
        }
        
        const requestId = `delete_char_${Date.now()}_${idx}`;
        this.wsManager.request(
            'delete_character',
            {
                slot_index: idx,
                request_id: requestId
            },
            (response: any) => {
                // delete_character_response 没有数据，直接处理
                this.onDeleteCharacterResponse(response);
            },
            true,
            10000
        );
    }
    
    onDeleteCharacterResponse(data: any) {
        // 修复点：无论成功失败都重置删除状态，防止按钮长时间不可用
        this.isDeleting = false;
        if (this.okButton && this.okButton.node) {
            this.okButton.interactable = true;
        }
        
        if (data.success) {
            if (this.deleteonfirm) this.deleteonfirm.active = false;
            this.refreshAllSlots();
            this.hideAllSlotButtons(); // 删除后立即隐藏按钮
        } else {
            console.error('删除角色失败:', data.message);
        }
    }

    // 处理服务器推送的机甲数量更新
    /**
     * 处理认证响应
     * 认证成功后加载角色数据
     */
    private onAuthResponse = (data: any): void => {
        console.log('📥 收到认证响应:', data);
        if (data.success) {
            console.log('✅ 认证成功，立即加载角色数据（会话态已在 WebSocketManager 中更新）');
            if (this.staleSessionFallbackTimer) {
                clearTimeout(this.staleSessionFallbackTimer);
                this.staleSessionFallbackTimer = null;
            }
            // 认证既已成功，取消初始化阶段「假定会话」的延迟回调，减少重复拉列表
            this.clearInitOneShotTimers();
            // 重要：hasLoadedCharacters 只在批量响应成功后置 true；此处禁止假置 true，
            // 否则从游戏返回时若误标已加载，会跳过 refresh，界面一直空白。
            console.log('🔄 认证成功后刷新所有槽位');
            this.refreshAllSlots();
        } else {
            console.error('❌ 认证失败:', data?.message, 'code:', data?.code);
            console.warn('⚠️ 认证失败，无法加载角色数据');

            // 安全阀闭环：如果服务端判定离线/未鉴权过久，需要重登
            if (data?.code === 401) {
                try { this.wsManager?.clearAll(); } catch {}
                director.loadScene(GameConfig.SCENE_NAMES.LOGIN);
            }
        }
    };

    private onRobotCountUpdate(data: any): void {
        const slotIndex = typeof data.slot_index === 'number' ? data.slot_index : this.selectedIndex;
        if (slotIndex < 0 || slotIndex >= this.roleSlots.length) return;
        const existing = this.slotRoleData[slotIndex] || {};
        existing.robotcount = data.robotcount;
        this.slotRoleData[slotIndex] = existing;
        if (slotIndex === this.selectedIndex && this.robotcountLabel) {
            this.robotcountLabel.string = String(data.robotcount ?? '');
        }
    }

    // 创建角色成功回调
    onCreateCharacterSuccess(data: any) {
        console.log('📥 收到创建角色响应:', data);
        
        // 兼容标准格式和直接格式
        const resp = data.data || data;
        
        if (resp && resp.success) {
            if (this.createPanel) this.createPanel.active = false;
            this.hideAllSlotButtons(); // 创建后立即隐藏按钮
            
            // 获取创建成功的槽位索引
            const slotIndex = resp.slot_index !== undefined ? resp.slot_index : this.selectedIndex;
            console.log(`✅ 创建角色成功，槽位: ${slotIndex}`);
            
            // 立即刷新所有槽位（批量获取最新数据）
            // 不延迟，确保界面及时更新
            this.refreshAllSlots();
        } else {
            const errorMsg = resp?.message || resp?.error || data?.message || '未知错误';
            console.error('❌ 创建角色失败:', errorMsg);
            // 如果是因为槽位占用失败，刷新该槽位数据
            if (errorMsg.includes('槽位')) {
                const slotIndex = resp?.slot_index !== undefined ? resp.slot_index : this.selectedIndex;
                if (slotIndex >= 0 && slotIndex < this.roleSlots.length) {
                    console.log(`🔄 槽位占用，刷新槽位 ${slotIndex} 的数据`);
                    // 清空该槽位数据
                    this.slotRoleData[slotIndex] = {
                        slot_index: slotIndex,
                        role_name: '',
                        Sprite: 0
                    };
                    // 刷新所有槽位
                    setTimeout(() => {
                        this.refreshAllSlots();
                    }, 200);
                }
            }
        }
    }

    onCancelDelete() {
        if (this.deleteonfirm) this.deleteonfirm.active = false;
    }

    // 创建角色按钮点击事件
    onCreateClick(idx: number) {
        if (this.createPanel) {
            this.createPanel.active = true;
            // 使用正确的组件类名，而不是字符串
            const characterPanel = this.createPanel.getComponent(CharacterCreatePanel);
            if (characterPanel && typeof characterPanel.setSlotIndex === 'function') {
                characterPanel.setSlotIndex(idx);
            }
        }
    }

    setLabelsActive(active: boolean) {
        if (this.roleNameLabel && this.roleNameLabel.node) this.roleNameLabel.node.active = active;
        if (this.allianceLabel && this.allianceLabel.node) this.allianceLabel.node.active = active;
        if (this.goldLabel && this.goldLabel.node) this.goldLabel.node.active = active;
        if (this.energyBlocksLabel && this.energyBlocksLabel.node) this.energyBlocksLabel.node.active = active;
        if (this.levelLabel && this.levelLabel.node) this.levelLabel.node.active = active;
        if (this.recordLabel && this.recordLabel.node) this.recordLabel.node.active = active;
        if (this.robotcountLabel && this.robotcountLabel.node) this.robotcountLabel.node.active = active;
        if (this.positionLabel && this.positionLabel.node) this.positionLabel.node.active = active;
        if (this.rankLabel && this.rankLabel.node) this.rankLabel.node.active = active;
    }

    /**
     * 处理选择角色响应
     */
    private onSelectCharacterResponse = (data: any): void => {
        console.log('📥 收到选择角色响应:', data);
        
        // 兼容多种响应格式：标准格式 { success: true, data: { character_id: ... } } 或直接格式 { success: true, character_id: ... }
        const success = data.success === true || data.success === 'true';
        const characterId = data.character_id || (data.data && data.data.character_id);
        
        if (success && this.pendingStartGameSlot >= 0) {
            const slotIndex = this.pendingStartGameSlot;
            const slotData = this.slotRoleData[slotIndex];
            
            // 清除超时定时器
            if (this.selectCharacterTimeout) {
                clearTimeout(this.selectCharacterTimeout);
                this.selectCharacterTimeout = null;
            }
            
        // 保存游戏ID（兼容多种响应格式）
            if (slotData && slotData.user_id && characterId) {
                this.wsManager.saveGameIds(slotData.user_id, characterId);
            }

            // 重置状态
            this.pendingStartGameSlot = -1;
            this.isStartingGame = false;
            
            // 关键修复：在选择角色成功后，预加载关键数据（背包、机甲列表等）
            // 这样进入游戏后，面板打开时可以立即显示缓存数据，提升用户体验
            this.preloadGameData(characterId);
            
            // 跳转到Game场景
        if (this.gameScenePreloaded) {
            setTimeout(() => {
                this.jumpToGameScene();
            }, 50);
            } else {
        this.waitJumpAfterPreload = true;
        if (!this.preloadingForJump) {
            this.preloadingForJump = true;
            director.preloadScene(GameConfig.SCENE_NAMES.GAME, () => {}, (error) => {
                this.preloadingForJump = false;
                if (!error) {
                    this.gameScenePreloaded = true;
                    if (this.waitJumpAfterPreload) {
                        this.waitJumpAfterPreload = false;
                        this.jumpToGameScene();
                    }
                } else {
                    console.error('❌ Game场景预加载失败:', error);
                    this.hideLoading();
                }
            });
        }
            }
        } else {
            // 选择失败，隐藏Loading并提示
            console.error('❌ 选择角色失败:', data.message || '未知错误');
            this.hideLoading();
            if (this.pendingStartGameSlot >= 0 && this.startgameButtons[this.pendingStartGameSlot]) {
                this.startgameButtons[this.pendingStartGameSlot].interactable = true;
            }
            this.pendingStartGameSlot = -1;
            this.isStartingGame = false;
            if (this.selectCharacterTimeout) {
                clearTimeout(this.selectCharacterTimeout);
                this.selectCharacterTimeout = null;
            }
        }
    };

    /**
     * 进入游戏按钮点击事件
     */
    onStartGameClick(idx: number) {
        // 修复点：进入游戏过程防抖，避免高频点击触发多次选择角色请求
        if (this.isStartingGame) {
            console.warn('⚠️ 正在进入游戏中，忽略重复点击');
            return;
        }
        const slotData = this.slotRoleData[idx];
        if (!this.wsManager) {
            console.error('❌ WebSocketManager不存在');
            return;
        }
        
        if (!slotData) {
            console.warn(`⚠️ 槽位 ${idx} 数据不存在，先请求数据`);
            this.requestSlotData(idx);
            // 延迟后重试（等待数据加载）
            setTimeout(() => {
                const retryData = this.slotRoleData[idx];
                if (retryData && retryData.user_id && retryData.character_id) {
                    this.onStartGameClick(idx);
                } else {
                    console.error(`❌ 槽位 ${idx} 数据加载失败，无法进入游戏`);
                }
            }, 500);
            return;
        }
        
        const token = this.wsManager.getToken();
        if (!token) {
            console.error('❌ Token不存在');
            return;
        }
        
        // 检查关键数据
        if (!slotData.user_id || !slotData.character_id) {
            console.warn(`⚠️ 槽位 ${idx} 缺少关键数据，重新请求:`, {
                user_id: slotData.user_id,
                character_id: slotData.character_id
            });
            this.requestSlotData(idx);
            // 延迟后重试
            setTimeout(() => {
                const retryData = this.slotRoleData[idx];
                if (retryData && retryData.user_id && retryData.character_id) {
                    this.onStartGameClick(idx);
                } else {
                    console.error(`❌ 槽位 ${idx} 数据加载失败，无法进入游戏`);
                }
            }, 500);
            return;
        }
        
        // 修复点：标记开始进入游戏过程，并禁用当前槽位的开始按钮
        this.isStartingGame = true;
        if (this.startgameButtons[idx]) {
            this.startgameButtons[idx].interactable = false;
        }
        
        // 显示Loading面板（立即显示，给用户反馈）
        this.showLoading();
        
        // 设置待进入游戏的槽位
        this.pendingStartGameSlot = idx;
        
        // 通知服务器选择当前角色
        console.log(`🔄 发送选择角色请求: character_id=${slotData.character_id}`);
        const requestId = `select_char_${Date.now()}_${idx}`;
        this.wsManager.request(
            'select_character',
            {
                character_id: slotData.character_id,
                slot_index: idx,
                request_id: requestId
            },
            (response: any) => {
                this.onSelectCharacterResponse(response);
            },
            true,
            10000
        );
        
        // 与上方 request(..., 10000) 对齐：客户端略长 2s，避免网络抖动误杀
        this.selectCharacterTimeout = setTimeout(() => {
            console.error('❌ 选择角色超时（12秒）');
            this.hideLoading();
            this.pendingStartGameSlot = -1;
            this.selectCharacterTimeout = null;
            // 修复点：超时后恢复开始游戏状态，允许玩家重新尝试
            this.isStartingGame = false;
            if (this.startgameButtons[idx]) {
                this.startgameButtons[idx].interactable = true;
            }
        }, 12000);
    }

    /**
     * 预加载游戏数据（选择角色成功后调用）
     * MMO最佳实践：预加载关键数据，面板打开时先显示缓存再更新最新数据
     */
    private preloadGameData(characterId: string): void {
        if (!characterId || !this.wsManager) {
            return;
        }

        // 关键修复：预加载 RobotShow 的资源，减少装备图显示延迟
        RobotShow.preloadResources();

        const cacheManager = DataCacheManager.getInstance();
        console.log(`🔄 [CharacterSelect] 开始预加载游戏数据 (character_id: ${characterId})`);

        // 预加载背包数据
        this.wsManager.request(
            GameConfig.MESSAGE_TYPES.BAG_GET,
            {
                character_id: characterId,
                category: 1, // 默认加载第一个分类
                page: 1,
                page_size: 60,
                bag_version: 0 // 首次加载，版本号为0
            },
            (response: any) => {
                if (response && response.success) {
                    cacheManager.setBagCache(characterId, response);
                    console.log(`✅ [CharacterSelect] 背包数据预加载完成`);
                }
            },
            true,
            20000
        );

        // 预加载机甲列表数据（第一页）
        this.wsManager.request(
            GameConfig.MESSAGE_TYPES.GET_ROBOT_PETS,
            {
                character_id: characterId,
                page: 0,
                page_size: 50
            },
            (response: any) => {
                if (response && response.success) {
                    cacheManager.setRobotPetsCache(characterId, response);
                    console.log(`✅ [CharacterSelect] 机甲列表数据预加载完成`);
                }
            },
            true,
            20000
        );
    }

    /**
     * 跳转到Game场景
     */
    private jumpToGameScene(): void {
        console.log('🔄 开始跳转到Game场景...');
        director.loadScene(GameConfig.SCENE_NAMES.GAME, (error) => {
            // 场景加载完成后隐藏Loading（如果还在CharacterSelect场景）
            if (this.loadingNode) {
                this.loadingNode.active = false;
            }
            
            if (error) {
                console.error('❌ 跳转到Game场景失败:', error);
            } else {
                console.log('✅ 跳转到Game场景成功');
            }
        });
    }

    /**
     * 处理场景跳转错误
     */
    private handleSceneJumpError(): void {
        console.log('🔄 尝试跳转回角色选择场景');
        
        // 减少延迟时间
        setTimeout(() => {
            director.loadScene(GameConfig.SCENE_NAMES.CHARACTER_SELECT, (error) => {
                if (error) {
                    console.error('❌ 跳转回角色选择场景失败:', error);
                } else {
                    console.log('✅ 跳转回角色选择场景成功');
                }
            });
        }, 1000); // 从2000ms减少到1000ms
    }

    onDestroy() {
        // 清理事件监听
        if (this.wsManager) {
            try {
                this.wsManager.off('character_info_response', this.onCharacterInfo, this);
                this.wsManager.off('all_characters_response', this.onAllCharactersResponse, this); // 恢复清理
                this.wsManager.off('delete_character_response', this.onDeleteCharacterResponse, this);
                this.wsManager.off('robotcount_update', this.onRobotCountUpdate, this);
                this.wsManager.off('create_character_response', this.onCreateCharacterSuccess, this);
                // 注意：不再监听 select_character_response 事件，所以不需要移除
                // this.wsManager.off('select_character_response', this.onSelectCharacterResponse, this);
                this.wsManager.off('auth_response', this.onAuthResponse, this);
            } catch (error) {
                console.warn('⚠️ 清理事件监听时出错:', error);
            }
        }
        
        // 清除超时定时器
        if (this.selectCharacterTimeout) {
            clearTimeout(this.selectCharacterTimeout);
            this.selectCharacterTimeout = null;
        }
        
        if (this.slotDataFallbackTimer) {
            clearTimeout(this.slotDataFallbackTimer);
            this.slotDataFallbackTimer = null;
        }
        
        if (this.staleSessionFallbackTimer) {
            clearTimeout(this.staleSessionFallbackTimer);
            this.staleSessionFallbackTimer = null;
        }
        
        this.clearInitOneShotTimers();
        
        // 清理数据
        this.requestIdToSlotIndex = {};
        this.slotRoleData = [];
    }
}
