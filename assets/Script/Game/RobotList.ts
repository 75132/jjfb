import {
    _decorator,
    Component,
    Node,
    Button,
    Label,
    ScrollView,
    instantiate,
    UITransform,
    Color,
    Sprite,
    SpriteAtlas,
    SpriteFrame,
} from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import { DataCacheManager } from '../global/DataCacheManager';
import { UILockManager } from '../global/UILockManager';
import { emitBattleTeamUpdated, emitRobotDataUpdated, robotGameEvents, RobotGameEvent } from '../global/RobotGameEvents';

const { ccclass, property } = _decorator;

/** 机甲列表面板：成熟方案，单入口加载、request 串行、按钮统一 Button.CLICK、行级 Set 面板 */
@ccclass('RobotList')
export class RobotList extends Component {
    @property(Node)
    backButton: Node | null = null;
    
    @property(Node)
    confirmButton: Node | null = null;
    
    @property(Node)
    robotPanel: Node | null = null;
    
    @property(Node)
    robotListDataTemplate: Node | null = null;
    
    @property(ScrollView)
    scrollView: ScrollView | null = null;
    
    @property(Node)
    content: Node | null = null;
    
    private ws: WebSocketManager | null = null;
    private readonly ITEM_HEIGHT = 46;
    private readonly ITEM_SPACING = 5;
    private readonly PAGE_SIZE = 50;
    private readonly MAX_BATTLE_TEAM = 1;

    private listItems: Node[] = [];
    private currentPets: any[] = [];
    private battleTeam: string[] = [];
    private battleTeamVersion: number = 0;
    /** 已从服务端拿到过 team_version 后才随 set_battle_team 发送，避免默认 0 触发 TEAM_VERSION_MISMATCH */
    private _battleTeamVersionSeeded = false;
    /** 版本冲突后仅自动重拉并重试一次 */
    private _setBattleTeamVersionRetryPending = false;
    /** 单次用户操作内：409 后只自动重试一轮 set_battle_team */
    private _didRetrySetBattleTeamAfterVersionMismatch = false;
    private selectedIndex = -1;
    private selectedPet: any = null;
    private selectedNode: Node | null = null;
    private bgColorMap: Map<Node, Color> = new Map();

    private isLoading = false;
    /** 本轮加载是否已收到出战队伍，用于并行请求后“两者齐再渲染” */
    private _battleTeamReceived = false;
    /** 本轮加载是否已收到机甲列表（首页），用于并行请求后“两者齐再渲染” */
    private _petsReceived = false;
    private isFromBag = false;
    private openSetRow: Node | null = null;

    private confirmCb: ((petId: string, petData: any) => void) | null = null;
    private cancelCb: (() => void) | null = null;

    // MechaClass 图标兜底 SpriteFrame（避免 spriteAtlas 帧名不匹配导致一直显示 gedou）
    @property({ type: SpriteFrame })
    mechaIconGedou: SpriteFrame | null = null;
    @property({ type: SpriteFrame })
    mechaIconSheji: SpriteFrame | null = null;
    @property({ type: SpriteFrame })
    mechaIconQuanneng: SpriteFrame | null = null;

    private itemClickHandlers: Map<Node, () => void> = new Map();
    /** 修复点：确认/出战/放生防抖，避免高频点击重复请求 */
    private _confirming = false;
    private _submittingBattleTeam = false;
    private _releasing = false;
    /** 出战/下场入口防抖（毫秒），与 UILockManager 互补 */
    private _lastDeployClickMs = 0;
    /** 旧服未带 battle_team 时仅补拉一次 get_battle_team */
    private _fallbackBattleTeamRequested = false;

    /** 同角色首页 get_robot_pets 单飞，避免并发多笔导致服务端排队与 request_id 错乱 */
    private static _petsSfCid: string | null = null;
    private static _petsSfCallbacks: Array<(resp: any) => void> = [];

    /** 防抖：连续打开面板时合并为一轮网络请求 */
    private _debouncedNetworkLoad = (): void => {
        if (!UILockManager.instance.tryLock('robot_list', 22000)) {
            this.isLoading = false;
            return;
        }
        this._fallbackBattleTeamRequested = false;
        this.requestPets(0);
    };

    onLoad() {
        this.ws = WebSocketManager.getInstance();
    }
    
    start() {
        this.ensureTemplate();
        this.bindBackAndConfirm();
        this.subscribeMessages();
        robotGameEvents.on(RobotGameEvent.RobotDataUpdated, this.onExternalRobotDataSignal, this);
        robotGameEvents.on(RobotGameEvent.BattleTeamUpdated, this.onExternalRobotDataSignal, this);
    }

    /** 背包用道具 / 放生等成功后刷新列表（面板打开时） */
    private onExternalRobotDataSignal = (): void => {
        if (this.node?.active) {
            this.isLoading = false;
            this.loadBattleTeamThenPets(false);
        } else {
            this.forceRefresh();
        }
    };

    onDestroy() {
        robotGameEvents.off(RobotGameEvent.RobotDataUpdated, this.onExternalRobotDataSignal, this);
        robotGameEvents.off(RobotGameEvent.BattleTeamUpdated, this.onExternalRobotDataSignal, this);
        this.unsubscribeMessages();
        // 修复点：解绑 back/confirm 按钮，避免节点销毁后仍触发或内存泄漏
        if (this.backButton?.isValid) {
            const backBtn = this.backButton.getComponent(Button);
            if (backBtn?.node?.isValid) {
                backBtn.node.off(Button.EventType.CLICK, this.onBack, this);
            }
        }
        if (this.confirmButton?.isValid) {
            const confirmBtn = this.confirmButton.getComponent(Button);
            if (confirmBtn?.node?.isValid) {
                confirmBtn.node.off(Button.EventType.CLICK, this.onConfirm, this);
            }
        }
    }

    onEnable() {
        // 仅当节点激活、列表为空且未在加载时补拉一次（避免与 show 重复触发）
        if (this.node?.active && this.currentPets.length === 0 && !this.isLoading) {
            this.loadBattleTeamThenPets(true);
        }
    }

    onDisable() {
        UILockManager.instance.unlock('robot_list');
        this.closeAllSetPanels();
        this.clearSelection();
        this.isFromBag = false;
    }

    private ensureTemplate() {
        if (!this.robotListDataTemplate || !this.content) return;
        if (this.robotListDataTemplate.parent !== this.content) {
            this.robotListDataTemplate.removeFromParent();
            this.content.addChild(this.robotListDataTemplate);
        }
    }

