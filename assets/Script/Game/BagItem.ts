import { _decorator, Component, Node, Button, Label, instantiate, Sprite, SpriteFrame, UITransform, SpriteAtlas, resources, JsonAsset, assetManager, Color, EventTouch, input, Input, Vec3, Vec2, EditBox, tween, Tween, UIOpacity, Graphics } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import { RobotList } from './RobotList';
import { RobotEvolutionEffect } from './RobotEvolutionEffect';
import { DataCacheManager } from '../global/DataCacheManager';
import { ResourceManager } from './ResourceManager';
import { UILockManager } from '../global/UILockManager';
import { emitBattleTeamUpdated, emitRobotDataUpdated } from '../global/RobotGameEvents';
import { BagEventHub } from '../global/BagEvent';

const { ccclass, property } = _decorator;

interface ItemData {
    id: number;
    name: string;
    description: string;
    iconIndex: string;
    price: number;
    consumable: boolean;
    itypeId: number;
    note: string;
    effect?: string;
    effecttext?: string; // 效果文本（用于显示，避免显示技术性的effect字符串）
    UsageTarget?: string; // "Pet" 或 "Player"
    requiredLevel?: number; // 需要装备等级
    type?: number; // 装备类型（用于判断适配的机甲类型）
}

@ccclass('BagItem')
export class BagItem extends Component {
    @property(Node) panel: Node = null!;
    @property(Button) closeBtn: Button = null!;
    @property(Button) itemBtn: Button = null!;
    @property(Button) weaponBtn: Button = null!;
    @property(Button) armorBtn: Button = null!;
    @property(Button) otherBtn: Button = null!;
    @property(Node) bagRoot: Node = null!;
    @property(Node) cellTemplate: Node = null!;
    @property(Button) testWriteBtn: Button = null!;
    @property(Button) testFetchBtn: Button = null!;
    @property(EditBox) randomCountEditBox: EditBox = null!;   // 随机物品数量输入框
    /** 可选：按名称筛选当前页（绑定 EditBox 后生效） */
    @property(EditBox) bagFilterEdit: EditBox | null = null;
    @property(Button) nextPageBtn: Button = null!;            // 下一页按钮
    @property(Button) prevPageBtn: Button = null!;            // 上一页按钮
    @property(Label) pageNumberLabel: Label = null!;          // 显示页码 1/4 之类
    @property(SpriteAtlas) ui2Atlas: SpriteAtlas = null!; // UI2 图集（IconSet2-9 格式）
    @property(SpriteAtlas) iconSet2Atlas: SpriteAtlas = null!; // IconSet2 图集（IconSet2_232 格式）
    @property(Node) introductionPanel: Node = null!; // 统一的物品详情面板（放在 Bag 面板下，全程只用一个）
    @property(Node) useItemPanel: Node = null!; // 使用物品窗口（UseItem）
    @property(Button) useItemButton: Button = null!; // 使用物品按钮（点击后显示使用窗口）
    @property(Button) useBtn: Button = null!; // 使用窗口内的"使用"按钮
    @property(Button) discardBtn: Button = null!; // 使用窗口内的"丢弃"按钮
    @property(RobotList) robotList: RobotList = null!; // 机甲列表面板（用于选择机甲使用物品）
    @property(Node) errorTipsPanel: Node = null!; // ErrorTips 面板节点（BagPanel下的ErrorTips）
    @property(Label) errorTipsLabel: Label = null!; // ErrorTips 下的 Label 组件

    private ws: WebSocketManager = null!;
    private items: Array<{ item_id: number; quantity: number; category: number }> = [];
    private currentCategory: number = 1;
    private spriteCache: Map<string, SpriteFrame> = new Map();
    // 动态格子节点池：只创建一次，翻页/刷新时复用，避免频繁销毁和实例化
    private dynamicNodes: Node[] = [];
    private selectedFrameName = 'menuSelecting';
    private unselectedFrameName = 'menuSelect';
    private itemDataMap: Map<number, ItemData> = new Map(); // item_id -> ItemData 映射
    private itemsDataLoaded: boolean = false; // 标记 Items.json 是否已加载完成
    private selectedItemNode: Node | null = null; // 当前选中的物品格子节点
    private selectedItemId: number | null = null; // 当前选中的物品ID
    private selectedItemSlotIndex: number = -1; // 当前选中的物品在当前分类中的全局slot索引（用于精确定位）
    private hoveredItemNode: Node | null = null; // 当前悬浮的物品格子节点（用于悬浮显示简介）
    private _clickedOnItem: boolean = false; // 标志：是否刚刚点击了物品格子
    // 双击检测
    private lastClickItemId: number | null = null; // 上次点击的物品ID
    private lastClickTime: number = 0; // 上次点击的时间戳
    private readonly DOUBLE_CLICK_INTERVAL = 400; // 双击间隔时间（毫秒），适当放宽以兼容不同操作习惯

    // 延迟显示详情：避免第一次点击后立即显示详情挡住格子，导致第二次点击（双击）被详情面板截获
    private _delayedIntroCallback: (() => void) | null = null;
    // 详情面板当前对应的格子信息（用于点击详情时转发到格子，解决详情遮挡导致双击无反应）
    private _introductionForItemId: number | null = null;
    private _introductionForItemNode: Node | null = null;
    private _introductionForItemIndex: number = -1;
    // 操作防重复标志（MMO最佳实践：使用请求ID + 操作锁双重保护）
    private isProcessingUseItem: boolean = false; // 是否正在处理使用物品请求
    private isProcessingDiscardItem: boolean = false; // 是否正在处理丢弃物品请求
    private currentRequestId: number = 0; // 当前请求ID（用于防止重复请求和响应混乱）
    private pendingRequestId: number | null = null; // 待处理的请求ID
    private requestTimeoutTimer: any = null; // 请求超时定时器
    private readonly REQUEST_TIMEOUT = 10000; // 请求超时时间（10秒）

    // 分页相关（MMO 常规做法：客户端保存当前页，服务端只返回一页数据）
    private currentPage: number = 1;          // 当前页（从 1 开始）
    private totalPages: number = 1;           // 总页数
    private readonly PAGE_SIZE: number = 60;  // 每页格子数（需和服务端 bag_handler 保持一致）
    
    // 版本号相关（新增：用于版本校验和缓存优化）
    private localBagVersion: number = 0;  // 本地版本号（从服务器获取）

    // 拖拽移动（同分类内 slot_index，服务端权威）
    private _dragFromSlot: number = -1;
    private _dragFromNode: Node | null = null;
    private _dragging = false;
    private _dragStartUIPos: Vec2 = new Vec2();
    private _bagNameFilter = '';
    private _discardArmed = false;
    private _discardArmTimer: ReturnType<typeof setTimeout> | null = null;
    private _lastUiThrottleTs = 0;

    // 详情面板相对于模板格子（第一个格子）的固定偏移（世界坐标下）
    private introWorldOffset: Vec3 | null = null;
    
    // 当前正在使用的物品信息（用于 Pet 类型物品选择机甲后使用）
    private pendingUseItemId: number | null = null;
    private pendingUseItemNode: Node | null = null;

    // 一行最多多少列（你说目前最多 10 列）
    private readonly COLS = 10;
    private readonly CELL_SIZE = 32;
    private readonly GAP = 6;
    private readonly MARGIN_LR = 10;
    private readonly MARGIN_TB = 15;
    private readonly FIRST_X = 10;
    private readonly FIRST_Y = -15;