    private bindBackAndConfirm() {
        const backBtn = this.backButton?.getComponent(Button);
        if (backBtn) {
            backBtn.node.off(Button.EventType.CLICK, this.onBack, this);
            backBtn.node.on(Button.EventType.CLICK, this.onBack, this);
            backBtn.interactable = true;
        }
        const confirmBtn = this.confirmButton?.getComponent(Button);
        if (confirmBtn) {
            confirmBtn.node.off(Button.EventType.CLICK, this.onConfirm, this);
            confirmBtn.node.on(Button.EventType.CLICK, this.onConfirm, this);
            confirmBtn.interactable = true;
            this.confirmButton!.active = false;
        }
    }

    private subscribeMessages() {
        if (!this.ws) return;
        this.ws.on(GameConfig.MESSAGE_TYPES.ROBOT_PETS_RESPONSE, this.onPetsResponse, this);
        this.ws.on(GameConfig.MESSAGE_TYPES.ROBOT_PETS_UPDATE, this.onPetsResponse, this);
        this.ws.on(GameConfig.MESSAGE_TYPES.BATTLE_TEAM_UPDATE, this.onBattleTeamUpdate, this);
        // 关键修复：监听角色切换事件，清除内部状态
        this.ws.on('data_changed', this.onCharacterChanged, this);
    }

    private unsubscribeMessages() {
        if (!this.ws) return;
        this.ws.off(GameConfig.MESSAGE_TYPES.ROBOT_PETS_RESPONSE, this.onPetsResponse, this);
        this.ws.off(GameConfig.MESSAGE_TYPES.ROBOT_PETS_UPDATE, this.onPetsResponse, this);
        this.ws.off(GameConfig.MESSAGE_TYPES.BATTLE_TEAM_UPDATE, this.onBattleTeamUpdate, this);
        // 关键修复：取消监听角色切换事件
        this.ws.off('data_changed', this.onCharacterChanged, this);
    }

    /**
     * 处理角色切换事件（清除内部状态）
     */
    private onCharacterChanged = (data: any): void => {
        if (data && data.reason === 'character_id_cleared') {
            console.log('🗑️ [RobotList] 检测到角色切换，清除内部状态');
            // 清除所有内部状态
            this.currentPets = [];
            this.battleTeam = [];
            this.selectedIndex = -1;
            this.selectedPet = null;
            this.selectedNode = null;
            this.bgColorMap.clear();
            this.isLoading = false;
            this._battleTeamReceived = false;
            this._petsReceived = false;
            this.isFromBag = false;
            this.resetBattleTeamVersionState();
            this._didRetrySetBattleTeamAfterVersionMismatch = false;
            // 清空渲染
            if (this.node && this.node.active) {
                this.renderList([]);
            }
            UILockManager.instance.unlock('robot_list');
        }
    };

    private onBattleTeamUpdate(data: any) {
        if (!data?.success) return;
        const raw = data.battle_team ?? data.data?.battle_team ?? [];
        this.battleTeam = (Array.isArray(raw) ? raw : []).map((x: any) => String(x).trim().toLowerCase()).filter(Boolean);
        this.applyServerTeamVersion(data);
        if (this.node?.active && this.currentPets.length > 0) this.refreshListUI();
    }

    /** 唯一入口：打开并加载（优化：先显示缓存，再后台更新） */
    public show(fromBag = false) {
        if (!this.node) return;
        // 修复点：非背包入口时清除 Bag 回调，避免从主菜单打开时误触发上次的 confirmCb（使用物品）
        if (!fromBag) this.clearCallbacks();
        else if (!this.confirmCb) this.clearCallbacks();
        this._confirming = false;
        this._submittingBattleTeam = false;
        this._releasing = false;
        this._didRetrySetBattleTeamAfterVersionMismatch = false;
        this.node.active = true;
        this.isFromBag = fromBag;
        if (this.robotListDataTemplate) this.robotListDataTemplate.active = true;
        this.updateConfirmVisibility();

        if (!this.ws) this.ws = WebSocketManager.getInstance();
        if (!this.ws) return;

        this.ensureTemplate();
        this.clearAdditionalItems();
        
        // 重置状态
        this.selectedIndex = -1;
        this.selectedPet = null;
        this.selectedNode = null;
        this.bgColorMap.clear();
        this.isLoading = false;

        // 关键修复：先加载 battleTeam，确保排序和滤镜正确
        // 即使有缓存数据，也要等 battleTeam 加载完成后再渲染，确保排序和滤镜正确
        this.loadBattleTeamThenPets(true); // 传入 true 表示需要等待 battleTeam 后再渲染缓存
    }

    /** 隐藏（reason 仅兼容旧调用，可忽略） */
    public hide(_reason?: string) {
        if (!this.node) return;
        this.closeAllSetPanels();
        this.clearSelection();
        this.isFromBag = false;
        this._confirming = false;
        this._submittingBattleTeam = false;
        this._releasing = false;
        const confirmBtn = this.confirmButton?.getComponent(Button);
        if (confirmBtn) confirmBtn.interactable = true;
        this.setDeployReleaseButtonsInteractable(true);
        this.node.active = false;
    }
    
    public setCallbacks(onConfirm: (petId: string, petData: any) => void, onCancel?: () => void) {
        this.confirmCb = onConfirm;
        this.cancelCb = onCancel ?? null;
    }

    public clearCallbacks() {
        this.confirmCb = null;
        this.cancelCb = null;
    }

    public forceRefresh() {
        if (!this.ws) return;
        // 关键修复：即使节点未激活也允许刷新（为下次打开做准备）
        this.isLoading = false;
        this.currentPets = [];
        this.battleTeam = [];
        this.resetBattleTeamVersionState();
        this.loadBattleTeamThenPets();
    }

    public getBattleTeam(): string[] {
        return [...this.battleTeam];
    }

    /** 背包选宠等：校验 petId 是否在当前已拉取的列表中（仅客户端提示，权威以服务端为准） */
    public isPetInCurrentList(petId: string): boolean {
        const n = this.normPetId(petId);
        if (!n) return false;
        return this.currentPets.some((p) => this.normPetId(String(p.pet_id ?? p._id ?? p.id ?? '')) === n);
    }

    /**
     * 出战与列表都就绪时只渲染一次，避免「先错后对」和重复渲染。
     * 由 GET_BATTLE_TEAM 回调和 onPetsResponse 在收到数据后调用。
     */
    private tryRenderIfReady() {
        if (!this._battleTeamReceived || !this._petsReceived || !this.node?.active) return;
        this.sortByBattleTeam();
        this.selectedIndex = -1;
        this.selectedPet = null;
        this.selectedNode = null;
        this.renderList(this.currentPets);
        this.isLoading = false;
        UILockManager.instance.unlock('robot_list');
    }

    private loadBattleTeamThenPets(useCacheIfAvailable: boolean = false) {
        if (!this.ws) return;
        const cid = this.ws.getCharacterId();
        if (!cid) {
            this.battleTeam = [];
            this._battleTeamReceived = true;
            this._petsReceived = true;
            this.currentPets = [];
            this.isLoading = false;
            if (this.node?.active) this.renderList([]);
            return;
        }
        if (this.isLoading) return;
        this.isLoading = true;
        this._battleTeamReceived = false;
        this._petsReceived = false;
        this.currentPets = [];

        const cache = DataCacheManager.getInstance();
        const cachedData = cache.getRobotPetsCache(cid);
        const hasFullCache =
            useCacheIfAvailable &&
            cachedData?.pets &&
            Array.isArray(cachedData.pets) &&
            cachedData.pets.length > 0 &&
            Array.isArray(cachedData.battle_team);

        if (hasFullCache) {
            this.battleTeam = (cachedData!.battle_team as any[]).map((x: any) => String(x).trim().toLowerCase()).filter(Boolean);
            this.currentPets = cachedData!.pets;
            this.applyServerTeamVersion(cachedData);
            this._battleTeamReceived = true;
            this._petsReceived = true;
            this.tryRenderIfReady();
            // 不 return：缓存里 battle_team 可能落后于服务端（出战/下场/战斗自动上场等），必须再拉一页对齐排序与出战滤镜
        }

        this.unschedule(this._debouncedNetworkLoad);
        this.scheduleOnce(this._debouncedNetworkLoad, 0.12);
    }

    private requestPets(page: number = 0) {
        if (!this.ws) return;
        const cid = this.ws.getCharacterId();
        if (!cid) return;

        // 关键修复：即使 isLoading=true 也允许请求（show() 时已重置，但防止其他情况）
        // 使用 request 而不是 notify，确保响应匹配和超时处理
        this.isLoading = true;
        const req: any = { character_id: cid, page, page_size: this.PAGE_SIZE };
        const uid = this.ws.getUserId();
        if (uid) req.user_id = uid;

        const timeoutMs = 18000;
        const deliver = (resp: any) => {
            const cbs = RobotList._petsSfCallbacks.splice(0);
            RobotList._petsSfCid = null;
            for (const cb of cbs) {
                try {
                    cb(resp);
                } catch (e) {
                    console.error('[RobotList] onPetsResponse fan-out', e);
                }
            }
        };

        if (page === 0) {
            if (RobotList._petsSfCid === cid && RobotList._petsSfCallbacks.length > 0) {
                RobotList._petsSfCallbacks.push((resp: any) => this.onPetsResponse(resp));
                return;
            }
            RobotList._petsSfCid = cid;
            RobotList._petsSfCallbacks = [(resp: any) => this.onPetsResponse(resp)];
            this.ws.request(
                GameConfig.MESSAGE_TYPES.GET_ROBOT_PETS,
                req,
                (resp: any) => deliver(resp),
                true,
                timeoutMs
            );
            return;
        }

        this.ws.request(
            GameConfig.MESSAGE_TYPES.GET_ROBOT_PETS,
            req,
            (resp: any) => this.onPetsResponse(resp),
            true,
            timeoutMs
        );
    }

    private onPetsResponse(data: any) {
        const isUpdate = data?.type === GameConfig.MESSAGE_TYPES.ROBOT_PETS_UPDATE;
        if (isUpdate) {
            UILockManager.instance.unlock('robot_list');
            this.currentPets = [];
            this._petsReceived = false;
            this.requestPets(0);
            return;
        }

        const ok = data?.success === true || data?.success === 'true';
        if (!ok) {
            UILockManager.instance.unlock('robot_list');
            this.isLoading = false;
            const cidFail = this.ws?.getCharacterId();
            const stale = cidFail ? DataCacheManager.getInstance().getRobotPetsCache(cidFail) : null;
            if (stale?.pets?.length && this.node?.active) {
                this.currentPets = stale.pets;
                this.applyServerTeamVersion(stale);
                if (Array.isArray(stale.battle_team)) {
                    this.battleTeam = (stale.battle_team as any[])
                        .map((x: any) => String(x).trim().toLowerCase())
                        .filter(Boolean);
                    this._battleTeamReceived = true;
                } else {
                    this._battleTeamReceived = false;
                }
                this._petsReceived = true;
                if (!this._battleTeamReceived && this.ws && cidFail && !this._fallbackBattleTeamRequested) {
                    this._fallbackBattleTeamRequested = true;
                    this.ws.request(
                        GameConfig.MESSAGE_TYPES.GET_BATTLE_TEAM,
                        { character_id: cidFail },
                        (resp: any) => {
                            const raw = resp?.data?.battle_team ?? resp?.battle_team;
                            this.battleTeam = (Array.isArray(raw) ? raw : [])
                                .map((x: any) => String(x).trim().toLowerCase())
                                .filter(Boolean);
                            this.applyServerTeamVersion(resp);
                            this._battleTeamReceived = true;
                            this.tryRenderIfReady();
                        },
                        true,
                        6000
                    );
                }
                this.tryRenderIfReady();
                return;
            }
            this.currentPets = [];
            this._petsReceived = true;
            this._battleTeamReceived = true;
            this.battleTeam = [];
            if (this.node?.active) this.renderList([]);
            return;
        }

        let pets: any[] = [];
        if (Array.isArray(data.pets)) pets = data.pets;
        else if (data?.data?.pets) pets = data.data.pets;

        // 单一数据源：若响应携带 battle_team/team_version，则优先使用并标记已就绪
        const bt = data.battle_team ?? data.data?.battle_team;
        if (Array.isArray(bt)) {
            this.battleTeam = bt.map((x: any) => String(x).trim().toLowerCase()).filter(Boolean);
            this._battleTeamReceived = true;
        }
        this.applyServerTeamVersion(data);

        const pagination = data.pagination ?? data.data?.pagination;
        const page = pagination?.page ?? 0;

        if (page === 0 && !Array.isArray(bt) && this.ws && !this._fallbackBattleTeamRequested) {
            this._fallbackBattleTeamRequested = true;
            const cid0 = this.ws.getCharacterId();
            if (cid0) {
                this.ws.request(
                    GameConfig.MESSAGE_TYPES.GET_BATTLE_TEAM,
                    { character_id: cid0 },
                    (resp: any) => {
                        const raw = resp?.data?.battle_team ?? resp?.battle_team;
                        this.battleTeam = (Array.isArray(raw) ? raw : [])
                            .map((x: any) => String(x).trim().toLowerCase())
                            .filter(Boolean);
                        this.applyServerTeamVersion(resp);
                        this._battleTeamReceived = true;
                        this.tryRenderIfReady();
                    },
                    true,
                    6000
                );
            }
        }

        const hasMore = !!pagination?.has_more;

        if (page === 0) {
            this.currentPets = pets;
            this._petsReceived = true;
        } else {
            this.currentPets = [...this.currentPets, ...pets];
        }

        if (page === 0) {
            const cid = this.ws?.getCharacterId();
            if (cid) {
                const cache = DataCacheManager.getInstance();
                cache.setRobotPetsCache(cid, { ...data, battle_team: this.battleTeam });
            }
        }

        // 统一经 tryRenderIfReady 渲染，只在出战+列表都就绪时渲染一次，避免首次“出战0个”
        this.tryRenderIfReady();

        if (hasMore && this.ws) {
            const cid = this.ws.getCharacterId();
            if (cid) {
                const req: any = { character_id: cid, page: page + 1, page_size: this.PAGE_SIZE };
                const uid = this.ws.getUserId();
                if (uid) req.user_id = uid;
                this.requestPets(page + 1);
            }
        }
    }