    onLoad() {
        this.ws = WebSocketManager.getInstance();
        if (!this.bagRoot && this.cellTemplate && this.cellTemplate.parent) { this.bagRoot = this.cellTemplate.parent; }
        
        // 关键修复：监听角色切换事件，清除内部状态
        if (this.ws) {
            this.ws.on('data_changed', this.onCharacterChanged, this);
        }
        if (this.closeBtn) {
            this.closeBtn.node.on('click', () => {
                // 优先级1：如果使用物品窗口打开，先关闭它
                if (this.useItemPanel && this.useItemPanel.active) {
                    this.closeUseItemPanel();
                    return;
                }
                // 优先级2：如果当前有选中的物品，先取消选中
                if (this.selectedItemNode) {
                    this.clearSelection();
                    return;
                }
                // 优先级3：如果没有选中物品，则关闭整个面板
                // 关闭背包时，同时关闭机甲列表和使用窗口
                if (this.robotList && this.robotList.node) {
                    this.robotList.node.active = false;
                    this.robotList.clearCallbacks();
                }
                if (this.useItemPanel) {
                    this.useItemPanel.active = false;
                }
                if (this.panel) {
                    this.cancelDragState();
                    this.panel.active = false;
                }
                this.resetMainActionButtons();
            });
        }
        if (this.useItemButton) {
            this.useItemButton.node.on('click', () => {
                // 点击使用按钮时，如果有选中的物品，显示使用窗口
                if (this.selectedItemNode && this.selectedItemId !== null) {
                    this.showUseItemPanel(this.selectedItemId);
                }
            });
        }
        if (this.useBtn) {
            this.useBtn.node.on('click', () => {
                if (this.selectedItemId !== null) {
                    this.onUseItem(this.selectedItemId);
                }
            });
        }
        if (this.discardBtn) {
            this.discardBtn.node.on('click', () => {
                if (this.selectedItemId !== null) {
                    this.onDiscardItem(this.selectedItemId);
                }
            });
        }
        // 分类映射：1=Items, 2=Weapon+Gun(武器), 3=Wing+Dun+Armor(护甲), 4=Other(暂时不用)
        if (this.itemBtn) this.itemBtn.node.on('click', () => { this.switchCategory(1); });
        if (this.weaponBtn) this.weaponBtn.node.on('click', () => { this.switchCategory(2); });  // 武器(Weapon+Gun)
        if (this.armorBtn) this.armorBtn.node.on('click', () => { this.switchCategory(3); });    // 护甲(Wing+Dun+Armor)
        // otherBtn 暂时不使用
        // if (this.otherBtn) this.otherBtn.node.on('click', () => { this.switchCategory(4); });
        if (this.testWriteBtn) this.testWriteBtn.node.on('click', () => { this.requestWriteRandom(); });
        if (this.testFetchBtn) this.testFetchBtn.node.on('click', () => { this.requestFetchBag(); });
        if (this.nextPageBtn) {
            this.nextPageBtn.node.on('click', () => {
                this.gotoPage(this.currentPage + 1);
            });
        }
        if (this.prevPageBtn) {
            this.prevPageBtn.node.on('click', () => {
                this.gotoPage(this.currentPage - 1);
            });
        }
        if (this.ws) {
            this.ws.on(GameConfig.MESSAGE_TYPES.BAG_WRITE_RESPONSE, this.onWriteResponse, this);
            this.ws.on(GameConfig.MESSAGE_TYPES.BAG_ITEMS, this.onBagItems, this);
            // BAG_ITEMS_UPDATE 只作为「数据有变化，需要重新拉取当前页」的信号
            this.ws.on(GameConfig.MESSAGE_TYPES.BAG_ITEMS_UPDATE, this.onBagItemsUpdate, this);
            // 使用物品和丢弃物品的响应
            this.ws.on(GameConfig.MESSAGE_TYPES.BAG_USE_ITEM_RESPONSE, this.onUseItemResponse, this);
            this.ws.on(GameConfig.MESSAGE_TYPES.BAG_DISCARD_ITEM_RESPONSE, this.onDiscardItemResponse, this);
            this.ws.on('network_disconnect', this.onNetworkDisconnectBag, this);
        }
        this.updateCategoryTabUI();
        this.loadItemsData();

        if (this.bagFilterEdit) {
            this.bagFilterEdit.node.on(EditBox.EventType.EDITING_DID_ENDED, () => {
                this._bagNameFilter = (this.bagFilterEdit!.string || '').trim().toLowerCase();
                if (this.panel && this.panel.active) this.render();
            }, this);
        }
        if (this.otherBtn?.node) {
            this.otherBtn.node.on(Button.EventType.CLICK, () => this.onSortCurrentCategory(), this);
        }

        // 详情面板点击转发：当详情悬浮/点击后覆盖在格子上时，点击详情等价于点击对应格子，避免双击无反应
        if (this.introductionPanel?.isValid) {
            this.introductionPanel.on(Node.EventType.TOUCH_END, this.onIntroductionTouchEnd, this);
        }
        
        // 使用最简单的方法：在Button点击时设置标志，延迟检查是否点击了其他区域
        // 使用全局触摸事件检测点击
        if (input && typeof input.on === 'function') {
            input.on(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
        }
    }

    /** 取消延迟显示详情的定时，避免与双击、清选等冲突 */
    private cancelDelayedIntro(): void {
        if (this._delayedIntroCallback) {
            this.unschedule(this._delayedIntroCallback);
            this._delayedIntroCallback = null;
        }
    }

    /** 详情面板上的触摸结束：转发为对应格子的点击，解决详情覆盖格子导致双击无效 */
    private onIntroductionTouchEnd(): void {
        if (this._introductionForItemNode == null || this._introductionForItemId == null || this._introductionForItemIndex < 0) return;
        this._clickedOnItem = true;
        this.onItemClick(this._introductionForItemNode, this._introductionForItemId, this._introductionForItemIndex);
        this.scheduleOnce(() => { this._clickedOnItem = false; }, 0.2);
    }

    /**
     * 加载所有物品和装备JSON数据
     * 支持多种加载方式：resources/json、json 目录、或直接 URL
     */
    private loadItemsData() {
        const jsonFiles = ['Items', 'Weapon', 'Gun', 'Wing', 'Dun', 'Armor'];
        let loadedCount = 0;
        let totalItems = 0;
        
        const resourceMgr = ResourceManager.getInstance();
        
        const checkComplete = () => {
            if (loadedCount === jsonFiles.length) {
                console.log(`✅ [BagItem] 已加载所有物品和装备数据，共 ${totalItems} 个`);
                this.itemsDataLoaded = true;
                // 如果已经有物品数据，重新渲染
                if (this.items.length > 0) {
                    console.log('🔄 [BagItem] 物品数据已加载，重新渲染物品列表');
                    this.render();
                }
            }
        };
        
        // 陆续加载JSON文件（避免一次性加载造成卡顿）
        let currentIndex = 0;
        const loadNextFile = () => {
            if (currentIndex >= jsonFiles.length) {
                return;
            }
            
            const fileName = jsonFiles[currentIndex];
            currentIndex++;
            
            resourceMgr.loadAsset<JsonAsset>(`json/${fileName}`, JsonAsset, (err: Error | null, asset: JsonAsset | null) => {
                loadedCount++;
                if (err) {
                    console.warn(`⚠️ [BagItem] 加载 ${fileName}.json 失败:`, err);
                } else if (asset && asset.json) {
                    const items = asset.json as ItemData[];
                    this.parseItemsData(items);
                    totalItems += items.length;
                    console.log(`✅ [BagItem] 已加载 ${fileName}.json: ${items.length} 个物品`);
                } else {
                    console.error(`❌ [BagItem] ${fileName}.json 数据格式错误`);
                }
                
                checkComplete();
                
                // 延迟后加载下一个文件（给主线程喘息时间）
                if (currentIndex < jsonFiles.length) {
                    setTimeout(() => {
                        loadNextFile();
                    }, 50); // 延迟50ms
                }
            });
        };
        
        // 启动第一批加载（同时加载2个，避免卡顿）
        const batchSize = 2;
        for (let i = 0; i < Math.min(batchSize, jsonFiles.length); i++) {
            setTimeout(() => {
                loadNextFile();
            }, i * 50); // 错开启动时间
        }
    }

    /**
     * 备用加载方案
     */
    private loadItemsDataFallback() {
        // 尝试使用 assetManager 从 json 目录加载
        assetManager.loadAny({ path: 'json/Items', type: JsonAsset }, (err: Error | null, asset: JsonAsset | null) => {
            if (err) {
                console.error('❌ [BagItem] 所有加载方式都失败:', err);
                console.error('💡 解决方案:');
                console.error('   1. 将 Items.json 移动到 assets/resources/json/ 目录');
                console.error('   2. 或者在 Cocos Creator 中右键 Items.json -> 设置为资源');
                // 设置一个默认的图标映射，避免完全无法显示
                this.setupDefaultIcons();
                return;
            }
            if (asset && asset.json) {
                this.parseItemsData(asset.json as ItemData[]);
            } else {
                console.error('❌ [BagItem] Items.json 数据格式错误');
            }
        });
    }

    /**
     * 设置默认图标映射（当 JSON 加载失败时使用）
     */
    private setupDefaultIcons() {
        console.warn('⚠️ [BagItem] 使用默认图标映射（建议修复 JSON 加载问题）');
        // 这里可以设置一些默认的 item_id -> iconIndex 映射
        // 但最好还是修复 JSON 加载问题
    }

    /**
     * 解析物品数据（累积添加，不清空）
     */
    private parseItemsData(items: ItemData[]) {
        // 不要清空，累积添加（因为会加载多个JSON文件）
        let addedCount = 0;
        for (const item of items) {
            if (item.id && item.iconIndex) {
                this.itemDataMap.set(item.id, item);
                addedCount++;
            }
        }
        // 只有在所有JSON文件加载完成后才标记为已加载
        // 这个标记在 loadItemsData 的 checkComplete 中设置
        console.log(`✅ [BagItem] 解析了 ${addedCount} 个物品，当前总计 ${this.itemDataMap.size} 个物品数据`);
        // 如果已经有物品数据，重新渲染
        if (this.items.length > 0) {
            console.log('🔄 [BagItem] 物品数据已更新，重新渲染物品列表');
            this.render();
        }
    }

    onEnable() {
        // 初始化时隐藏使用窗口
        if (this.useItemPanel) {
            this.useItemPanel.active = false;
        }
        
        // 关键修复：重置操作标志，防止场景切换后状态残留导致点击无效
        this.isProcessingUseItem = false;
        this.isProcessingDiscardItem = false;
        this.pendingRequestId = null;
        
        // 确保所有物品格子的按钮是可交互的（在渲染后执行）
        this.requestFetchBag();
    }
    
    onDisable() {
        // 关键修复：面板禁用时重置操作标志，防止状态残留
        this.isProcessingUseItem = false;
        this.isProcessingDiscardItem = false;
        this.pendingRequestId = null;
        
        // 清除选中状态
        this.clearSelection();
        
        // 关闭使用窗口
        if (this.useItemPanel) {
            this.useItemPanel.active = false;
        }
        
        // 关闭机甲列表
        if (this.robotList) {
            this.robotList.clearCallbacks();
            if (this.robotList.node) {
                this.robotList.node.active = false;
            }
        }
        
        // 清除请求超时定时器
        this.clearRequestTimeout();
    }
    /**
     * 处理角色切换事件（清除内部状态）
     */
    private onCharacterChanged = (data: any): void => {
        if (data && data.reason === 'character_id_cleared') {
            console.log('🗑️ [BagItem] 检测到角色切换，清除内部状态');
            // 清除所有内部状态
            this.items = [];
            this.currentPage = 1;
            this.totalPages = 1;
            this.localBagVersion = 0;
            this.itemsDataLoaded = false;
            this.selectedItemNode = null;
            this.selectedItemId = null;
            this.selectedItemSlotIndex = -1;
            this.currentCategory = 1; // 重置为默认分类
            // 清空渲染
            if (this.panel && this.panel.active) {
                this.render();
            }
        }
    };

    onDestroy() {
        // 关键修复：取消监听角色切换事件
        if (this.ws) {
            this.ws.off('data_changed', this.onCharacterChanged, this);
            this.ws.off('network_disconnect', this.onNetworkDisconnectBag, this);
        }
        // 清除所有定时器（防止内存泄漏）
        this.clearRequestTimeout();
        
        // 清除选中状态
        this.clearSelection();
        
        // 移除WebSocket事件监听
        if (this.ws) {
            this.ws.off(GameConfig.MESSAGE_TYPES.BAG_WRITE_RESPONSE, this.onWriteResponse, this);
            this.ws.off(GameConfig.MESSAGE_TYPES.BAG_ITEMS, this.onBagItems, this);
            this.ws.off(GameConfig.MESSAGE_TYPES.BAG_ITEMS_UPDATE, this.onBagItemsUpdate, this);
            this.ws.off(GameConfig.MESSAGE_TYPES.BAG_USE_ITEM_RESPONSE, this.onUseItemResponse, this);
            this.ws.off(GameConfig.MESSAGE_TYPES.BAG_DISCARD_ITEM_RESPONSE, this.onDiscardItemResponse, this);
        }
        // 移除全局点击事件监听
        if (input && typeof input.off === 'function') {
            input.off(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
        }
        if (this.introductionPanel?.isValid) {
            this.introductionPanel.off(Node.EventType.TOUCH_END, this.onIntroductionTouchEnd, this);
        }

        // 重置操作标志（防止状态残留）
        this.isProcessingUseItem = false;
        this.isProcessingDiscardItem = false;
        this.pendingRequestId = null;
        UILockManager.instance.forceUnlockAll();
    }

    private switchCategory(cat: number) {
        this.cancelDragState();
        // 切换分类时重置到第一页，并从服务端重新拉取该分类的第一页数据
        // MMO最佳实践：切换分类时强制刷新，确保数据是最新的
        // 关键修复：切换分类时重置版本号，强制获取新分类的数据
        this.currentCategory = cat;
        this.currentPage = 1;
        this.localBagVersion = 0;  // 新增：重置版本号，强制获取新分类的数据
        this.updateCategoryTabUI();
        // 强制从服务器获取最新数据
        this.requestFetchBag();
    }

    private requestWriteRandom() {
        const cid = this.ws.getCharacterId?.() || undefined;
        // 如果有输入框，就读取玩家输入的数量
        let count: number | undefined = undefined;
        if (this.randomCountEditBox) {
            const txt = this.randomCountEditBox.string.trim();
            if (txt.length > 0) {
                const n = parseInt(txt, 10);
                if (!isNaN(n) && n > 0) {
                    count = n;
                }
            }
        }

        const msg: any = {
            type: GameConfig.MESSAGE_TYPES.BAG_WRITE_RANDOM,
            character_id: cid,
        };
        // 不填就走原逻辑；填了就把数量发给服务端
        if (count !== undefined) {
            msg.count = count;
        }

        this.ws.send(msg);
    }

    /**
     * 请求获取背包物品
     * 修复点：服务端返回 type:'bag_items'，而 request() 监听的是 bag_get_response，
     * 导致 request 回调永远收不到响应，10 秒后超时误报 408。改用 send() 发送请求，
     * 由 BAG_ITEMS 事件统一处理响应，消除虚假超时。
     */
    private requestFetchBag() {
        const cid = this.ws.getCharacterId?.() || undefined;
        if (!cid) {
            console.warn('⚠️ [BagItem] 无法获取角色ID，无法请求背包数据');
            return;
        }
        
        this.ws.send(
            {
                type: GameConfig.MESSAGE_TYPES.BAG_GET,
                character_id: cid,
                category: this.currentCategory,
                page: this.currentPage,
                page_size: this.PAGE_SIZE,
                bag_version: this.localBagVersion,
            } as any,
            true
        );
    }

    private onWriteResponse = (data: any) => { if (data && data.success) { this.requestFetchBag(); } };
    /**
     * 处理服务端返回的当前页物品数据（优化：支持标准格式和直接格式）
     * data.items 只包含当前页，data.page/total_pages 等为分页信息
     * MMO最佳实践：服务器是唯一的数据源，客户端必须接受服务器的状态
     */
    private onBagItems = (data: any) => { 
        // 兼容标准格式（data字段）和直接格式（字段在根级别）
        const responseData = data.data || data;
        
        if (data && data.success) {
            // 版本号更新（总是更新，不管是否匹配）
            const serverVersion = data.bag_version || responseData.bag_version || 0;
            
            // 新增：检查版本号匹配（但需要考虑分类）
            // 关键修复：只有当本地有数据、版本匹配、且分类一致时才使用本地缓存
            const serverCategory = data.category !== undefined ? data.category : (responseData.category !== undefined ? responseData.category : this.currentCategory);
            if (data.version_match === true && this.items.length > 0 && serverCategory === this.currentCategory && this.localBagVersion === serverVersion) {
                // 版本匹配且分类一致，使用本地缓存
                this.localBagVersion = serverVersion;
                console.log(`✅ [BagItem] 版本匹配（${serverVersion}，分类${serverCategory}），使用本地数据`);
                // 不更新 items，直接使用现有的 this.items
                this.updatePageNumberUI();
                this.render();
                return;
            }
            
            // 如果版本匹配但分类不一致或本地没有数据，继续处理服务器返回的数据
            if (data.version_match === true && (this.items.length === 0 || serverCategory !== this.currentCategory)) {
                console.log(`⚠️ [BagItem] 版本匹配但分类不一致或本地无数据，强制获取服务器数据`);
            }
            
            // 使用服务器返回的数据
            this.localBagVersion = serverVersion;  // 更新本地版本号
            
            // 服务器是权威数据源，直接使用服务器返回的数据（回滚机制）
            const serverItems = Array.isArray(responseData.items || data.items) ? (responseData.items || data.items) : [];
            
            // 同步分页信息（兼容旧服务端：字段不存在时给默认值）
            const serverPage = typeof (responseData.page || data.page) === 'number' && (responseData.page || data.page) > 0 
                ? (responseData.page || data.page) 
                : this.currentPage || 1;
            const serverTotalPages = typeof (responseData.total_pages || data.total_pages) === 'number' && (responseData.total_pages || data.total_pages) > 0 
                ? (responseData.total_pages || data.total_pages) 
                : (this.totalPages || 1);
            
            // 关键修复：如果当前页被删除后变成空页，服务器会返回调整后的页码
            // 如果返回的页码与请求的页码不一致，说明页面已调整，需要同步
            if (serverPage !== this.currentPage) {
                console.log(`🔄 [BagItem] 页码已调整：请求 ${this.currentPage}，服务器返回 ${serverPage}（可能因为删除后页面变空）`);
            }
            
            this.currentPage = serverPage;
            this.totalPages = serverTotalPages;
            
            // 确保页码有效（兜底逻辑）
            if (this.currentPage > this.totalPages && this.totalPages > 0) {
                const oldPage = this.currentPage;
                this.currentPage = this.totalPages;
                console.log(`⚠️ [BagItem] 页码超出范围，从 ${oldPage} 调整为最后一页: ${this.currentPage}`);
                // 如果页码被调整，需要重新请求
                this.scheduleOnce(() => {
                    this.requestFetchBag();
                }, 0.05);
                return;
            }
            
            // MMO最佳实践：如果当前页为空且不是最后一页，说明删除后页面被调整，需要重新请求
            if (serverItems.length === 0 && this.currentPage < this.totalPages && this.totalPages > 1) {
                console.log(`🔄 [BagItem] 当前页为空，调整到前一页`);
                this.currentPage = Math.max(1, this.currentPage - 1);
                this.scheduleOnce(() => {
                    this.requestFetchBag();
                }, 0.05);
                return;
            }

            // 更新物品列表（使用服务器返回的数据）
            // 注意：服务器返回的items已经是按分类和分页过滤后的数据，直接使用即可
            this.items = serverItems;

            this.updatePageNumberUI();

            console.log(`📦 [BagItem] 收到服务器数据：${this.items.length} 个物品，页码 ${this.currentPage}/${this.totalPages}`);
            BagEventHub.emit('bag', {
                kind: 'refreshed',
                category: this.currentCategory,
                page: this.currentPage,
                itemCount: this.items.length,
            });
            this.render();
            // 渲染后确保按钮在 mask 上方
            this.ensureButtonsAboveMask();
            
            // 关键修复：渲染后确保所有物品格子的按钮是可交互的
            this.ensureAllItemButtonsInteractable();
        } else {
            // 修复点：统一处理 BAG_GET 失败/超时，给出明确日志与轻量提示
            const code = data?.code;
            const msg = data?.message || responseData?.message || '获取背包数据失败';
            console.error(`❌ [BagItem] 获取背包物品失败: code=${code}, message=${msg}`);
            // 仅在面板已打开时给玩家弹出轻量提示，避免后台请求打扰
            if (this.panel && this.panel.active) {
                this.showErrorTips(msg, false);
            }
        } 
    };

    /**
     * 物品有更新时（例如随机重写背包、使用物品、删除物品），重新请求当前页
     * MMO最佳实践：立即刷新，不使用延迟，确保数据同步
     * 新增：重置版本号，强制获取最新数据
     */
    private onBagItemsUpdate = (data: any) => {
        if (data && data.success) {
            const delta = data.bag_delta;
            if (delta && Array.isArray(delta.ops)) {
                for (const op of delta.ops) {
                    if (op && op.op && op.op !== 'refetch') {
                        console.log(`[BagItem] bag_delta op=${op.op}（当前仍走整页 refetch）`);
                    }
                }
            }
            this.localBagVersion = 0;
            this.requestFetchBag();
        }
    };

    /**
     * 跳转到指定页（自动裁剪到 1~totalPages）
     * MMO最佳实践：翻页时总是从服务器获取最新数据，不使用缓存
     */
    private gotoPage(targetPage: number) {
        this.cancelDragState();
        if (!this.totalPages || this.totalPages < 1) {
            this.totalPages = 1;
        }
        const p = Math.max(1, Math.min(targetPage, this.totalPages));
        // 移除缓存检查，总是请求服务器获取最新数据
        // 即使页码相同，也要刷新以确保数据是最新的
        this.currentPage = p;
        this.updatePageNumberUI();
        // 强制从服务器获取最新数据
        this.requestFetchBag();
    }

    /**
     * 更新页码显示，例如 1/4
     */
    private updatePageNumberUI() {
        if (!this.pageNumberLabel) return;
        if (!this.totalPages || this.totalPages < 1) {
            this.totalPages = 1;
        }
        if (!this.currentPage || this.currentPage < 1) {
            this.currentPage = 1;
        }
        this.pageNumberLabel.string = `${this.currentPage}/${this.totalPages}`;
    }

    private updateCategoryTabUI() {
        // 分类映射：1=Items, 2=Weapon+Gun(武器), 3=Wing+Dun+Armor(护甲), 4=Other(暂时不用)
        const buttons: Array<{ btn: Button | null, cat: number }> = [
            { btn: this.itemBtn || null, cat: 1 },      // Items
            { btn: this.weaponBtn || null, cat: 2 },    // 武器(Weapon+Gun)
            { btn: this.armorBtn || null, cat: 3 },    // 护甲(Wing+Dun+Armor)
            // { btn: this.otherBtn || null, cat: 4 }, // Other 暂时不使用
        ];
        for (const entry of buttons) {
            const btn = entry.btn; if (!btn) continue;
            const spr = btn.getComponent(Sprite);
            if (!spr) continue;
            const atlas: SpriteAtlas | null = (spr as any).spriteAtlas || null;
            const frameName = (entry.cat === this.currentCategory) ? this.selectedFrameName : this.unselectedFrameName;
            let sf: SpriteFrame | null = null;
            if (atlas) sf = atlas.getSpriteFrame(frameName) as SpriteFrame;
            if (sf) { spr.spriteFrame = sf; (btn as any).normalSprite = sf; }
        }
    }

    private render() {
        if ((!this.bagRoot && (!this.cellTemplate || !this.cellTemplate.parent)) || !this.cellTemplate) return;
        const container = this.bagRoot || this.cellTemplate.parent;
        this.cancelDragState();

        // 清除所有节点的选中效果（重要：在复用节点前清除，避免选中效果残留）
        for (const node of this.dynamicNodes) {
            if (node && node.isValid) {
                this.applyYellowFilter(node, false);
            }
        }

        // 清除选中状态（调用clearSelection确保完整清理）
        this.clearSelection();
        // 隐藏统一的详情面板
        if (this.introductionPanel) {
            this.introductionPanel.active = false;
        }
        // 隐藏使用物品窗口（切换分类/翻页时关闭）
        if (this.useItemPanel) {
            this.useItemPanel.active = false;
        }
        // 清除待使用状态并关闭机甲列表
        this.pendingUseItemId = null;
        this.pendingUseItemNode = null;
        // 清除 RobotList 的回调并关闭
        if (this.robotList) {
            this.robotList.clearCallbacks();
            if (this.robotList.node) {
                this.robotList.node.active = false;
            }
        }
        
        // 先隐藏模板格子
        if (this.cellTemplate) {
            this.cellTemplate.active = false;
        }
        
        const base = this.cellTemplate;
        const baseUT = base.getComponent(UITransform);
        const cellW = baseUT ? baseUT.width : this.CELL_SIZE;
        const cellH = baseUT ? baseUT.height : this.CELL_SIZE;
        const originX = base.position.x;
        const originY = base.position.y;
        const baseList = this.items;
        const ft = this._bagNameFilter.trim();
        const specs: { item: (typeof baseList)[0]; pageLocalIndex: number }[] = [];
        for (let i = 0; i < baseList.length; i++) {
            const item = baseList[i];
            if (ft) {
                const d = this.itemDataMap.get(item.item_id);
                const name = (d?.name || '').toLowerCase();
                if (!name.includes(ft)) continue;
            }
            specs.push({ item, pageLocalIndex: i });
        }
        const list = specs;

        // 确保节点池里至少有 list.length 个格子
        // 第 0 个永远是模板本身
        if (this.dynamicNodes.length === 0) {
            this.dynamicNodes.push(this.cellTemplate);
        }
        for (let i = this.dynamicNodes.length; i < list.length; i++) {
            const node = instantiate(this.cellTemplate);
            container.addChild(node);
            this.dynamicNodes.push(node);
        }

        // 渲染当前页需要的格子
        for (let i = 0; i < list.length; i++) {
            const { item, pageLocalIndex } = list[i];
            const node = this.dynamicNodes[i];
            
            // 确保节点激活前清除所有选中效果（防止复用节点时残留）
            this.applyYellowFilter(node, false);
            
            node.active = true;

            const col = i % this.COLS;
            const row = Math.floor(i / this.COLS);
            const x = originX + col * (cellW + this.GAP);
            const y = originY - row * (cellH + this.GAP);
            node.setPosition(x, y);
            
            this.applyItemIcon(node, item.item_id);
            const labelNode = node.getChildByName('Label');
            let lbl = labelNode ? labelNode.getComponent(Label) : null;
            if (!lbl) { const firstLabel = node.getComponent(Label); if (firstLabel) { lbl = firstLabel; } }
            if (lbl) { lbl.string = String(item.quantity); }
            
            this.bindItemEvents(node, item.item_id, pageLocalIndex);
            
        }

        // 多余的节点隐藏掉，不销毁，下次复用，减少 GC 压力
        for (let i = list.length; i < this.dynamicNodes.length; i++) {
            const node = this.dynamicNodes[i];
            if (node && node.isValid) {
                node.active = false;
            }
        }
    }

    /**
     * 根据 item_id 应用对应的图标
     * @param node 物品节点
     * @param itemId 物品ID
     */
    private applyItemIcon(node: Node, itemId: number) {
        const spr = node.getComponent(Sprite);
        const btn = node.getComponent(Button);
        if (!spr) {
            console.warn(`⚠️ [BagItem] 节点缺少 Sprite 组件`);
            return;
        }

        // 检查数据是否已加载
        if (!this.itemsDataLoaded) {
            console.warn(`⚠️ [BagItem] Items.json 尚未加载完成，物品 ${itemId} 使用默认图标`);
            return;
        }

        // 从 Items.json 获取物品数据
        const itemData = this.itemDataMap.get(itemId);
        if (!itemData || !itemData.iconIndex) {
            console.warn(`⚠️ [BagItem] 物品 ${itemId} 没有找到对应的图标数据 (itemDataMap大小: ${this.itemDataMap.size})`);
            return;
        }

        const iconIndex = itemData.iconIndex;
        
        // 所有图标已统一到 UI2 图集，使用连字符格式（如 IconSet2-9、IconSet2-232、IconSet2-257 等）
        // 根据 iconIndex 格式选择图集：连字符格式 -> UI2 图集，下划线格式 -> IconSet2 图集（已废弃）
        const useUI2Atlas = iconIndex.includes('-');
        const atlas: SpriteAtlas | null = useUI2Atlas ? this.ui2Atlas : this.iconSet2Atlas;

        if (!atlas) {
            console.error(`❌ [BagItem] 图集未设置: ${useUI2Atlas ? 'UI2' : 'IconSet2'}，请在编辑器中设置图集属性`);
            return;
        }

        // 从图集中获取 SpriteFrame
        let sf: SpriteFrame | null = null;
        const cacheKey = `${useUI2Atlas ? 'UI2' : 'IconSet2'}_${iconIndex}`;
        
        // 先检查缓存
        const cached = this.spriteCache.get(cacheKey);
        if (cached) {
            sf = cached;
        } else {
            // 尝试多种名称格式（兼容不同命名方式）
            const tryNames = [iconIndex]; // 优先使用原始名称
            
            // 如果包含连字符，也尝试下划线格式
            if (iconIndex.includes('-')) {
                tryNames.push(iconIndex.replace(/-/g, '_'));
            }
            
            // 如果包含下划线，也尝试连字符格式
            if (iconIndex.includes('_')) {
                tryNames.push(iconIndex.replace(/_/g, '-'));
            }
            
            // 依次尝试所有可能的名称
            for (const name of tryNames) {
                sf = atlas.getSpriteFrame(name);
                if (sf) {
                    break;
                }
            }
            
            if (sf) {
                this.spriteCache.set(cacheKey, sf);
            }
        }

        if (sf) {
            spr.spriteFrame = sf;
            if (btn) { (btn as any).normalSprite = sf; }
        } else {
            console.error(`❌ [BagItem] 在图集中未找到图标: ${iconIndex} (图集: ${useUI2Atlas ? 'UI2' : 'IconSet2'})`);
        }
    }

    private onNetworkDisconnectBag = () => {
        this.cancelDragState();
        UILockManager.instance.forceUnlockAll();
        this.resetMainActionButtons();
    };

    private resetMainActionButtons() {
        const list = [this.useBtn, this.discardBtn, this.useItemButton, this.nextPageBtn, this.prevPageBtn, this.testWriteBtn, this.testFetchBtn, this.itemBtn, this.weaponBtn, this.armorBtn, this.otherBtn, this.closeBtn];
        for (const b of list) {
            if (b) b.interactable = true;
        }
    }

    private canActThrottle(ms: number): boolean {
        const n = Date.now();
        if (n - this._lastUiThrottleTs < ms) return false;
        this._lastUiThrottleTs = n;
        return true;
    }

    private onSortCurrentCategory() {
        if (!this.canActThrottle(320)) return;
        const cid = this.ws.getCharacterId?.() || undefined;
        if (!cid) return;
        if (!UILockManager.instance.tryLock('bag', this.REQUEST_TIMEOUT + 500)) {
            this.showErrorTips('操作进行中', false);
            return;
        }
        this.ws.request(
            GameConfig.MESSAGE_TYPES.BAG_SORT,
            { character_id: cid, category: this.currentCategory },
            (resp: any) => {
                UILockManager.instance.unlock('bag');
                this.localBagVersion = 0;
                if (!resp || !resp.success) {
                    this.showErrorTips(resp?.message || resp?.error || '整理失败', false);
                }
                this.requestFetchBag();
                BagEventHub.emit('bag', { kind: 'mutated', mutation: 'sort', success: !!(resp && resp.success), raw: resp });
            },
            true,
            this.REQUEST_TIMEOUT,
        );
    }

    private sendBagMove(fromSlot: number, toSlot: number) {
        if (fromSlot === toSlot || fromSlot < 0 || toSlot < 0) return;
        const cid = this.ws.getCharacterId?.() || undefined;
        if (!cid) return;
        if (!UILockManager.instance.tryLock('bag', this.REQUEST_TIMEOUT + 500)) {
            this.showErrorTips('操作进行中', false);
            return;
        }
        this.ws.request(
            GameConfig.MESSAGE_TYPES.BAG_MOVE_ITEM,
            {
                character_id: cid,
                category: this.currentCategory,
                from_slot: fromSlot,
                to_slot: toSlot,
            },
            (resp: any) => {
                UILockManager.instance.unlock('bag');
                this.localBagVersion = 0;
                if (!resp || !resp.success) {
                    this.showErrorTips(resp?.message || resp?.error || '移动失败', false);
                }
                this.requestFetchBag();
                BagEventHub.emit('bag', { kind: 'mutated', mutation: 'move', success: !!(resp && resp.success), raw: resp });
            },
            true,
            this.REQUEST_TIMEOUT,
        );
    }

    private pickSlotIndexAtUi(ui: Vec2): number {
        const p = new Vec3(ui.x, ui.y, 0);
        for (let i = 0; i < this.dynamicNodes.length; i++) {
            const node = this.dynamicNodes[i];
            if (!node || !node.active) continue;
            const ut = node.getComponent(UITransform);
            if (!ut) continue;
            const lp = ut.convertToNodeSpaceAR(p);
            const hw = ut.width * 0.5;
            const hh = ut.height * 0.5;
            if (lp.x >= -hw && lp.x <= hw && lp.y >= -hh && lp.y <= hh) {
                const s = (node as any).__bagSlot;
                return typeof s === 'number' ? s : (this.currentPage - 1) * this.PAGE_SIZE + i;
            }
        }
        return -1;
    }

    private cancelDragState() {
        if (this._dragFromNode && this._dragFromNode.isValid) {
            const op = this._dragFromNode.getComponent(UIOpacity);
            if (op) op.opacity = 255;
        }
        this._dragFromSlot = -1;
        this._dragFromNode = null;
        this._dragging = false;
    }

    private onBagTouchStart(e: EventTouch) {
        const node = e.currentTarget as Node;
        const slot = (node as any).__bagSlot as number | undefined;
        if (slot === undefined || this.isProcessingUseItem || this.isProcessingDiscardItem) return;
        this._dragFromSlot = slot;
        this._dragFromNode = node;
        this._dragging = false;
        e.getUILocation(this._dragStartUIPos);
    }

    private onBagTouchMove(e: EventTouch) {
        if (this._dragFromSlot < 0) return;
        const cur = e.getUILocation(new Vec2());
        const dx = cur.x - this._dragStartUIPos.x;
        const dy = cur.y - this._dragStartUIPos.y;
        if (!this._dragging && Math.hypot(dx, dy) > 12) {
            this._dragging = true;
            this.cancelDelayedIntro();
            const n = this._dragFromNode;
            if (n && n.isValid) {
                let op = n.getComponent(UIOpacity);
                if (!op) op = n.addComponent(UIOpacity);
                op.opacity = 160;
            }
        }
    }

    private onBagTouchEnd(e: EventTouch) {
        if (this._dragFromSlot < 0) return;
        if (this._dragging) {
            const cur = e.getUILocation(new Vec2());
            const to = this.pickSlotIndexAtUi(cur);
            if (to >= 0 && to !== this._dragFromSlot) {
                this.sendBagMove(this._dragFromSlot, to);
            }
            const n = this._dragFromNode;
            if (n && n.isValid) (n as any)._suppressClickOnce = true;
        }
        if (this._dragFromNode && this._dragFromNode.isValid) {
            const op = this._dragFromNode.getComponent(UIOpacity);
            if (op) op.opacity = 255;
        }
        this._dragFromSlot = -1;
        this._dragFromNode = null;
        this._dragging = false;
    }

    private onBagTouchCancel(e: EventTouch) {
        this.onBagTouchEnd(e);
    }

    /**
     * 绑定物品格子的点击和悬浮事件
     * @param node 物品格子节点
     * @param itemId 物品ID
     * @param itemIndexInPage 当前页内的索引（0-based），用于计算slot_index
     */
    private bindItemEvents(node: Node, itemId: number, itemIndexInPage: number) {
        const btn = node.getComponent(Button);
        if (!btn) return;

        const globalSlot = (this.currentPage - 1) * this.PAGE_SIZE + itemIndexInPage;
        (node as any).__bagSlot = globalSlot;

        // 关键修复：确保按钮是可交互的（防止场景切换后按钮被禁用）
        btn.interactable = true;
        
        // 设置Button的Transition为NONE，防止按下时图片切换
        btn.transition = Button.Transition.NONE;

        // 先移除可能存在的旧事件监听，避免重复绑定
        btn.node.off(Button.EventType.CLICK);
        node.off(Node.EventType.MOUSE_ENTER);
        node.off(Node.EventType.MOUSE_LEAVE);
        node.off(Node.EventType.TOUCH_START, this.onBagTouchStart, this);
        node.off(Node.EventType.TOUCH_MOVE, this.onBagTouchMove, this);
        node.off(Node.EventType.TOUCH_END, this.onBagTouchEnd, this);
        node.off(Node.EventType.TOUCH_CANCEL, this.onBagTouchCancel, this);

        // 点击事件 - 设置标志，防止被全局事件清除选中
        btn.node.on(Button.EventType.CLICK, () => {
            this._clickedOnItem = true; // 设置标志
            this.onItemClick(node, itemId, itemIndexInPage);
            // 延迟清除标志，让全局事件知道这是物品点击
            this.scheduleOnce(() => {
                this._clickedOnItem = false;
            }, 0.2); // 延迟200ms，比全局事件的延迟长
        }, this);

        // 鼠标进入事件（悬浮）
        node.on(Node.EventType.MOUSE_ENTER, () => {
            if (this.selectedItemNode !== node) {
                this.onItemHover(node, itemId);
            }
        }, this);

        // 鼠标离开事件
        node.on(Node.EventType.MOUSE_LEAVE, () => {
            if (this.hoveredItemNode === node && this.selectedItemNode !== node) {
                this.onItemHoverLeave(node);
            }
        }, this);

        node.on(Node.EventType.TOUCH_START, this.onBagTouchStart, this);
        node.on(Node.EventType.TOUCH_MOVE, this.onBagTouchMove, this);
        node.on(Node.EventType.TOUCH_END, this.onBagTouchEnd, this);
        node.on(Node.EventType.TOUCH_CANCEL, this.onBagTouchCancel, this);
    }

    /**
     * 处理物品格子点击事件（支持双击）
     * MMO最佳实践：确保选中状态的一致性，防止操作冲突
     * @param node 物品格子节点
     * @param itemId 物品ID
     * @param itemIndexInPage 当前页内的索引（0-based），用于计算slot_index
     */
    private onItemClick(node: Node, itemId: number, itemIndexInPage: number) {
        if ((node as any)._suppressClickOnce) {
            (node as any)._suppressClickOnce = false;
            return;
        }
        // 如果正在处理操作，忽略点击（防止状态混乱）
        if (this.isProcessingUseItem || this.isProcessingDiscardItem) {
            console.warn('⚠️ [BagItem] 操作进行中，忽略点击');
            return;
        }
        
        // 验证节点有效性
        if (!node || !node.isValid) {
            console.warn('⚠️ [BagItem] 节点无效，忽略点击');
            return;
        }
        // 双击检测：如果点击的是同一个物品，且在双击时间间隔内
        const now = Date.now();
        const isDoubleClick = (
            this.lastClickItemId === itemId &&
            this.lastClickTime > 0 &&
            (now - this.lastClickTime) < this.DOUBLE_CLICK_INTERVAL
        );

        // 更新双击检测状态
        this.lastClickItemId = itemId;
        this.lastClickTime = now;

        // 如果是双击，显示使用窗口（双击前也需要设置选中状态）
        if (isDoubleClick) {
            this.cancelDelayedIntro();
            // 清除之前的选中状态
            if (this.selectedItemNode && this.selectedItemNode !== node) {
                this.clearSelection();
            }
            // 设置新的选中状态
            this.selectedItemNode = node;
            this.selectedItemId = itemId;
            this.selectedItemSlotIndex = (this.currentPage - 1) * this.PAGE_SIZE + itemIndexInPage;
            // 应用选中效果
            this.applyYellowFilter(node, true);
            console.log(`🎯 [BagItem] 双击选中物品 ${itemId}，当前页: ${this.currentPage}，页内索引: ${itemIndexInPage}，全局slot_index: ${this.selectedItemSlotIndex}`);
            this.showUseItemPanel(itemId);
            return;
        }

        // 如果点击的是已选中的物品，则取消选中
        if (this.selectedItemNode === node && this.selectedItemId === itemId) {
            this.clearSelection();
            return;
        }

        // 清除之前的选中状态（确保单选）
        if (this.selectedItemNode && this.selectedItemNode !== node) {
            this.clearSelection();
        }

        // 设置新的选中状态
        this.selectedItemNode = node;
        this.selectedItemId = itemId;
        // 计算选中物品在当前分类中的全局slot索引（MMO最佳实践：精确标识物品位置）
        // slot_index = (当前页 - 1) * 每页大小 + 当前页内的索引（0-based）
        this.selectedItemSlotIndex = (this.currentPage - 1) * this.PAGE_SIZE + itemIndexInPage;
        console.log(`🎯 [BagItem] 选中物品 ${itemId}，当前页: ${this.currentPage}，页内索引: ${itemIndexInPage}，全局slot_index: ${this.selectedItemSlotIndex}`);

        // 清除悬浮状态（点击时应该关闭悬浮显示的简介）
        if (this.hoveredItemNode && this.hoveredItemNode !== node) {
            this.onItemHoverLeave(this.hoveredItemNode);
        }
        this.hoveredItemNode = null; // 点击后清除悬浮状态

        // 应用黄色滤镜
        this.applyYellowFilter(node, true);

        // 延迟显示简介，避免挡住格子导致第二次点击（双击）被详情截获而无法打开使用面板
        this.cancelDelayedIntro();
        const cb = () => {
            if (this.selectedItemNode === node && this.selectedItemId === itemId) {
                this.showIntroduction(itemId, node);
            }
            this._delayedIntroCallback = null;
        };
        this._delayedIntroCallback = cb;
        this.scheduleOnce(cb, 0.32);
    }

    /**
     * 处理物品格子悬浮事件
     * @param node 物品格子节点
     * @param itemId 物品ID
     */
    private onItemHover(node: Node, itemId: number) {
        // 如果已经有选中的物品，悬浮时不显示简介（选中状态优先）
        if (this.selectedItemNode) {
            return;
        }

        // 如果之前有悬浮的格子，先关闭它的简介
        if (this.hoveredItemNode && this.hoveredItemNode !== node) {
            this.onItemHoverLeave(this.hoveredItemNode);
        }

        // 设置当前悬浮的格子
        this.hoveredItemNode = node;

        // 显示简介面板（悬浮时），传入node以便获取图标
        this.showIntroduction(itemId, node);
    }

    /**
     * 处理物品格子悬浮离开事件
     * @param node 物品格子节点
     */
    private onItemHoverLeave(node: Node) {
        // 如果这个节点不是选中的，关闭它的简介面板
        if (this.selectedItemNode !== node) {
            if (this.introductionPanel) {
                this.introductionPanel.active = false;
            }
            this._introductionForItemId = null;
            this._introductionForItemNode = null;
            this._introductionForItemIndex = -1;
            this.hoveredItemNode = null;
        }
    }

    /**
     * 显示物品简介面板（使用统一的 Introduction 面板，根据格子位置动态偏移）
     * @param itemId 物品ID
     * @param itemNode 物品格子节点
     */
    private showIntroduction(itemId: number, itemNode: Node) {
        if (!itemNode) {
            console.warn('⚠️ [BagItem] 物品节点未提供');
            return;
        }

        if (!this.itemsDataLoaded) {
            console.warn('⚠️ [BagItem] Items.json 尚未加载完成');
            return;
        }

        const itemData = this.itemDataMap.get(itemId);
        if (!itemData) {
            console.warn(`⚠️ [BagItem] 物品 ${itemId} 没有找到对应的数据`);
            return;
        }

        const introPanel = this.introductionPanel;
        if (!introPanel) {
            console.warn('⚠️ [BagItem] 未在 BagItem 脚本上绑定 Introduction 面板节点');
            return;
        }

        this._introductionForItemId = itemId;
        this._introductionForItemNode = itemNode;
        this._introductionForItemIndex = this.dynamicNodes.indexOf(itemNode);

        // 显示面板
        introPanel.active = true;

        // === 按你说的：保持与模板格子的相对偏移不变，第7-10列往左偏移190 ===
        try {
            // 假设 cellTemplate 和 introductionPanel 在同一画布下，这里用世界坐标计算偏移
            if (!this.introWorldOffset && this.cellTemplate) {
                const templateWorld = this.cellTemplate.worldPosition;
                const introWorld = introPanel.worldPosition;
                this.introWorldOffset = new Vec3(
                    introWorld.x - templateWorld.x,
                    introWorld.y - templateWorld.y,
                    introWorld.z - templateWorld.z,
                );
            }

            const bag = this.bagRoot || this.cellTemplate.parent;
            if (bag && this.introWorldOffset) {
                const bagUT = bag.getComponent(UITransform);

                // 找到当前格子是第几列（索引从0开始，第1列=索引0，第7列=索引6）
                let col = 0;
                const nodeIndex = this.dynamicNodes.indexOf(itemNode);
                if (nodeIndex >= 0) {
                    col = nodeIndex % this.COLS;
                }

                // 当前格子的世界坐标 + 当初模板格子到面板的偏移 = 面板新的世界坐标
                const itemWorld = itemNode.worldPosition;
                let offsetX = this.introWorldOffset.x;
                let offsetY = this.introWorldOffset.y;
                let offsetZ = this.introWorldOffset.z;

                // 第7-10列（索引6-9）往左偏移190像素
                if (col >= 6 && col <= 9) {
                    offsetX -= 190;
                }

                const targetWorld = new Vec3(
                    itemWorld.x + offsetX,
                    itemWorld.y + offsetY,
                    itemWorld.z + offsetZ,
                );

                // 转回 bag 的本地坐标设置位置
                const localPos = new Vec3();
                if (bagUT) {
                    bagUT.convertToNodeSpaceAR(targetWorld, localPos);
                } else {
                    bag.inverseTransformPoint(localPos, targetWorld);
                }

                introPanel.setPosition(localPos.x, localPos.y, 0);
                // 放到最上层，避免被遮挡
                introPanel.setSiblingIndex(introPanel.parent!.children.length - 1);
            }
        } catch (e) {
            console.warn('⚠️ [BagItem] 设置 Introduction 面板位置失败:', e);
        }

        // 获取Introduction面板的子节点
        const iconNode = introPanel.getChildByName('Icon');
        const nameNode = introPanel.getChildByName('Name');
        const categoryNode = introPanel.getChildByName('Category');
        const effectNode = introPanel.getChildByName('Effect');
        const priceNode = introPanel.getChildByName('Price');
        const requireLevelNode = introPanel.getChildByName('RequireLevel');
        const applicableMechaNode = introPanel.getChildByName('ApplicableMecha');

        // 设置Icon图标（与物品图标一致，使用Button的normalSprite确保图片一致且不会改变）
        if (iconNode) {
            const iconSprite = iconNode.getComponent(Sprite);
            if (iconSprite) {
                const btn = itemNode.getComponent(Button);
                
                // 必须使用Button的normalSprite（原始图标，不会因为按下而改变）
                let targetFrame: SpriteFrame | null = null;
                if (btn && (btn as any).normalSprite) {
                    targetFrame = (btn as any).normalSprite as SpriteFrame;
                } else {
                    // 如果Button没有normalSprite，从itemData重新加载图标
                    console.warn('⚠️ [BagItem] Button没有normalSprite，从itemData重新加载图标');
                    this.applyItemIconToSprite(iconNode, itemId);
                    return; // 已经设置了，直接返回
                }
                
                if (targetFrame) {
                    iconSprite.spriteFrame = targetFrame;
                } else {
                    // 如果无法从节点获取图标，从itemData获取图标
                    this.applyItemIconToSprite(iconNode, itemId);
                }
            }
        }

        // 设置Name（直接使用节点上的Label组件）
        if (nameNode) {
            const nameLabel = nameNode.getComponent(Label);
            if (nameLabel) {
                nameLabel.string = itemData.name || '';
            }
        }

        // 设置Category（直接使用节点上的Label组件）
        if (categoryNode) {
            const categoryLabel = categoryNode.getComponent(Label);
            if (categoryLabel) {
                let categoryText = '';
                const itypeId = itemData.itypeId || 1;
                // 分类映射：1=Items, 2=Weapon+Gun(武器), 3=Wing+Dun+Armor(护甲)
                if (itypeId === 1) {
                    categoryText = '物品';
                } else if (itypeId === 2 || itypeId === 3) {
                    // Weapon, Gun -> 武器
                    categoryText = '武器';
                } else if (itypeId === 4 || itypeId === 5 || itypeId === 6) {
                    // Wing, Dun, Armor -> 护甲
                    categoryText = '护甲';
                } else {
                    categoryText = '其他';
                }
                if (itemData.consumable) {
                    categoryText += '/可使用';
                }
                categoryLabel.string = categoryText;
            }
        }

        // 设置Effect（使用子节点的Label组件）
        // 优先显示 effecttext（用户友好的描述），如果没有则显示 effect（技术性字符串）
        if (effectNode) {
            const effectLabelNode = effectNode.getChildByName('Label');
            const effectLabel = effectLabelNode ? effectLabelNode.getComponent(Label) : null;
            if (effectLabel) {
                // 优先使用 effecttext，如果没有则使用 effect
                const displayText = itemData.effecttext || itemData.effect || '';
                effectLabel.string = displayText;
            }
        }

        // 设置Price（使用子节点的Label组件）
        if (priceNode) {
            const priceLabelNode = priceNode.getChildByName('Label');
            const priceLabel = priceLabelNode ? priceLabelNode.getComponent(Label) : null;
            if (priceLabel) {
                priceLabel.string = String(itemData.price || 0);
            }
        }

        // 设置RequireLevel（需要装备等级）
        if (requireLevelNode) {
            const requireLevelLabelNode = requireLevelNode.getChildByName('Label');
            const requireLevelLabel = requireLevelLabelNode ? requireLevelLabelNode.getComponent(Label) : null;
            if (requireLevelLabel) {
                const requiredLevel = itemData.requiredLevel || 0;
                if (requiredLevel > 0) {
                    requireLevelLabel.string = String(requiredLevel);
                } else {
                    requireLevelLabel.string = '无';
                }
            }
        }

        // 设置ApplicableMecha（适用机甲类型）
        if (applicableMechaNode) {
            const applicableMechaLabelNode = applicableMechaNode.getChildByName('Label');
            const applicableMechaLabel = applicableMechaLabelNode ? applicableMechaLabelNode.getComponent(Label) : null;
            if (applicableMechaLabel) {
                const itypeId = itemData.itypeId || 1;
                let applicableText = '无';
                
                // 如果是物品（itypeId === 1），显示"无"
                if (itypeId !== 1) {
                    // 是装备，需要判断适配的机甲类型
                    const equipmentType = itemData.type || 0;
                    const applicableTypes: string[] = [];
                    
                    // 职业固定装备（type 8-22）
                    if (equipmentType >= 8 && equipmentType <= 22) {
                        // 根据 type 判断适配的职业
                        // type 8, 11, 14, 17, 20 -> 格斗型（Class 1）
                        // type 9, 12, 15, 18, 21 -> 射击型（Class 2）
                        // type 10, 13, 16, 19, 22 -> 全能型（Class 3）
                        if (equipmentType === 8 || equipmentType === 11 || equipmentType === 14 || equipmentType === 17 || equipmentType === 20) {
                            applicableTypes.push('格斗');
                        } else if (equipmentType === 9 || equipmentType === 12 || equipmentType === 15 || equipmentType === 18 || equipmentType === 21) {
                            applicableTypes.push('射击');
                        } else if (equipmentType === 10 || equipmentType === 13 || equipmentType === 16 || equipmentType === 19 || equipmentType === 22) {
                            applicableTypes.push('全能');
                        }
                    }
                    // 武器（type 1, 2）
                    else if (equipmentType === 1 || equipmentType === 2) {
                        if (equipmentType === 1) {
                            // 重型武器：格斗型
                            applicableTypes.push('格斗');
                        } else {
                            // 轻型武器：格斗型、全能型
                            applicableTypes.push('格斗', '全能');
                        }
                    }
                    // 枪械（type 6, 7）
                    else if (equipmentType === 6 || equipmentType === 7) {
                        if (equipmentType === 6) {
                            // 重型枪械：射击型
                            applicableTypes.push('射击');
                        } else {
                            // 轻型枪械：射击型、全能型
                            applicableTypes.push('射击', '全能');
                        }
                    }
                    // 通用装备（type 3, 4, 5）：盾牌、机翼、芯片
                    else if (equipmentType === 3 || equipmentType === 4 || equipmentType === 5) {
                        // 所有机甲都可以装备
                        applicableTypes.push('格斗', '射击', '全能');
                    }
                    
                    if (applicableTypes.length > 0) {
                        applicableText = applicableTypes.join('、');
                    }
                }
                
                applicableMechaLabel.string = applicableText;
            }
        }
    }

    /**
     * 将物品图标应用到指定的Sprite节点
     * @param node 目标节点
     * @param itemId 物品ID
     */
    private applyItemIconToSprite(node: Node, itemId: number) {
        const spr = node.getComponent(Sprite);
        if (!spr) return;

        const itemData = this.itemDataMap.get(itemId);
        if (!itemData || !itemData.iconIndex) return;

        const iconIndex = itemData.iconIndex;
        // 所有图标已统一到 UI2 图集，使用连字符格式
        const useUI2Atlas = iconIndex.includes('-');
        const atlas: SpriteAtlas | null = useUI2Atlas ? this.ui2Atlas : this.iconSet2Atlas;

        if (!atlas) return;

        const cacheKey = `${useUI2Atlas ? 'UI2' : 'IconSet2'}_${iconIndex}`;
        let sf: SpriteFrame | null = this.spriteCache.get(cacheKey);
        
        if (!sf) {
            // 尝试多种名称格式（兼容不同命名方式）
            const tryNames = [iconIndex]; // 优先使用原始名称
            
            // 如果包含连字符，也尝试下划线格式
            if (iconIndex.includes('-')) {
                tryNames.push(iconIndex.replace(/-/g, '_'));
            }
            
            // 如果包含下划线，也尝试连字符格式
            if (iconIndex.includes('_')) {
                tryNames.push(iconIndex.replace(/_/g, '-'));
            }
            
            // 依次尝试所有可能的名称
            for (const name of tryNames) {
                sf = atlas.getSpriteFrame(name);
                if (sf) {
                    break;
                }
            }
            
            if (sf) {
                this.spriteCache.set(cacheKey, sf);
            }
        }

        if (sf) {
            spr.spriteFrame = sf;
        }
    }

    /**
     * 应用或移除黄色滤镜（50%透明的纯色覆盖层）
     * 确保滤镜与物品格子完全对齐：大小、位置、锚点都一致
     * @param node 物品格子节点
     * @param apply 是否应用滤镜
     */
    private applyYellowFilter(node: Node, apply: boolean) {
        // 检查节点有效性
        if (!node || !node.isValid) {
            return;
        }
        
        if (apply) {
            // 检查是否已经有滤镜覆盖层
            let filterNode = node.getChildByName('YellowFilter');
            if (!filterNode) {
                // 创建黄色滤镜覆盖层
                filterNode = new Node('YellowFilter');
                const uiTransform = filterNode.addComponent(UITransform);
                const baseUT = node.getComponent(UITransform);
                
                if (!baseUT) {
                    console.warn('⚠️ [BagItem] 物品格子节点缺少UITransform组件');
                    return;
                }
                
                // 确保尺寸完全一致
                uiTransform.width = baseUT.width;
                uiTransform.height = baseUT.height;
                
                // 确保锚点完全一致（这是关键！）
                uiTransform.anchorX = baseUT.anchorX;
                uiTransform.anchorY = baseUT.anchorY;
                
                // 设置位置为(0, 0, 0)，确保与父节点完全对齐
                // 由于锚点已经匹配，位置(0,0)应该让滤镜完全覆盖父节点
                filterNode.setPosition(0, 0, 0);
                
                // 确保父节点设置正确（添加到node）
                node.addChild(filterNode);
                
                // 用 Graphics 画纯色矩形，避免“浅浅小图标”叠加（node 复用时最容易出错）
                const g = filterNode.addComponent(Graphics);
                g.clear();
                g.fillColor = new Color(255, 255, 0, 90);
                const ox = -baseUT.width * baseUT.anchorX;
                const oy = -baseUT.height * baseUT.anchorY;
                g.rect(ox, oy, baseUT.width, baseUT.height);
                g.fill();
                
                // 将滤镜节点移到最上层，确保它覆盖所有子节点
                filterNode.setSiblingIndex(node.children.length - 1);
                
                // 确保滤镜节点不会被其他节点遮挡
                // 注意：不需要监听Button状态变化，因为我们使用的是normalSprite，它不会改变
            } else {
                filterNode.active = true;
                // 重新同步尺寸，以防父节点尺寸改变
                const uiTransform = filterNode.getComponent(UITransform);
                const baseUT = node.getComponent(UITransform);
                if (uiTransform && baseUT) {
                    uiTransform.width = baseUT.width;
                    uiTransform.height = baseUT.height;
                    uiTransform.anchorX = baseUT.anchorX;
                    uiTransform.anchorY = baseUT.anchorY;
                    const g = filterNode.getComponent(Graphics);
                    if (g) {
                        g.clear();
                        g.fillColor = new Color(255, 255, 0, 90);
                        const ox = -baseUT.width * baseUT.anchorX;
                        const oy = -baseUT.height * baseUT.anchorY;
                        g.rect(ox, oy, baseUT.width, baseUT.height);
                        g.fill();
                    }
                }
            }
        } else {
            // 移除滤镜
            const filterNode = node.getChildByName('YellowFilter');
            if (filterNode) {
                filterNode.active = false;
            }
        }
    }

    /**
     * 清除选中状态
     */
    private clearSelection() {
        this.cancelDelayedIntro();
        // 移除黄色滤镜（检查节点有效性）
        if (this.selectedItemNode && this.selectedItemNode.isValid) {
            this.applyYellowFilter(this.selectedItemNode, false);
        }

        // 隐藏统一简介面板
        if (this.introductionPanel) {
            this.introductionPanel.active = false;
        }
        this._introductionForItemId = null;
        this._introductionForItemNode = null;
        this._introductionForItemIndex = -1;

        // 清除选中状态
        this.selectedItemNode = null;
        this.selectedItemId = null;
        this.selectedItemSlotIndex = -1;
        this.hoveredItemNode = null;
        this._discardArmed = false;
        if (this._discardArmTimer) {
            clearTimeout(this._discardArmTimer);
            this._discardArmTimer = null;
        }
    }

    /**
     * 显示使用物品窗口
     * @param itemId 物品ID
     */
    private showUseItemPanel(itemId: number) {
        if (!this.useItemPanel) {
            console.warn('⚠️ [BagItem] 未绑定 UseItem 面板节点');
            return;
        }

        this.cancelDelayedIntro();
        // 关闭详情窗口
        if (this.introductionPanel) {
            this.introductionPanel.active = false;
        }
        this._introductionForItemId = null;
        this._introductionForItemNode = null;
        this._introductionForItemIndex = -1;

        // 取消选中状态（但保留 selectedItemId 用于使用/丢弃操作）
        if (this.selectedItemNode) {
            this.applyYellowFilter(this.selectedItemNode, false);
        }
        this.hoveredItemNode = null;

        // 显示使用窗口
        // 注意：不改变面板的图层顺序，保持编辑器中的原始顺序
        this.useItemPanel.active = true;

        // 更新使用窗口内的物品信息（如果需要显示物品详情）
        // 这里可以根据需要填充 UseItem 窗口内的图标、名称等信息
        // 暂时只显示窗口，具体内容可以根据你的 UI 结构来填充
    }

    /**
     * 关闭使用物品窗口
     */
    private closeUseItemPanel() {
        if (this.useItemPanel) {
            // 直接隐藏，不改变图层顺序（保持编辑器中的原始顺序）
            this.useItemPanel.active = false;
        }
        // 清除待使用状态
        this.pendingUseItemId = null;
        this.pendingUseItemNode = null;
        // 清除 RobotList 的回调并关闭机甲列表（如果打开了）
        if (this.robotList) {
            this.robotList.clearCallbacks();
            if (this.robotList.node) {
                this.robotList.node.active = false;
            }
        }
        // 关闭后清除选中状态
        this.clearSelection();
        
        // 确保按钮等可交互元素在 mask 上方（修复图层问题）
        this.ensureButtonsAboveMask();
        this.resetMainActionButtons();
    }


    /**
     * 确保按钮等可交互元素在 mask 上方（不改变 mask 的顺序）
     * 通过将按钮移到 mask 的父节点的最后（最上方）来实现
     */
    private ensureButtonsAboveMask() {
        if (!this.panel) return;
        
        // 查找 MASK 节点
        const maskNode = this.findNodeByName(this.panel, 'MASK');
        if (!maskNode || !maskNode.parent) return;
        
        const parent = maskNode.parent;
        const maskIndex = parent.children.indexOf(maskNode);
        if (maskIndex < 0) return;
        
        // 需要移到 mask 上方的按钮节点列表（只处理在同一个父节点下的按钮）
        const buttonsToMove: Node[] = [];
        if (this.useItemButton && this.useItemButton.node && this.useItemButton.node.parent === parent) {
            buttonsToMove.push(this.useItemButton.node);
        }
        if (this.closeBtn && this.closeBtn.node && this.closeBtn.node.parent === parent) {
            buttonsToMove.push(this.closeBtn.node);
        }
        if (this.itemBtn && this.itemBtn.node && this.itemBtn.node.parent === parent) {
            buttonsToMove.push(this.itemBtn.node);
        }
        if (this.weaponBtn && this.weaponBtn.node && this.weaponBtn.node.parent === parent) {
            buttonsToMove.push(this.weaponBtn.node);
        }
        if (this.armorBtn && this.armorBtn.node && this.armorBtn.node.parent === parent) {
            buttonsToMove.push(this.armorBtn.node);
        }
        if (this.otherBtn && this.otherBtn.node && this.otherBtn.node.parent === parent) {
            buttonsToMove.push(this.otherBtn.node);
        }
        if (this.nextPageBtn && this.nextPageBtn.node && this.nextPageBtn.node.parent === parent) {
            buttonsToMove.push(this.nextPageBtn.node);
        }
        if (this.prevPageBtn && this.prevPageBtn.node && this.prevPageBtn.node.parent === parent) {
            buttonsToMove.push(this.prevPageBtn.node);
        }
        
        // 将按钮移到 mask 之后（确保在 mask 上方）
        // 使用倒序处理，避免索引变化影响
        const buttonsToMoveIndices = buttonsToMove.map(btn => parent.children.indexOf(btn)).filter(idx => idx >= 0 && idx <= maskIndex);
        
        if (buttonsToMoveIndices.length > 0) {
            // 将所有需要移动的按钮移到 mask 之后
            // 从后往前移动，避免索引变化
            buttonsToMoveIndices.sort((a, b) => b - a);
            buttonsToMoveIndices.forEach(btnIndex => {
                const btnNode = parent.children[btnIndex];
                if (btnNode && btnIndex <= maskIndex) {
                    // 移到 mask 之后的位置（maskIndex + 1）
                    // 由于我们是从后往前处理，每次移动后 maskIndex 位置不变
                    const targetIndex = maskIndex + 1;
                    if (targetIndex < parent.children.length) {
                        btnNode.setSiblingIndex(targetIndex);
                    }
                }
            });
        }
    }

    /**
     * 递归查找指定名称的节点
     */
    private findNodeByName(parent: Node, name: string): Node | null {
        if (parent.name === name) {
            return parent;
        }
        
        for (let i = 0; i < parent.children.length; i++) {
            const found = this.findNodeByName(parent.children[i], name);
            if (found) {
                return found;
            }
        }
        
        return null;
    }

    /**
     * 将 AniID 替换为指定形态（L1/L2/L3）
     */
    private convertAniIdForForm(aniId: string, targetForm: number): string {
        if (!aniId || targetForm < 1 || targetForm > 3) return aniId;
        const tag = `L${targetForm}`;
        const tags = ['L1', 'L2', 'L3'];
        for (const t of tags) {
            if (aniId.includes(t)) {
                return aniId.replace(t, tag);
            }
        }
        return aniId;
    }

    /**
     * 使用物品（MMO最佳实践：完整的状态验证和错误处理）
     * @param itemId 物品ID
     */
    private onUseItem(itemId: number) {
        // 防止重复操作（双重检查）
        if (this.isProcessingUseItem) {
            console.warn('⚠️ [BagItem] 使用物品操作正在进行中，请稍候...');
            return;
        }

        // 验证基础数据
        if (!this.itemsDataLoaded) {
            console.error('❌ [BagItem] Items.json 尚未加载完成，无法使用物品');
            return;
        }

        // 检查物品是否存在于本地数据
        const itemData = this.itemDataMap.get(itemId);
        if (!itemData) {
            console.error(`❌ [BagItem] 物品 ${itemId} 在本地 Items.json 中不存在`);
            return;
        }

        // 检查物品是否在背包中（MMO最佳实践：客户端预检查，但服务器是权威）
        const bagItem = this.items.find(item => item.item_id === itemId);
        if (!bagItem) {
            console.error(`❌ [BagItem] 物品 ${itemId} 不在当前背包中（可能已被删除或不同步）`);
            // 刷新背包数据，确保数据同步
            this.requestFetchBag();
            return;
        }

        // 验证选中状态（如果选中状态丢失，尝试恢复）
        if (!this.selectedItemId || this.selectedItemId !== itemId || this.selectedItemSlotIndex < 0) {
            console.warn(`⚠️ [BagItem] 选中状态异常，尝试恢复: selectedItemId=${this.selectedItemId}, itemId=${itemId}, slotIndex=${this.selectedItemSlotIndex}`);
            // 尝试在当前页面查找该物品并恢复选中状态
            const itemIndex = this.items.findIndex(item => item.item_id === itemId);
            if (itemIndex >= 0 && itemIndex < this.dynamicNodes.length) {
                const node = this.dynamicNodes[itemIndex];
                if (node && node.isValid) {
                    // 清除之前的选中状态
                    if (this.selectedItemNode && this.selectedItemNode !== node && this.selectedItemNode.isValid) {
                        this.applyYellowFilter(this.selectedItemNode, false);
                    }
                    // 恢复选中状态
                    this.selectedItemNode = node;
                    this.selectedItemId = itemId;
                    this.selectedItemSlotIndex = (this.currentPage - 1) * this.PAGE_SIZE + itemIndex;
                    this.applyYellowFilter(node, true);
                    console.log(`✅ [BagItem] 已恢复选中状态: 物品 ${itemId}，slot_index: ${this.selectedItemSlotIndex}`);
                } else {
                    console.error(`❌ [BagItem] 无法恢复选中状态：节点无效`);
                    return;
                }
            } else {
                console.error(`❌ [BagItem] 无法恢复选中状态：物品不在当前页面`);
                return;
            }
        }

        // 最终验证：确保选中状态完整
        if (!this.selectedItemId || this.selectedItemId !== itemId || this.selectedItemSlotIndex < 0) {
            console.error(`❌ [BagItem] 选中状态验证失败，无法使用物品`);
            return;
        }

        // 设置处理标志，防止重复操作
        this.isProcessingUseItem = true;

        // 根据 UsageTarget 判断使用方式
        const usageTarget = itemData.UsageTarget || 'Player'; // 默认为 Player
        
        if (usageTarget === 'Player') {
            // Player 类型：直接使用，消耗一个物品
            this.useItemForPlayer(itemId, itemData);
        } else if (usageTarget === 'Pet') {
            // Pet 类型：需要选择机甲后使用
            this.useItemForPet(itemId, itemData);
        } else {
            console.error(`❌ [BagItem] 未知的 UsageTarget: ${usageTarget}，物品ID: ${itemId}`);
            // 清除处理标志
            this.isProcessingUseItem = false;
        }
    }

    /**
     * 对玩家使用物品（直接消耗）
     * @param itemId 物品ID
     * @param itemData 物品数据
     */
    private useItemForPlayer(itemId: number, itemData: ItemData) {
        console.log(`🎮 [BagItem] 对玩家使用物品: ${itemData.name} (ID: ${itemId})`);
        
        const cid = this.ws.getCharacterId?.() || undefined;
        if (!cid) {
            console.error('❌ [BagItem] 无法获取角色ID，无法使用物品');
            this.isProcessingUseItem = false;
            return;
        }

        // 发送使用物品请求到服务端
        // MMO最佳实践：发送slot_index精确定位物品（在当前分类中的全局索引）
        if (this.selectedItemSlotIndex < 0) {
            console.error(`❌ [BagItem] 无法确定物品的slot索引，无法使用`);
            this.isProcessingUseItem = false;
            return;
        }

        // 设置处理标志
        this.isProcessingUseItem = true;

        if (!UILockManager.instance.tryLock('bag', this.REQUEST_TIMEOUT + 500)) {
            this.isProcessingUseItem = false;
            this.showErrorTips('操作进行中', false);
            return;
        }
        
        // 优化：使用request方法，自动生成request_id并匹配响应
        this.ws.request(
            GameConfig.MESSAGE_TYPES.BAG_USE_ITEM,
            {
                character_id: cid,
                item_id: itemId,
                target_type: 'Player',
                category: this.currentCategory, // 发送当前分类
                slot_index: this.selectedItemSlotIndex, // 发送精确的slot索引（在当前分类中的全局索引）
            },
            (response: any) => {
                // 通过request_id匹配的响应回调
                this.onUseItemResponse(response);
            },
            true, // 需要认证
            this.REQUEST_TIMEOUT // 使用配置的超时时间
        );

        // 使用窗口保持打开状态（按需求）
        // 不关闭使用窗口，等待服务端响应后刷新数据
    }

    /**
     * 对机甲使用物品（需要选择机甲）
     * @param itemId 物品ID
     * @param itemData 物品数据
     */
    private useItemForPet(itemId: number, itemData: ItemData) {
        console.log(`🤖 [BagItem] 对机甲使用物品: ${itemData.name} (ID: ${itemId})，打开机甲列表选择目标`);
        
        if (!this.robotList) {
            console.error('❌ [BagItem] RobotList 未绑定，无法选择机甲');
            // 修复点：错误路径恢复使用中的状态，避免后续操作被永久锁死
            this.isProcessingUseItem = false;
            return;
        }

        // 保存当前要使用的物品信息
        this.pendingUseItemId = itemId;
        this.pendingUseItemNode = this.selectedItemNode;

        // 先打开机甲列表节点
        if (this.robotList && this.robotList.node) {
            this.robotList.node.active = true;
        } else {
            console.error('❌ [BagItem] RobotList 未绑定或节点不存在');
            // 修复点：错误路径恢复使用中的状态，避免后续操作被永久锁死
            this.isProcessingUseItem = false;
            return;
        }

        // 设置 RobotList 的回调（必须在 show() 之前设置，避免被清除）
        this.robotList.setCallbacks(
            (petId: string, petData: any) => {
                // 确认选择机甲后使用物品（会记录使用日志）
                this.confirmUseItemForPet(itemId, petId, petData);
            },
            () => {
                // 关键修复：取消选择机甲时，必须重置操作标志，否则后续无法双击
                // 取消选择机甲（不记录日志，减少噪音）
                // 使用窗口保持打开状态，回到背包界面
                this.pendingUseItemId = null;
                this.pendingUseItemNode = null;
                // 关键修复：重置操作标志，允许后续双击
                this.isProcessingUseItem = false;
            }
        );

        // 最后调用 show()（此时回调已设置，不会被清除）
        // 从背包启动时，传入fromBag=true，隐藏Set按钮
        this.robotList.show(true);
    }

    /**
     * 确认对机甲使用物品
     * @param itemId 物品ID
     * @param petId 机甲ID
     * @param petData 机甲数据
     */
    private confirmUseItemForPet(itemId: number, petId: string, petData: any) {
        const itemData = this.itemDataMap.get(itemId);
        if (!itemData) {
            console.error(`❌ [BagItem] 物品 ${itemId} 数据不存在`);
            // 修复点：错误路径恢复使用中的状态，避免后续操作被永久锁死
            this.isProcessingUseItem = false;
            return;
        }

        console.log(`✅ [BagItem] 对机甲 ${petData.RobotName || petId} 使用物品: ${itemData.name} (ID: ${itemId})`);

        const pid = String(petId || '').trim();
        if (!pid || pid.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(pid)) {
            console.error(`❌ [BagItem] petId 无效，拒绝发送: ${petId}`);
            this.isProcessingUseItem = false;
            this.showErrorTips('机甲 ID 无效', false);
            return;
        }
        const pdataId = String(petData?.pet_id ?? petData?._id ?? petData?.id ?? '').trim();
        if (pdataId && pdataId.toLowerCase() !== pid.toLowerCase()) {
            console.error(`❌ [BagItem] petId 与所选机甲数据不一致: req=${pid} data=${pdataId}`);
            this.isProcessingUseItem = false;
            this.showErrorTips('所选机甲与请求不一致', false);
            return;
        }
        if (this.robotList && !this.robotList.isPetInCurrentList(pid)) {
            console.warn(`⚠️ [BagItem] petId 不在当前已加载列表，仍交由服务端校验: ${pid}`);
        }

        const cid = this.ws.getCharacterId?.() || undefined;
        if (!cid) {
            console.error('❌ [BagItem] 无法获取角色ID，无法使用物品');
            // 修复点：错误路径恢复使用中的状态，避免后续操作被永久锁死
            this.isProcessingUseItem = false;
            return;
        }

        // 关闭机甲列表（RobotList 的 hide 会在回调后调用）
        if (this.robotList && this.robotList.node) {
            this.robotList.hide('确认使用物品');
        }

        // 发送使用物品请求到服务端
        // MMO最佳实践：发送slot_index精确定位物品（在当前分类中的全局索引）
        // 注意：这里使用selectedItemSlotIndex，因为是在确认使用前选中的物品
        const slotIndex = this.selectedItemSlotIndex >= 0 ? this.selectedItemSlotIndex : -1;
        if (slotIndex < 0) {
            console.error(`❌ [BagItem] 无法确定物品的slot索引，无法使用`);
            this.isProcessingUseItem = false;
            return;
        }

        // 设置处理标志
        this.isProcessingUseItem = true;

        if (!UILockManager.instance.tryLock('bag', this.REQUEST_TIMEOUT + 500)) {
            this.isProcessingUseItem = false;
            this.showErrorTips('操作进行中', false);
            return;
        }
        
        // 优化：使用request方法，自动生成request_id并匹配响应
        this.ws.request(
            GameConfig.MESSAGE_TYPES.BAG_USE_ITEM,
            {
                character_id: cid,
                item_id: itemId,
                target_type: 'Pet',
                pet_id: pid,
                category: this.currentCategory, // 发送当前分类
                slot_index: slotIndex, // 发送精确的slot索引（在当前分类中的全局索引）
            },
            (response: any) => {
                // 通过request_id匹配的响应回调
                this.onUseItemResponse(response);
            },
            true, // 需要认证
            this.REQUEST_TIMEOUT // 使用配置的超时时间
        );

        // 清除待使用状态
        this.pendingUseItemId = null;
        this.pendingUseItemNode = null;

        // 使用窗口保持打开状态（按需求）
    }

    /**
     * 丢弃物品（删除整个格子）
     * @param itemId 物品ID
     */
    private onDiscardItem(itemId: number) {
        // 防止重复操作
        if (this.isProcessingDiscardItem) {
            console.warn('⚠️ [BagItem] 丢弃物品操作正在进行中，请稍候...');
            return;
        }

        if (!this.itemsDataLoaded) {
            console.error('❌ [BagItem] Items.json 尚未加载完成，无法丢弃物品');
            return;
        }

        // 检查物品是否在背包中
        const bagItem = this.items.find(item => item.item_id === itemId);
        if (!bagItem) {
            console.error(`❌ [BagItem] 物品 ${itemId} 不在当前背包中（可能已被删除或不同步）`);
            // 刷新背包数据，确保数据同步
            this.requestFetchBag();
            return;
        }

        const itemData = this.itemDataMap.get(itemId);
        const itemName = itemData ? itemData.name : `物品ID: ${itemId}`;
        const quantity = bagItem.quantity;

        console.log(`🗑️ [BagItem] 丢弃物品: ${itemName} (ID: ${itemId})，数量: ${quantity}（删除整个格子）`);

        if (!this._discardArmed) {
            this._discardArmed = true;
            if (this._discardArmTimer) clearTimeout(this._discardArmTimer);
            this._discardArmTimer = setTimeout(() => {
                this._discardArmed = false;
                this._discardArmTimer = null;
            }, 5000);
            this.showErrorTips('请再次点击「丢弃」确认', false);
            return;
        }
        this._discardArmed = false;
        if (this._discardArmTimer) {
            clearTimeout(this._discardArmTimer);
            this._discardArmTimer = null;
        }
        if (!this.canActThrottle(320)) return;
        
        const cid = this.ws.getCharacterId?.() || undefined;
        if (!cid) {
            console.error('❌ [BagItem] 无法获取角色ID，无法丢弃物品');
            // 修复点：错误路径恢复丢弃中的状态，避免后续操作被永久锁死
            this.isProcessingDiscardItem = false;
            return;
        }

        // 设置处理标志，防止重复操作
        this.isProcessingDiscardItem = true;

        // 发送丢弃物品请求到服务端（删除整个格子）
        // MMO最佳实践：发送slot_index精确定位物品（在当前分类中的全局索引）
        if (this.selectedItemSlotIndex < 0) {
            console.error(`❌ [BagItem] 无法确定物品的slot索引，无法丢弃`);
            this.isProcessingDiscardItem = false;
            return;
        }

        if (!UILockManager.instance.tryLock('bag', this.REQUEST_TIMEOUT + 500)) {
            this.isProcessingDiscardItem = false;
            this.showErrorTips('操作进行中', false);
            return;
        }

        // 优化：使用request方法，自动生成request_id并匹配响应
        this.ws.request(
            GameConfig.MESSAGE_TYPES.BAG_DISCARD_ITEM,
            {
                character_id: cid,
                item_id: itemId,
                category: this.currentCategory, // 发送当前分类
                slot_index: this.selectedItemSlotIndex, // 发送精确的slot索引（在当前分类中的全局索引）
            },
            (response: any) => {
                // 通过request_id匹配的响应回调
                this.onDiscardItemResponse(response);
            },
            true, // 需要认证
            this.REQUEST_TIMEOUT // 使用配置的超时时间
        );

        // 关闭使用窗口
        this.closeUseItemPanel();
        
        // 等待服务端响应后刷新数据（在 onDiscardItemResponse 中处理）
    }

    /**
     * 清除请求超时定时器
     */
    private clearRequestTimeout(): void {
        if (this.requestTimeoutTimer) {
            clearTimeout(this.requestTimeoutTimer);
            this.requestTimeoutTimer = null;
        }
    }

    /**
     * 处理请求超时（MMO最佳实践：超时恢复机制）
     */
    private handleRequestTimeout(): void {
        console.warn('⚠️ [BagItem] 请求超时，恢复状态并刷新数据');
        this.clearRequestTimeout();
        UILockManager.instance.unlock('bag');
        this.isProcessingUseItem = false;
        this.isProcessingDiscardItem = false;
        this.pendingRequestId = null;
        
        // 关闭使用窗口
        this.closeUseItemPanel();
        
        // 刷新背包数据（确保数据同步）
        this.requestFetchBag();
    }

    /**
     * 处理使用物品响应（优化：支持标准格式和直接格式）
     * request方法已经验证了request_id，这里直接处理响应
     */
    private onUseItemResponse = (data: any) => {
        UILockManager.instance.unlock('bag');
        // 清除处理标志
        this.isProcessingUseItem = false;

        if (!data || !data.success) {
            const errorMsg = data?.error || data?.message || '未知错误';
            console.error(`❌ [BagItem] 使用物品失败: ${errorMsg}`);
            
            // 显示失败提示
            this.showErrorTips(errorMsg, false);
            
            // 如果是因为物品不存在或数量不足，刷新背包数据
            if (errorMsg.includes('不存在') || errorMsg.includes('数量') || errorMsg.includes('不足') || errorMsg.includes('无效')) {
                console.log('🔄 [BagItem] 检测到数据不同步，刷新背包数据');
                // 关闭使用窗口
                this.closeUseItemPanel();
                // 立即刷新（MMO最佳实践：服务器是权威数据源）
                this.requestFetchBag();
            }
            return;
        }

        // ✅ 关键修复：兼容标准格式（data在data字段中）和直接格式（字段在根级别）
        const responseData = data.data || data; // 优先使用data字段，如果没有则使用根级别
        
        const itemId = responseData.item_id;
        const itemData = this.itemDataMap.get(itemId);
        const itemName = itemData ? itemData.name : `物品ID: ${itemId}`;
        const targetType = responseData.target_type || 'Unknown';

        // 对机甲生效的道具（还原晶体/经验等）：清详情缓存；Pet 目标再清列表缓存，避免回到列表仍显示旧等级
        const targetLower = String(targetType).toLowerCase();
        if (responseData.pet_id && (responseData.equipped || targetLower === 'pet')) {
            const cacheManager = DataCacheManager.getInstance();
            const pid = String(responseData.pet_id);
            cacheManager.clearRobotPetInfoCache(pid);
            if (targetLower === 'pet') {
                const cid = this.ws?.getCharacterId?.();
                if (cid) {
                    cacheManager.clearRobotPetsCache(cid);
                }
            }
            console.log(`🗑️ [BagItem] 对机甲使用物品后清除机甲缓存 (pet_id: ${pid}, equipped: ${!!responseData.equipped})`);
        }
        const targetName = responseData.target_name || (responseData.pet_id ? `机甲ID: ${responseData.pet_id}` : '玩家');
        const effectResult = responseData.effect_result || data.effect_result; // 兼容两种格式

        console.log(`✅ [BagItem] 成功使用物品: ${itemName} (ID: ${itemId})，目标: ${targetName} (${targetType})`);

        if (String(targetType).toLowerCase() === 'pet' && responseData.pet_id) {
            emitRobotDataUpdated({
                petId: String(responseData.pet_id),
                character_id: this.ws?.getCharacterId?.() || undefined,
            });
            emitBattleTeamUpdated({ character_id: this.ws?.getCharacterId?.() || undefined });
        }

        // 显示成功提示
        const successMsg = `成功使用物品: ${itemName}`;
        this.showErrorTips(successMsg, true);

        // 显示效果结果（如果有）
        if (effectResult && effectResult.success) {
            console.log(`✨ [BagItem] 效果应用成功: ${effectResult.message || '无消息'}`);
            
            // 显示详细效果信息
            if (effectResult.results && effectResult.results.length > 0) {
                effectResult.results.forEach((result: any, index: number) => {
                    if (result.success) {
                        console.log(`  [效果 ${index + 1}] ${result.effect_type}: ${result.message || ''}`);
                        
                        // 显示升级信息（如果有）
                        if (result.data && result.data.level_up_count > 0) {
                            console.log(`    🎉 升级了 ${result.data.level_up_count} 级！`);
                        }
                    }
                });

                // 触发进化动画（在关闭窗口之前，确保动画能正常播放）
                const evolve = effectResult.results.find((r: any) => r.effect_type === 'PET_EVOLVE' && r.success);
                if (evolve && evolve.data) {
                    const newForm = evolve.data.new_form;
                    const newAniId: string = evolve.data.ani_id || '';
                    const oldAniId = (typeof newForm === 'number' && newForm > 1)
                        ? this.convertAniIdForForm(newAniId, newForm - 1)
                        : '';
                    const evolver = RobotEvolutionEffect.getInstance();
                    if (evolver) {
                        console.log(`🎬 [BagItem] 触发进化动画: ${oldAniId} -> ${newAniId}`);
                        evolver.playEvolution(oldAniId, newAniId);
                    }
                }
            }
        }

        // ✅ 关键修复：延迟关闭窗口和刷新背包，确保进化动画有时间播放
        // 先延迟关闭窗口，给进化动画时间启动（如果有进化动画，延迟更长）
        const hasEvolution = effectResult && effectResult.results && 
            effectResult.results.some((r: any) => r.effect_type === 'PET_EVOLVE' && r.success);
        const delayTime = hasEvolution ? 0.2 : 0.05; // 有进化动画时延迟200ms，否则50ms
        
        this.scheduleOnce(() => {
            // 关闭使用窗口（会自动恢复到合适位置）
            this.closeUseItemPanel();
            
            // MMO最佳实践：如果是对机甲使用物品，强制刷新机甲列表
            if (targetType === 'Pet' && this.robotList) {
                console.log('🔄 [BagItem] 对机甲使用物品成功，强制刷新机甲列表');
                // 再延迟一小段时间，确保服务器数据已更新
                this.scheduleOnce(() => {
                    if (this.robotList) {
                        this.robotList.forceRefresh();
                    }
                }, 0.1);
            }
            
            // MMO最佳实践：不进行乐观更新，直接等待服务器返回最新数据
            // 避免客户端和服务器数据不一致的问题
            // 立即请求服务器数据（服务器是权威数据源，会返回更新后的数据）
            this.requestFetchBag();
        }, delayTime);
        if (data && data.success) {
            BagEventHub.emit('bag', { kind: 'mutated', mutation: 'use', success: true, raw: data });
        }
    };

    /**
     * 处理丢弃物品响应
     */
    /**
     * 处理丢弃物品响应（优化：支持标准格式和直接格式）
     * request方法已经验证了request_id，这里直接处理响应
     */
    private onDiscardItemResponse = (data: any) => {
        UILockManager.instance.unlock('bag');
        // 清除处理标志
        this.isProcessingDiscardItem = false;

        if (!data || !data.success) {
            const errorMsg = data?.error || data?.message || '未知错误';
            console.error(`❌ [BagItem] 丢弃物品失败: ${errorMsg}`);
            
            // 如果是因为物品不存在或无效，刷新背包数据
            if (errorMsg.includes('不存在') || errorMsg.includes('无效')) {
                console.log('🔄 [BagItem] 检测到数据不同步，刷新背包数据');
                // 关闭使用窗口
                this.closeUseItemPanel();
                // 立即刷新（MMO最佳实践：服务器是权威数据源）
                this.requestFetchBag();
            }
            return;
        }

        // ✅ 关键修复：兼容标准格式（data在data字段中）和直接格式（字段在根级别）
        const responseData = data.data || data; // 优先使用data字段，如果没有则使用根级别
        const itemId = responseData.item_id;
        const itemData = this.itemDataMap.get(itemId);
        const itemName = itemData ? itemData.name : `物品ID: ${itemId}`;

        console.log(`✅ [BagItem] 成功丢弃物品: ${itemName} (ID: ${itemId})`);

        // 关闭使用窗口（会自动恢复到合适位置）
        this.closeUseItemPanel();

        // MMO最佳实践：不进行乐观更新，直接等待服务器返回最新数据
        // 避免客户端和服务器数据不一致的问题
        // 立即请求服务器数据（服务器是权威数据源，会返回更新后的数据）
        this.requestFetchBag();
        BagEventHub.emit('bag', { kind: 'mutated', mutation: 'discard', success: true, raw: data });
    };

    /**
     * 处理全局触摸结束事件 - 检测点击外部区域取消选中
     * @param event 触摸事件
     */
    private onGlobalTouchEnd(event: EventTouch) {
        // 如果使用窗口打开，不处理全局点击（使用窗口有自己的关闭逻辑）
        if (this.useItemPanel && this.useItemPanel.active) {
            return;
        }

        // 如果没有选中状态，直接返回
        if (!this.selectedItemNode && !this.hoveredItemNode) {
            return;
        }

        // 如果刚刚点击了物品格子，不处理（让Button事件处理）
        if (this._clickedOnItem) {
            return;
        }

        // 延迟执行，确保Button点击事件先完成
        this.scheduleOnce(() => {
            // 如果使用窗口打开，不处理
            if (this.useItemPanel && this.useItemPanel.active) {
                return;
            }

            // 如果刚刚点击了物品，不处理
            if (this._clickedOnItem) {
                return;
            }

            // 如果没有选中状态，直接返回
            if (!this.selectedItemNode && !this.hoveredItemNode) {
                return;
            }

            // 获取点击目标
            if (!event || !event.target) {
                // 没有目标，清除选中
                if (this.selectedItemNode) {
                    this.clearSelection();
                }
                return;
            }

            const target = event.target as Node;
            if (!target || !target.isValid) {
                // 目标无效，清除选中
                if (this.selectedItemNode) {
                    this.clearSelection();
                }
                return;
            }

            // 检查是否点击在物品格子上
            let isItemNode = false;
            for (const itemNode of this.dynamicNodes) {
                if (itemNode && itemNode.isValid) {
                    // 检查target是否是itemNode或其子节点
                    let node: Node | null = target;
                    while (node) {
                        if (node === itemNode) {
                            isItemNode = true;
                            break;
                        }
                        node = node.parent;
                    }
                    if (isItemNode) break;
                }
            }

            // 如果点击在物品格子上，不处理
            if (isItemNode) {
                return;
            }

            // 检查是否点击在Introduction面板上
            if (this.introductionPanel && this.introductionPanel.active && this.introductionPanel.isValid) {
                let node: Node | null = target;
                while (node) {
                    if (node === this.introductionPanel) {
                        return; // 点击在Introduction面板上，不清除
                    }
                    node = node.parent;
                }
            }

            // 检查是否点击在使用窗口上
            if (this.useItemPanel && this.useItemPanel.active && this.useItemPanel.isValid) {
                let node: Node | null = target;
                while (node) {
                    if (node === this.useItemPanel) {
                        return; // 点击在使用窗口上，不清除
                    }
                    node = node.parent;
                }
            }

            // 检查是否点击在按钮上
            const buttons = [
                this.itemBtn, this.weaponBtn, this.armorBtn, this.otherBtn,
                this.closeBtn, this.testWriteBtn, this.testFetchBtn,
                this.useItemButton, this.useBtn, this.discardBtn
            ];
            for (const btn of buttons) {
                if (btn && btn.node && btn.node.isValid) {
                    let node: Node | null = target;
                    while (node) {
                        if (node === btn.node) {
                            return; // 点击在按钮上，不清除
                        }
                        node = node.parent;
                    }
                }
            }

            // 点击在其他地方，清除选中状态
            if (this.selectedItemNode) {
                this.clearSelection();
            }
            if (this.hoveredItemNode) {
                this.onItemHoverLeave(this.hoveredItemNode);
            }
        }, 0.15); // 延迟150ms，确保Button事件先执行
    }



    /**
     * 检查点是否在节点内（已废弃，改用节点层次关系判断）
     * 保留此方法以防将来需要使用，但添加了安全的错误处理
     * @param node 节点
     * @param point 点坐标（UI坐标，来自event.getUILocation()）
     * @returns 是否在节点内
     */
    private isPointInNode(node: Node, point: { x: number; y: number }): boolean {
        try {
            if (!node || !node.isValid) {
                return false;
            }

            const uiTransform = node.getComponent(UITransform);
            if (!uiTransform) {
                return false;
            }

            // 使用convertToNodeSpaceAR将UI坐标转换为节点的本地坐标
            // 添加try-catch防止camera相关错误
            const uiPos = new Vec3(point.x, point.y, 0);
            const localPos = new Vec3();
            
            try {
                uiTransform.convertToNodeSpaceAR(uiPos, localPos);
            } catch (error) {
                // 如果转换失败（可能因为camera引用问题），返回false
                console.warn('⚠️ [BagItem] convertToNodeSpaceAR失败:', error);
                return false;
            }

            // 获取节点的尺寸和锚点
            const width = uiTransform.width;
            const height = uiTransform.height;
            const anchorX = uiTransform.anchorX;
            const anchorY = uiTransform.anchorY;

            // 计算节点的边界（相对于节点锚点）
            const left = -width * anchorX;
            const right = width * (1 - anchorX);
            const bottom = -height * anchorY;
            const top = height * (1 - anchorY);

            // 检查点是否在边界内
            const inBounds = localPos.x >= left && localPos.x <= right && 
                            localPos.y >= bottom && localPos.y <= top;

            return inBounds;
        } catch (error) {
            console.error('❌ [BagItem] isPointInNode错误:', error);
            return false;
        }
    }

    /**
     * 显示错误/成功提示（简单版本）
     * @param message 提示消息
     * @param isSuccess 是否成功（true=成功，false=失败）
     */
    private showErrorTips(message: string, isSuccess: boolean) {
        // 如果没有绑定 ErrorTips 面板或 Label，尝试自动查找
        if (!this.errorTipsPanel && this.panel) {
            this.errorTipsPanel = this.findNodeByName(this.panel, 'ErrorTips');
        }
        
        if (!this.errorTipsPanel) {
            console.warn('⚠️ [BagItem] ErrorTips 面板未找到，无法显示提示');
            return;
        }

        // 如果没有绑定 Label，尝试从 ErrorTips 面板下查找
        if (!this.errorTipsLabel && this.errorTipsPanel) {
            const labelNode = this.errorTipsPanel.getChildByName('Label');
            if (labelNode) {
                this.errorTipsLabel = labelNode.getComponent(Label);
            }
        }

        if (!this.errorTipsLabel) {
            console.warn('⚠️ [BagItem] ErrorTips Label 未找到，无法显示提示');
            return;
        }

        // 取消之前的隐藏定时器
        this.unschedule(this.hideErrorTips);

        // 设置提示文本
        this.errorTipsLabel.string = message;

        // 设置颜色：成功=FFFF00（黄色），失败=FF3F3F（红色）
        const successColor = new Color(255, 255, 0, 255); // FFFF00
        const failColor = new Color(255, 63, 63, 255); // FF3F3F
        this.errorTipsLabel.color = isSuccess ? successColor : failColor;

        // 显示面板（确保正常显示）
        this.errorTipsPanel.active = true;
        this.errorTipsPanel.setScale(1, 1, 1);

        // 确保背景正常显示
        const sprite = this.errorTipsPanel.getComponent(Sprite);
        if (sprite) {
            sprite.color = new Color(255, 255, 255, 255);
        }

        // 2秒后自动隐藏
        this.scheduleOnce(this.hideErrorTips, 2.0);
    }

    /**
     * 隐藏错误提示面板
     */
    private hideErrorTips = () => {
        if (this.errorTipsPanel) {
            this.errorTipsPanel.active = false;
        }
    }
    
    /**
     * 确保所有物品格子的按钮是可交互的
     * 关键修复：防止场景切换后按钮被禁用导致点击无效
     */
    private ensureAllItemButtonsInteractable() {
        for (let i = 0; i < this.dynamicNodes.length; i++) {
            const node = this.dynamicNodes[i];
            if (node && node.isValid && node.active) {
                const btn = node.getComponent(Button);
                if (btn) {
                    // 确保按钮是可交互的
                    btn.interactable = true;
                }
            }
        }
    }
}