    private sortByBattleTeam() {
        if (!this.currentPets.length) return;
        
        // 关键修复：确保出战机甲排在前面，按出战顺序排序
        const inTeam: Array<{ pet: any; order: number }> = [];
        const rest: any[] = [];
        
        // 分离出战和非出战机甲（用规范化 id 比较，与 battleTeam 小写存储一致）
        for (const p of this.currentPets) {
            const id = this.normPetId(String(p.pet_id ?? p._id ?? p.id ?? ''));
            const battleIndex = this.battleTeam.findIndex(bid => this.normPetId(bid) === id);
            if (battleIndex >= 0) {
                // 在出战队伍中，记录顺序
                inTeam.push({ pet: p, order: battleIndex });
            } else {
                // 不在出战队伍中
                rest.push(p);
            }
        }
        
        // 按出战顺序排序（主战在前，副战在后）
        inTeam.sort((a, b) => a.order - b.order);
        
        // 关键修复：合并列表，出战机甲在前，其他在后
        this.currentPets = [
            ...inTeam.map(item => item.pet),
            ...rest
        ];
        
        console.log(`[RobotList] 排序完成: 出战${inTeam.length}个, 其他${rest.length}个, 出战队伍:`, this.battleTeam);
    }

    private refreshListUI() {
        const sid = this.selectedPet
            ? this.normPetId(String(this.selectedPet.pet_id ?? this.selectedPet._id ?? this.selectedPet.id ?? ''))
            : '';
        this.sortByBattleTeam();
        this.bgColorMap.clear();
        this.renderList(this.currentPets);
        if (sid) {
            const idx = this.currentPets.findIndex(
                (p) => this.normPetId(String(p.pet_id ?? p._id ?? p.id ?? '')) === sid
            );
            if (idx >= 0) {
                const node =
                    idx === 0 ? this.robotListDataTemplate : idx > 0 && idx - 1 < this.listItems.length
                        ? this.listItems[idx - 1]
                        : null;
                if (node?.isValid) this.onRowClick(node, idx);
            }
        }
    }

    private renderList(pets: any[]) {
        if (!this.content || !this.robotListDataTemplate) return;

        this.clearSelection();
        this.closeAllSetPanels();
        
        if (pets.length === 0) {
                this.robotListDataTemplate.active = false;
            this.clearAdditionalItems();
            this.updateContentHeight(0);
            return;
        }
        
        this.ensureTemplate();
        const firstY = this.robotListDataTemplate.position.y;

        for (let i = 0; i < this.listItems.length; i++) {
            const n = this.listItems[i];
            if (n?.isValid) {
                this.setRowSelection(n, false);
                this.closeSetForRow(n);
                n.active = false;
            }
        }

        for (let i = 0; i < pets.length; i++) {
            const pet = pets[i];
            const node = i === 0 ? this.robotListDataTemplate! : this.getOrCreateRow(i, firstY);
            if (!node) continue;
            node.active = true;
            this.fillRow(node, pet, i);
            this.setRowLayout(node, i, firstY);
            this.bindRowClick(node, i);
            this.bindSetAndActions(node, pet, i);
            // 关键修复：先更新滤镜，再设置未选中状态（确保红色滤镜不被覆盖）
            this.updateRowBattleFilter(node, pet); // 先应用红色滤镜
            this.setRowSelection(node, false); // 再设置未选中状态（不会覆盖已应用的滤镜）
            this.updateSetVisibility(node);
            if (node.parent !== this.content) this.content.addChild(node);
        }

        const hideFrom = pets.length <= 1 ? 0 : pets.length - 1;
        for (let i = hideFrom; i < this.listItems.length; i++) {
            const n = this.listItems[i];
            if (n?.isValid) {
                this.setRowSelection(n, false);
                this.closeSetForRow(n);
                n.active = false;
            }
        }

        this.updateContentHeight(pets.length, firstY);
        this.updateConfirmVisibility();
    }

    /** P1 性能：首行 template + listItems 复用，避免每次打开都全量 instantiate。 */
    private getOrCreateRow(index: number, firstY: number): Node | null {
        const i = index - 1;
        if (i >= 0 && i < this.listItems.length && this.listItems[i].isValid) {
            return this.listItems[i];
        }
        if (!this.robotListDataTemplate) return null;
        const node = instantiate(this.robotListDataTemplate);
        const y = firstY - index * (this.ITEM_HEIGHT + this.ITEM_SPACING);
        node.setPosition(node.position.x, y, node.position.z);
        while (this.listItems.length <= i) this.listItems.push(null!);
        this.listItems[i] = node;
        return node;
    }

    private fillRow(node: Node, pet: any, _index: number) {
        const id = String(pet.pet_id ?? pet._id ?? pet.id ?? '');
        const form = Number(pet.Form ?? pet.Fo ?? 0);
        const name = (pet.RobotName || '') + (form === 1 ? '|初' : form === 2 ? '|中' : form === 3 ? '|终' : '');
        const level = String(pet.Level ?? 1);
        const cls = Number(pet.Class ?? 1);
        // MechaClass 图标键：兼容两种常见命名方式
        // 1) spriteAtlas 帧名通常是文件名不带扩展名：sheji/quanneng/gedou
        // 2) 自动图集/单图有时帧名包含扩展名：sheji.png/quanneng.png/gedou.png
        const iconKey = cls === 2 ? 'sheji' : cls === 3 ? 'quanneng' : 'gedou';
        const iconCandidates = [iconKey, `${iconKey}.png`];
        const shouldDebug = _index < 5; // 只打印前几条，避免刷屏

        const nameN = this.findChild(node, 'Name') || this.findChild(node, 'T Name');
        if (nameN) {
            const l = nameN.getComponent(Label);
            if (l) l.string = name;
        }
        const lvN = this.findChild(node, 'LevelNumber') || this.findChild(node, 'T LevelNumber');
        if (lvN) {
            const l = lvN.getComponent(Label);
            if (l) l.string = level;
        }
        const tagN = this.findChild(node, 'TeamTag');
        if (tagN) {
            const tl = tagN.getComponent(Label);
            if (tl) {
                const pid = String(pet.pet_id ?? pet._id ?? pet.id ?? '');
                const inTeam = !!pid && this.battleTeam.some((bid) => this.normPetId(bid) === this.normPetId(pid));
                tl.string = inTeam ? '出战' : '';
            }
        }
        const mcN = this.findChild(node, 'MechaClass');
        if (mcN) {
            const s = mcN.getComponent(Sprite) as any;
            const atlas = s?.spriteAtlas as SpriteAtlas | null | undefined;
            let appliedFromAtlas = false;
            if (atlas) {
                let sf = null as any;
                let matchedName: string | null = null;
                for (const name of iconCandidates) {
                    const trySf = atlas.getSpriteFrame(name);
                    if (trySf) {
                        sf = trySf;
                        matchedName = name;
                        break;
                    }
                }
                if (sf) {
                    s.spriteFrame = sf;
                    appliedFromAtlas = true;
                    if (shouldDebug) {
                        console.log(
                            `[RobotList][Icon] index=${_index} pet.Class=${pet.Class} cls=${cls} iconKey=${iconKey} matched=${matchedName ?? 'unknown'}`
                        );
                    }
                } else {
                    console.warn(
                        `[RobotList] MechaClass 图标帧未找到，cls=${cls}, candidates=${iconCandidates.join(',')}`,
                        { atlasFramesNotEnumerated: true }
                    );
                    if (shouldDebug) {
                        console.log(
                            `[RobotList][Icon] index=${_index} pet.Class=${pet.Class} cls=${cls} iconKey=${iconKey} iconCandidates=${iconCandidates.join(',')}`
                        );
                    }
                }
            }
            // 兜底：atlas 没命中时，直接用外部拖拽的 SpriteFrame 替换，保证切换必然生效
            if (!appliedFromAtlas) {
                let fallback: SpriteFrame | null = null;
                if (cls === 2) fallback = this.mechaIconSheji;
                else if (cls === 3) fallback = this.mechaIconQuanneng;
                else fallback = this.mechaIconGedou;
                if (fallback) {
                    s.spriteFrame = fallback;
                } else if (shouldDebug) {
                    console.warn(
                        `[RobotList][Icon] fallback SpriteFrame 为空：cls=${cls}, mechaIconGedou=${!!this.mechaIconGedou}, mechaIconSheji=${!!this.mechaIconSheji}, mechaIconQuanneng=${!!this.mechaIconQuanneng}`
                    );
                }
            }
        }
        (node as any)._petId = id;
        (node as any)._pet = pet;
    }

    private setRowLayout(node: Node, index: number, firstY: number) {
        const y = firstY - index * (this.ITEM_HEIGHT + this.ITEM_SPACING);
        node.setPosition(node.position.x, y, node.position.z);
    }

    private bindRowClick(node: Node, index: number) {
        let btn = node.getComponent(Button);
        if (!btn) btn = node.addComponent(Button);
        if (!btn) return;
        btn.interactable = true;
        btn.transition = Button.Transition.NONE;

        const prev = this.itemClickHandlers.get(node);
        if (prev && typeof btn.node.off === 'function') {
            btn.node.off(Button.EventType.CLICK, prev, this);
        }
        const handler = () => this.onRowClick(node, index);
        this.itemClickHandlers.set(node, handler);
        btn.node.on(Button.EventType.CLICK, handler, this);
    }

    private onRowClick(node: Node, index: number) {
        this.clearSelection();
        this.selectedIndex = index;
        this.selectedNode = node;
        this.selectedPet = this.currentPets[index] ?? null;
        this.setRowSelection(node, true);
        this.updateConfirmVisibility();
    }

    private setRowSelection(node: Node, selected: boolean) {
        const bg = this.findChild(node, 'BG1') || this.findChild(node, 'BG2') || this.findChild(node, 'BG') || this.findChild(node, 'Background');
        const sprite = bg?.getComponent(Sprite) ?? node.getComponent(Sprite);
        if (!sprite) return;
        
                if (selected) {
            // 选中时：保存当前颜色（可能是红色滤镜或白色），然后应用黄色
            if (!this.bgColorMap.has(sprite.node)) {
                this.bgColorMap.set(sprite.node, sprite.color.clone());
            }
            sprite.color = new Color(255, 255, 100, 255); // 黄色选中效果
                } else {
            // 未选中时：恢复原始颜色（如果有保存），否则根据出战状态设置
            const orig = this.bgColorMap.get(sprite.node);
            if (orig) {
                sprite.color = orig;
                this.bgColorMap.delete(sprite.node);
                    } else {
                // 关键修复：恢复时根据出战状态设置红色滤镜或白色
                const petId = (node as any)._petId as string | undefined;
                const inTeam = !!petId && this.battleTeam.some(bid => this.normPetId(bid) === this.normPetId(petId));
                sprite.color = inTeam ? new Color(255, 100, 100, 255) : new Color(255, 255, 255, 255);
            }
        }
    }

    private updateRowBattleFilter(node: Node, pet: any) {
        // 关键修复：如果当前行被选中，不覆盖选中效果（黄色优先）
        if (this.selectedNode === node) return;
        
        const id = this.normPetId(String(pet.pet_id ?? pet._id ?? pet.id ?? ''));
        const inTeam = this.battleTeam.some(bid => this.normPetId(bid) === id);
        const bg = this.findChild(node, 'BG1') || this.findChild(node, 'BG2') || this.findChild(node, 'BG') || this.findChild(node, 'Background');
        const sprite = bg?.getComponent(Sprite) ?? node.getComponent(Sprite);
        if (!sprite) return;
        
        // 关键修复：强制应用红色滤镜（如果不在选中状态且没有保存选中颜色）
        // 只有在没有保存选中颜色时才更新（避免覆盖选中效果）
        if (!this.bgColorMap.has(sprite.node)) {
            const targetColor = inTeam ? new Color(255, 100, 100, 255) : new Color(255, 255, 255, 255);
            sprite.color = targetColor;
        }
    }

    private updateSetVisibility(node: Node) {
        const setN = this.findChild(node, 'Set');
        if (setN) setN.active = !this.isFromBag;
    }

    private bindSetAndActions(node: Node, pet: any, index: number) {
        const setN = this.findChild(node, 'Set');
        if (!setN) return;
        const panel = this.findChild(setN, 'Button');
        if (!panel) return;

        panel.active = false;

        // 关键修复：确保使用正确的 petId（服务器返回的是 pet_id 字段，对应数据库的 _id）
        const petId = String(pet.pet_id ?? pet._id ?? pet.id ?? '');
        // 将 pet 数据绑定到节点，方便后续使用
        (node as any)._pet = pet;
        (node as any)._petId = petId;
        const row = node;

        let setBtn = setN.getComponent(Button);
        if (!setBtn) setBtn = setN.addComponent(Button);
        if (setBtn) {
            setBtn.interactable = true;
            setBtn.transition = Button.Transition.NONE;
            setBtn.node.targetOff(this);
            setBtn.node.on(Button.EventType.CLICK, () => this.toggleSetPanel(row, setN, panel), this);
        }

        const viewN = this.findChild(panel, 'View');
        const deployN = this.findChild(panel, 'Deploy');
        const releaseN = this.findChild(panel, 'Release');
        const maskN = this.findChild(panel, 'MASK');

        for (const n of [viewN, deployN, releaseN]) {
            if (!n) continue;
            const b = n.getComponent(Button);
            if (b) {
                b.interactable = true;
                b.transition = Button.Transition.NONE;
                n.targetOff(this);
            }
        }

        if (viewN) {
            viewN.on(Button.EventType.CLICK, () => this.onView(petId, row, panel), this);
        }
        if (deployN) {
            this.updateDeployButtonLabel(deployN, petId);
            deployN.on(Button.EventType.CLICK, () => this.onDeploy(petId, row, panel), this);
        }
        if (releaseN) {
            releaseN.on(Button.EventType.CLICK, () => this.onRelease(petId, row, panel), this);
        }
        if (maskN) {
            maskN.targetOff(this);
            maskN.on(Node.EventType.TOUCH_END, () => this.closeSetForRow(row), this);
        }
    }

    private toggleSetPanel(row: Node, setN: Node, panel: Node) {
        this.clearSelection();
        this.closeAllSetPanelsExcept(row);
        const open = !!panel.active;
        panel.active = !open;
        if (panel.active) {
            this.openSetRow = row;
            const petId = (row as any)._petId as string | undefined;
            const deployN = petId ? this.findChild(panel, 'Deploy') : null;
            if (deployN && petId) this.updateDeployButtonLabel(deployN, petId);
            if (row.parent === this.content && this.content.children.length > 0) {
                row.setSiblingIndex(this.content.children.length - 1);
                    }
                } else {
            if (this.openSetRow === row) this.openSetRow = null;
        }
    }

    private closeSetForRow(row: Node) {
        const setN = this.findChild(row, 'Set');
        if (!setN) return;
        const panel = this.findChild(setN, 'Button');
        if (panel) panel.active = false;
        if (this.openSetRow === row) this.openSetRow = null;
    }

    private closeAllSetPanelsExcept(except: Node | null) {
        if (this.robotListDataTemplate && this.robotListDataTemplate !== except) {
            this.closeSetForRow(this.robotListDataTemplate);
        }
        for (const n of this.listItems) {
            if (n?.isValid && n !== except) this.closeSetForRow(n);
        }
    }

    private closeAllSetPanels() {
        this.closeAllSetPanelsExcept(null);
    }

    private onView(petId: string, row: Node, panel: Node) {
        this.clearSelection();
        this.closeSetForRow(row);
        const rp = this.robotPanel;
        if (rp) {
            const att = rp.getComponent('RobotAttributePanel') as any;
            if (att?.showSelectedRobot) {
                rp.active = true;
                att.showSelectedRobot(petId);
            }
        }
        this.hide();
    }

    /** 规范化 petId（小写、trim），与 battleTeam 存储格式一致，避免大小写导致“在队伍”判断错 */
    private normPetId(id: string): string {
        return String(id || '').trim().toLowerCase();
    }

    private resetBattleTeamVersionState(): void {
        this.battleTeamVersion = 0;
        this._battleTeamVersionSeeded = false;
    }

    /** 从任意服务端 payload 根级或 data 内读取 team_version */
    private applyServerTeamVersion(payload: any): void {
        if (!payload || typeof payload !== 'object') return;
        const tv = payload.team_version ?? payload.data?.team_version;
        if (tv === undefined || tv === null) return;
        const n = Number(tv);
        if (Number.isNaN(n)) return;
        this.battleTeamVersion = n;
        this._battleTeamVersionSeeded = true;
    }

    /** 修复点：请求中禁用/恢复所有行的出战、放生按钮，避免高频点击与视觉误导 */
    private setDeployReleaseButtonsInteractable(enabled: boolean) {
        // 模板行也需要覆盖（否则第一行仍可点）
        if (this.robotListDataTemplate?.isValid) {
            const row = this.robotListDataTemplate;
            const setN = this.findChild(row, 'Set');
            if (setN) {
                const panel = this.findChild(setN, 'Button');
                if (panel) {
                    const deployN = this.findChild(panel, 'Deploy');
                    const releaseN = this.findChild(panel, 'Release');
                    const db = deployN?.getComponent(Button);
                    const rb = releaseN?.getComponent(Button);
                    if (db) db.interactable = enabled;
                    if (rb) rb.interactable = enabled;
                }
            }
        }
        for (const row of this.listItems) {
            if (!row?.isValid) continue;
            const setN = this.findChild(row, 'Set');
            if (!setN) continue;
            const panel = this.findChild(setN, 'Button');
            if (!panel) continue;
            const deployN = this.findChild(panel, 'Deploy');
            const releaseN = this.findChild(panel, 'Release');
            const db = deployN?.getComponent(Button);
            const rb = releaseN?.getComponent(Button);
            if (db) db.interactable = enabled;
            if (rb) rb.interactable = enabled;
        }
    }

    /** 根据是否在出战队伍中更新 Deploy 按钮文字：出战 / 下场 */
    private updateDeployButtonLabel(deployN: Node, petId: string) {
        const n = this.normPetId(petId);
        const inTeam = this.battleTeam.some(bid => this.normPetId(bid) === n);
        const label = deployN.getComponentInChildren(Label);
        if (label) {
            label.string = inTeam ? '下场' : '出战';
        }
    }

    private onDeploy(petId: string, row: Node, panel: Node) {
        const now = Date.now();
        if (now - this._lastDeployClickMs < 300) return;
        this._lastDeployClickMs = now;
        this.clearSelection();
        this.closeSetForRow(row);
        
        // 关键修复：优先使用节点绑定的 petId（确保是最新的、正确的）
        let finalPetId = (row as any)._petId || petId;
        const nodePet = (row as any)._pet;
        if (nodePet) {
            // 从 pet 数据中获取正确的 pet_id（服务器返回的 pet_id 对应数据库的 _id）
            const correctId = String(nodePet.pet_id ?? nodePet._id ?? nodePet.id ?? '');
            if (correctId && correctId.length === 24) {
                finalPetId = correctId;
                console.log(`[RobotList] 使用 petId: ${finalPetId} (来自节点数据)`);
            } else {
                console.warn(`[RobotList] petId 格式异常: ${correctId}, 使用传入的: ${petId}`);
            }
        }
        
        // 验证 petId 格式
        if (!finalPetId || finalPetId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(finalPetId)) {
            console.error(`[RobotList] 无效的 petId 格式: ${finalPetId}`);
            return;
        }
        
        // 若已在出战队伍中，则下场：从队伍中移除并提交（用规范化 id 比较）
        const nid = this.normPetId(finalPetId);
        if (this.battleTeam.some(bid => this.normPetId(bid) === nid)) {
            const next = this.battleTeam.filter(bid => this.normPetId(bid) !== nid);
            this.submitBattleTeam(next);
            return;
        }
        
        const next = this.nextBattleTeam(finalPetId);
        console.log(`[RobotList] 准备设置出战队伍，petId: ${finalPetId}, 当前队伍: ${this.battleTeam}, 新队伍: ${next}`);
        this.submitBattleTeam(next);
    }

    /** 修复点：使用 normPetId 比较，避免大小写导致“已在队伍”误判 */
    private nextBattleTeam(petId: string): string[] {
        const cur = [...this.battleTeam];
        const nid = this.normPetId(petId);
        if (cur.some(bid => this.normPetId(bid) === nid)) return cur;
        if (cur.length < this.MAX_BATTLE_TEAM) return [petId, ...cur].slice(0, this.MAX_BATTLE_TEAM);
        return [petId, cur[0]].filter(Boolean).slice(0, this.MAX_BATTLE_TEAM);
    }

    private submitBattleTeam(team: string[]) {
        if (this._submittingBattleTeam) return;
        if (!this.ws) return;
        const cid = this.ws.getCharacterId();
        if (!cid) return;

        if (!UILockManager.instance.tryLock('battle_team', 8500)) {
            return;
        }
        
        this._submittingBattleTeam = true;
        this.setDeployReleaseButtonsInteractable(false);
        // 下场导致空队伍时，直接提交空数组并刷新
        if (team.length === 0) {
            const emptyReq: any = { character_id: cid, battle_team: [] };
            if (this._battleTeamVersionSeeded) emptyReq.team_version = this.battleTeamVersion;
            this.ws.request(
                GameConfig.MESSAGE_TYPES.SET_BATTLE_TEAM,
                emptyReq,
                (r: any) => {
                    this._submittingBattleTeam = false;
                    this.setDeployReleaseButtonsInteractable(true);
                    UILockManager.instance.unlock('battle_team');
                    if (r?.success !== false) {
                        this.battleTeam = [];
                        this.applyServerTeamVersion(r);
                        this._didRetrySetBattleTeamAfterVersionMismatch = false;
                        this.mergeBattleTeamIntoCache(cid, []);
                        this.refreshListUI();
                        emitBattleTeamUpdated({ character_id: cid });
                    } else {
                        console.error('[RobotList] 设置出战队伍（空）失败:', r?.message ?? '未知错误', r);
                        this.refreshListUI();
                    }
                },
                true,
                8000
            );
            return;
        }
        
        // 关键修复：验证并规范化 petId（服务器期望 ObjectId 字符串，且必须属于当前角色）
        const normalizedTeam: string[] = [];
        for (const id of team) {
            const str = String(id).trim();
            if (!str || str.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(str)) {
                console.warn(`[RobotList] 跳过无效的 petId 格式: ${str}`);
                continue;
            }
            
            // 验证这个 petId 是否在当前机甲列表中（确保属于当前角色，用规范化 id 比较）
            const pet = this.currentPets.find(p => {
                const pid = this.normPetId(String(p.pet_id ?? p._id ?? p.id ?? ''));
                return pid === this.normPetId(str);
            });
            
            if (!pet) {
                console.warn(`[RobotList] petId ${str} 不在当前机甲列表中，跳过`);
                continue;
            }
            
            normalizedTeam.push(str);
        }
        
        if (normalizedTeam.length === 0) {
            console.error('[RobotList] 没有有效的 petId 可以设置出战队伍');
            this._submittingBattleTeam = false;
            this.setDeployReleaseButtonsInteractable(true);
            UILockManager.instance.unlock('battle_team');
            return;
        }
        
        // 关键修复：验证所有 petId 都属于当前角色（用规范化 id 比较）
        const validPets = normalizedTeam.filter(pid => {
            const pn = this.normPetId(pid);
            const pet = this.currentPets.find(p => this.normPetId(String(p.pet_id ?? p._id ?? p.id ?? '')) === pn);
            if (!pet) {
                console.warn(`[RobotList] petId ${pid} 不在当前机甲列表中`);
                return false;
            }
            // 验证机甲是否属于当前角色（如果数据中有 character_id 字段）
            if (pet.character_id && pet.character_id !== cid) {
                console.warn(`[RobotList] petId ${pid} 不属于当前角色 ${cid}，属于 ${pet.character_id}`);
                return false;
            }
            return true;
        });
        
        if (validPets.length === 0) {
            console.error('[RobotList] 没有有效的机甲可以设置出战队伍');
            this._submittingBattleTeam = false;
            this.setDeployReleaseButtonsInteractable(true);
            UILockManager.instance.unlock('battle_team');
            return;
        }
        
        if (validPets.length !== normalizedTeam.length) {
            console.warn(`[RobotList] 过滤后有效机甲数量: ${validPets.length}/${normalizedTeam.length}`);
        }
        
        console.log('[RobotList] 设置出战队伍:', validPets, '当前角色ID:', cid);
        console.log('[RobotList] 当前机甲列表 petIds:', this.currentPets.map(p => String(p.pet_id ?? p._id ?? p.id ?? '')));

        const setReq: any = { character_id: cid, battle_team: validPets };
        if (this._battleTeamVersionSeeded) setReq.team_version = this.battleTeamVersion;

        this.ws.request(
            GameConfig.MESSAGE_TYPES.SET_BATTLE_TEAM,
            setReq,
            (r: any) => {
                const raw = r?.data?.battle_team ?? r?.battle_team;
                if (r?.success && Array.isArray(raw)) {
                    this._submittingBattleTeam = false;
                    this.setDeployReleaseButtonsInteractable(true);
                    UILockManager.instance.unlock('battle_team');
                    this.battleTeam = raw.map((x: any) => String(x).trim().toLowerCase()).filter(Boolean);
                    this.applyServerTeamVersion(r);
                    this._didRetrySetBattleTeamAfterVersionMismatch = false;
                    this.mergeBattleTeamIntoCache(cid, this.battleTeam);
                    this.refreshListUI();
                    emitBattleTeamUpdated({ character_id: cid });
                    return;
                }

                const mismatch =
                    r?.code === 409 ||
                    r?.error_code === 'TEAM_VERSION_MISMATCH' ||
                    (typeof r?.message === 'string' && r.message.includes('队伍版本'));
                if (
                    mismatch &&
                    this.ws &&
                    !this._setBattleTeamVersionRetryPending &&
                    !this._didRetrySetBattleTeamAfterVersionMismatch
                ) {
                    this._didRetrySetBattleTeamAfterVersionMismatch = true;
                    this._setBattleTeamVersionRetryPending = true;
                    this._submittingBattleTeam = false;
                    this.setDeployReleaseButtonsInteractable(true);
                    UILockManager.instance.unlock('battle_team');
                    this.ws.request(
                        GameConfig.MESSAGE_TYPES.GET_BATTLE_TEAM,
                        { character_id: cid },
                        (resp: any) => {
                            this._setBattleTeamVersionRetryPending = false;
                            if (resp?.success === false) {
                                this._didRetrySetBattleTeamAfterVersionMismatch = false;
                                console.error('[RobotList] 同步队伍版本失败:', resp?.message ?? resp, resp);
                                this.refreshListUI();
                                return;
                            }
                            this.applyServerTeamVersion(resp);
                            const btRaw = resp?.data?.battle_team ?? resp?.battle_team;
                            if (Array.isArray(btRaw)) {
                                this.battleTeam = btRaw
                                    .map((x: any) => String(x).trim().toLowerCase())
                                    .filter(Boolean);
                            }
                            this.submitBattleTeam(validPets);
                        },
                        true,
                        8000
                    );
                    return;
                }

                this._submittingBattleTeam = false;
                this.setDeployReleaseButtonsInteractable(true);
                UILockManager.instance.unlock('battle_team');
                console.error('[RobotList] 设置出战队伍失败:', r?.message ?? '未知错误', r);
                this.refreshListUI();
            },
            true,
            8000
        );
    }

    /** 将最新 battle_team 写回 DataCacheManager，避免返回列表时用旧缓存覆盖 */
    private mergeBattleTeamIntoCache(cid: string, battleTeam: string[]) {
        try {
            const cache = DataCacheManager.getInstance();
            const cur = cache.getRobotPetsCache(cid);
            const verPatch = this._battleTeamVersionSeeded ? { team_version: this.battleTeamVersion } : {};
            const next = (cur && typeof cur === 'object')
                ? { ...cur, battle_team: battleTeam, ...verPatch }
                : { battle_team: battleTeam, pets: this.currentPets, ...verPatch };
            cache.setRobotPetsCache(cid, next);
        } catch (_) {}
    }

    private onRelease(petId: string, row: Node, panel: Node) {
                this.clearSelection();
        this.closeSetForRow(row);
        this.releasePet(petId);
    }

    private releasePet(petId: string) {
        if (this._releasing) return;
        if (!this.ws) return;
        if (!UILockManager.instance.tryLock('robot_release', 10500)) return;
        this._releasing = true;
        this.setDeployReleaseButtonsInteractable(false);
        this.ws.request(
            GameConfig.MESSAGE_TYPES.ROBOT_RELEASE_PET,
            { pet_id: petId, character_id: this.ws.getCharacterId() },
            (r: any) => {
                this._releasing = false;
                this.setDeployReleaseButtonsInteractable(true);
                UILockManager.instance.unlock('robot_release');
                if (r?.success) {
                    emitRobotDataUpdated({ character_id: this.ws.getCharacterId() ?? undefined });
                    emitBattleTeamUpdated({ character_id: this.ws.getCharacterId() ?? undefined });
                    this.forceRefresh();
                } else console.error('[RobotList] 放生失败:', r?.message ?? '未知错误');
            },
            true,
            10000
        );
    }

    private onBack() {
        if (this.openSetRow) {
            this.closeSetForRow(this.openSetRow);
            return;
        }
        if (this.cancelCb) this.cancelCb();
        this.hide();
    }

    private onConfirm() {
        if (this._confirming) return;
        if (this.selectedIndex < 0 || !this.selectedPet) return;
        const petId = String(this.selectedPet.pet_id ?? this.selectedPet._id ?? this.selectedPet.id ?? '');

        if (this.confirmCb) {
            this._confirming = true;
            const confirmBtn = this.confirmButton?.getComponent(Button);
            if (confirmBtn) confirmBtn.interactable = false;
            this.confirmCb(petId, this.selectedPet);
            return;
        }

        const rp = this.robotPanel;
        if (rp) {
            const att = rp.getComponent('RobotAttributePanel') as any;
            if (att?.showSelectedRobot) {
                rp.active = true;
                att.showSelectedRobot(petId);
            }
        }
        this.hide();
    }

    private updateConfirmVisibility() {
        if (this.confirmButton) {
            this.confirmButton.active = this.selectedIndex >= 0 && this.selectedPet != null;
        }
    }

    private clearSelection() {
        if (this.selectedNode?.isValid) this.setRowSelection(this.selectedNode, false);
        this.selectedIndex = -1;
        this.selectedPet = null;
        this.selectedNode = null;
        this.bgColorMap.clear();
        this.updateConfirmVisibility();
    }

    private clearAdditionalItems() {
        for (const n of this.listItems) {
            if (n?.isValid) n.active = false;
        }
        const ui = this.content?.getComponent(UITransform);
        if (ui) ui.setContentSize(ui.width, this.ITEM_HEIGHT);
        this.clearSelection();
    }

    private updateContentHeight(count: number, firstY = 0) {
        const ui = this.content?.getComponent(UITransform);
        if (!ui) return;
        if (count <= 0) {
            ui.setContentSize(ui.width, this.ITEM_HEIGHT);
            return;
        }
        const lastY = firstY - (count - 1) * (this.ITEM_HEIGHT + this.ITEM_SPACING);
        const h = Math.abs(lastY - firstY) + this.ITEM_HEIGHT;
        ui.setContentSize(ui.width, Math.max(h, ui.height));
    }

    private findChild(p: Node, name: string): Node | null {
        if (!p) return null;
        if (p.name === name) return p;
        for (const c of p.children) {
            const f = this.findChild(c, name);
            if (f) return f;
        }
        return null;
    }
}
