import { _decorator, Component, Node, ScrollView, Prefab, instantiate, EditBox, Label, Color, Button } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { FriendItem, FriendItemMode } from './FriendItem';
import { CharacterProfile, ProfileEntryType } from './CharacterProfile';
import { Logger } from '../global/Logger';

const { ccclass, property } = _decorator;

interface FriendData {
    character_id: string;
    friend_id: string;
    role_name: string;
    Sprite: number;
    online: boolean;
}

@ccclass('FriendPanel')
export class FriendPanel extends Component {
    // ====== 顶部按钮 & 面板 ======
    @property(Node)
    public requestListButton: Node = null!;   // RequestList

    @property(Node)
    public friendListButton: Node = null!;    // FriendList

    @property(Node)
    public addFriendButton: Node = null!;     // AddFriend

    @property(Node)
    public addFriendPanel: Node = null!;      // AddFriendPanel

    // ====== ScrollView（好友/申请通用） ======
    @property(ScrollView)
    public scrollView: ScrollView = null!;

    @property(Node)
    public content: Node = null!;             // ScrollView/view/content

    @property(Prefab)
    public friendItemPrefab: Prefab = null!;  // FriendItemPrefab

    // ====== AddFriendPanel 内部 ======
    @property(EditBox)
    public addFriendEditBox: EditBox = null!;

    @property(Node)
    public addFriendResultRoot: Node = null!; // AddFriendPanel 下用来摆放一个 FriendItemPrefab

    @property(Node)
    public addFriendConfirmButton: Node = null!; // AddFriendPanel/Confirm（自动绑定点击事件）

    @property(Node)
    public addFriendResultLabel: Node = null!; // ResultRoot/Result（Label节点，显示"不存在该玩家"的文本）

    // ====== BackControl ======
    @property(Node)
    public backControlButton: Node = null!;   // BackControl/Button

    // ====== CharacterProfile 引用 ======
    @property(Node)
    public characterProfileNode: Node = null!;  // Character 面板节点（必须绑定）

    // ====== 状态 ======
    private ws: WebSocketManager = null!;
    private currentTab: 'friend' | 'request' = 'friend';
    private currentItems: FriendItem[] = [];
    private addFriendResultItem: FriendItem | null = null;
    private static readonly LIST_CACHE_TTL_MS = 5000;
    private cacheOwnerId = '';
    private listCache: { friend: FriendData[] | null; request: FriendData[] | null } = { friend: null, request: null };
    private listCacheAt: { friend: number; request: number } = { friend: 0, request: 0 };
    private renderedTab: 'friend' | 'request' | null = null;
    private renderedSig = '';

    onLoad() {
        this.ws = WebSocketManager.getInstance();

        // 顶部按钮（使用 Button.EventType.CLICK，兼容有 Button 组件的节点）
        if (this.requestListButton) {
            const button = this.requestListButton.getComponent(Button);
            if (button) {
                button.node.on(Button.EventType.CLICK, () => this.switchTab('request'), this);
            } else {
                this.requestListButton.on(Node.EventType.TOUCH_END, () => this.switchTab('request'), this);
            }
        }
        if (this.friendListButton) {
            const button = this.friendListButton.getComponent(Button);
            if (button) {
                button.node.on(Button.EventType.CLICK, () => this.switchTab('friend'), this);
            } else {
                this.friendListButton.on(Node.EventType.TOUCH_END, () => this.switchTab('friend'), this);
            }
        }
        if (this.addFriendButton && this.addFriendPanel) {
            const button = this.addFriendButton.getComponent(Button);
            if (button) {
                button.node.on(Button.EventType.CLICK, () => {
                    this.addFriendPanel.active = true;
                    this.clearAddFriendResult();
                }, this);
            } else {
                this.addFriendButton.on(Node.EventType.TOUCH_END, () => {
                    this.addFriendPanel.active = true;
                    this.clearAddFriendResult();
                }, this);
            }
        }

        // 添加好友面板 - 确认按钮自动绑定点击事件（避免在编辑器里手动加 ClickEvents）
        if (this.addFriendConfirmButton) {
            const button = this.addFriendConfirmButton.getComponent(Button);
            if (button) {
                button.node.on(Button.EventType.CLICK, this.onConfirmAddFriend, this);
            } else {
                this.addFriendConfirmButton.on(Node.EventType.TOUCH_END, this.onConfirmAddFriend, this);
            }
        }

        // BackControl 顶层返回按钮：关闭所有 Set 面板和 AddFriendPanel
        if (this.backControlButton) {
            const button = this.backControlButton.getComponent(Button);
            if (button) {
                button.node.on(Button.EventType.CLICK, this.handleBackControl, this);
            } else {
                this.backControlButton.on(Node.EventType.TOUCH_END, this.handleBackControl, this);
            }
        }

        // 设置 ResultRoot 缩放为 0.96，位置 x 归零
        if (this.addFriendResultRoot) {
            const pos = this.addFriendResultRoot.position;
            this.addFriendResultRoot.setPosition(0, pos.y, pos.z);
            this.addFriendResultRoot.setScale(0.96, 0.96, 1);
        }
    }

    start() {
        // 默认显示好友列表
        this.switchTab('friend');
    }

    onEnable() {
        // 每次界面激活时，自动加载好友列表
        // 延迟一小段时间确保组件完全初始化
        this.scheduleOnce(() => {
            if (this.node.active) {
                this.switchTab('friend');
            }
        }, 0.1);
    }

    // ====== Tab 切换 ======
    private switchTab(tab: 'friend' | 'request'): void {
        Logger.debug('[FriendPanel] switchTab 被调用:', tab, '当前tab:', this.currentTab);
        this.currentTab = tab;
        this.refreshCurrentList(false);
    }

    private refreshCurrentList(force = false): void {
        if (!this.ws) this.ws = WebSocketManager.getInstance();
        this.ensureCacheOwner();
        if (force) {
            this.listCache[this.currentTab] = null;
            this.listCacheAt[this.currentTab] = 0;
        } else if (this.tryReuseCachedList()) {
            return;
        }
        if (this.renderedTab !== this.currentTab) {
            this.clearContent();
            this.renderedTab = null;
            this.renderedSig = '';
        }

        if (this.currentTab === 'friend') {
            this.requestFriendList();
        } else {
            this.requestFriendRequestList();
        }
    }

    private ensureCacheOwner(): void {
        const cid = this.ws?.getCharacterId() || '';
        if (cid === this.cacheOwnerId) return;
        this.cacheOwnerId = cid;
        this.listCache.friend = null;
        this.listCache.request = null;
        this.listCacheAt.friend = 0;
        this.listCacheAt.request = 0;
        this.renderedTab = null;
        this.renderedSig = '';
    }

    private tryReuseCachedList(): boolean {
        const tab = this.currentTab;
        const list = this.listCache[tab];
        if (!list) return false;
        if (Date.now() - this.listCacheAt[tab] >= FriendPanel.LIST_CACHE_TTL_MS) return false;
        const mode = tab === 'friend' ? FriendItemMode.FRIEND : FriendItemMode.REQUEST;
        if (this.renderedTab === tab && this.renderedSig === this.listSignature(list)) return true;
        this.syncList(list, mode, false);
        return true;
    }

    private listSignature(list: FriendData[]): string {
        return list.map((f) => {
            const id = `${f.friend_id || ''}|${f.character_id || ''}`;
            return `${id}:${f.role_name || ''}:${f.Sprite ?? 0}:${f.online ? 1 : 0}`;
        }).join('\n');
    }

    private rememberList(list: FriendData[]): void {
        this.listCache[this.currentTab] = list;
        this.listCacheAt[this.currentTab] = Date.now();
        this.renderedTab = this.currentTab;
        this.renderedSig = this.listSignature(list);
    }

    private clearContent(): void {
        if (!this.content) return;
        this.currentItems.length = 0;
        this.content.removeAllChildren();
    }

    // ====== 网络请求：好友列表 ======
    private requestFriendList(): void {
        Logger.debug('[FriendPanel] 发送获取好友列表请求');
        // 检查 WebSocket 连接状态
        if (!this.ws || !this.ws.isConnected()) {
            Logger.error('[FriendPanel] WebSocket 未连接，无法获取好友列表');
            return;
        }
        // 检查是否有必要的认证信息
        const token = this.ws.getToken();
        const characterId = this.ws.getCharacterId();
        if (!token || !characterId) {
            Logger.error('[FriendPanel] 缺少认证信息，无法获取好友列表', { token: !!token, characterId: !!characterId });
            return;
        }
        this.ws.request('get_friend_list', {
            character_id: characterId
        }, (resp: any) => {
            if (!this.node?.isValid || this.currentTab !== 'friend') return;
            Logger.debug('[FriendPanel] 收到好友列表响应:', resp);
            if (!resp || !resp.success) {
                Logger.warn('[FriendPanel] 获取好友列表失败:', resp?.message || '未知错误', resp);
                return;
            }
            if (!resp.data) {
                Logger.warn('[FriendPanel] 响应中没有data字段:', resp);
                return;
            }
            const list: FriendData[] = resp.data.list || [];
            Logger.debug('[FriendPanel] 解析到的好友列表:', list.length, '个好友', list);
            if (list.length === 0) {
                Logger.debug('[FriendPanel] 好友列表为空');
            }
            this.syncList(list, FriendItemMode.FRIEND, true);
        });
    }

    // ====== 网络请求：好友申请列表 ======
    private requestFriendRequestList(): void {
        Logger.debug('[FriendPanel] 发送获取好友申请列表请求');
        // 检查 WebSocket 连接状态
        if (!this.ws || !this.ws.isConnected()) {
            Logger.error('[FriendPanel] WebSocket 未连接，无法获取好友申请列表');
            return;
        }
        // 检查是否有必要的认证信息
        const token = this.ws.getToken();
        const characterId = this.ws.getCharacterId();
        if (!token || !characterId) {
            Logger.error('[FriendPanel] 缺少认证信息，无法获取好友申请列表', { token: !!token, characterId: !!characterId });
            return;
        }
        this.ws.request('get_friend_requests', {
            character_id: characterId
        }, (resp: any) => {
            if (!this.node?.isValid || this.currentTab !== 'request') return;
            Logger.debug('[FriendPanel] 收到好友申请列表响应:', resp);
            if (!resp || !resp.success || !resp.data) {
                Logger.warn('[FriendPanel] 获取好友申请列表失败:', resp?.message);
                return;
            }
            const list: FriendData[] = resp.data.list || [];
            Logger.debug('[FriendPanel] 解析到的好友申请列表:', list.length, '个申请', list);
            this.syncList(list, FriendItemMode.REQUEST, true);
        });
    }

    // ====== 构建 ScrollView 列表 ======
    private dataKey(f: FriendData): string {
        return `${f.friend_id || ''}|${f.character_id || ''}`;
    }

    private itemKey(it: FriendItem): string {
        return `${it.friendId || ''}|${it.characterId || ''}`;
    }

    /** 命中相同名单时不拆节点；增删改只动差异行。 */
    private syncList(list: FriendData[], mode: FriendItemMode, fromNetwork: boolean): void {
        if (!this.friendItemPrefab || !this.content) return;
        const sig = this.listSignature(list);
        if (this.renderedTab === this.currentTab && this.renderedSig === sig && this.currentItems.length === list.length) {
            if (fromNetwork) this.rememberList(list);
            return;
        }

        const existing = new Map<string, FriendItem>();
        for (const it of this.currentItems) {
            const k = this.itemKey(it);
            if (k !== '|' && !existing.has(k)) existing.set(k, it);
        }

        const startX = 240;
        const startY = -30;
        const itemSpacing = 60;
        const next: FriendItem[] = [];
        const callbacks = {
            onOpenSetPanel: (i: FriendItem) => this.handleOpenSetPanel(i),
            onLeftAction: (i: FriendItem) => this.handleLeftAction(i),
            onRightAction: (i: FriendItem) => this.handleRightAction(i),
        };

        for (let i = 0; i < list.length; i++) {
            const f = list[i];
            const k = this.dataKey(f);
            let item = k !== '|' ? (existing.get(k) ?? null) : null;
            if (item) existing.delete(k);
            if (!item?.node?.isValid) {
                const node = instantiate(this.friendItemPrefab);
                this.content.addChild(node);
                item = node.getComponent(FriendItem);
                if (!item) {
                    node.destroy();
                    continue;
                }
            } else if (item.node.parent !== this.content) {
                this.content.addChild(item.node);
            }
            item.init(
                {
                    characterId: f.character_id,
                    friendId: f.friend_id,
                    spriteIndex: f.Sprite ?? 0,
                    roleName: f.role_name ?? '',
                    isOnline: !!f.online,
                    mode,
                },
                callbacks
            );
            item.node.setPosition(startX, startY - i * itemSpacing, item.node.position.z);
            item.node.setSiblingIndex(i);
            next.push(item);
        }

        const kept = new Set(next);
        for (const it of this.currentItems) {
            if (!kept.has(it) && it?.node?.isValid) it.node.destroy();
        }
        this.currentItems = next;
        if (fromNetwork) this.rememberList(list);
        else {
            this.renderedTab = this.currentTab;
            this.renderedSig = sig;
        }
    }

    // 只允许一个 Set 面板打开，点击 BackControl 全部关闭
    private handleOpenSetPanel(item: FriendItem): void {
        // 关闭其他所有 Set 面板
        for (const it of this.currentItems) {
            if (it !== item) {
                it.closeSetPanel();
            }
        }
        if (this.addFriendResultItem && this.addFriendResultItem !== item) {
            this.addFriendResultItem.closeSetPanel();
        }
        
        // 将当前打开的 FriendItem 节点移到 content 的最后（顶层），确保操作窗口显示在最上层
        if (item.node && item.node.parent === this.content && this.content.children.length > 0) {
            const lastIndex = this.content.children.length - 1;
            item.node.setSiblingIndex(lastIndex);
        }
    }

    // ====== Set 面板左/右按钮行为 ======
    private handleLeftAction(item: FriendItem): void {
        switch (item.mode) {
            case FriendItemMode.FRIEND:
                // 查看好友信息
                this.viewFriendInfo(item);
                break;
            case FriendItemMode.REQUEST:
                this.approveFriend(item);
                break;
            case FriendItemMode.SEARCH_RESULT:
                // 查看搜索结果角色信息
                this.viewFriendInfo(item);
                break;
        }
    }

    /**
     * 查看好友信息
     */
    private viewFriendInfo(item: FriendItem): void {
        Logger.debug('[FriendPanel] viewFriendInfo 被调用:', {
            mode: item.mode,
            characterId: item.characterId,
            friendId: item.friendId,
            roleName: item.roleName
        });
        
        if (!this.characterProfileNode) {
            Logger.error('[FriendPanel] CharacterProfileNode 未绑定，无法查看好友信息');
            return;
        }
        
        const characterProfile = this.characterProfileNode.getComponent(CharacterProfile);
        if (!characterProfile) {
            Logger.error('[FriendPanel] CharacterProfileNode 上未找到 CharacterProfile 组件');
            return;
        }
        
        // 关闭 Set 面板
        item.closeSetPanel();
        
        // 调用 CharacterProfile 显示好友信息
        // 使用新的 show 方法，传入完整的配置
        
        if (item.mode === FriendItemMode.FRIEND) {
             // 好友模式：优先传 friendId 用于查询数据库，同时也传 characterId 作为备份
             characterProfile.show({
                 entryType: ProfileEntryType.FRIEND_LIST,
                 friendId: item.friendId,  // 优先使用 friend_id 查询
                 characterId: item.characterId,  // 作为备份
                 roleName: item.roleName
             });
        } else {
             // 搜索模式或其他：如果有 friendId 则优先使用，否则使用 characterId
             characterProfile.show({
                 entryType: item.mode === FriendItemMode.SEARCH_RESULT ? ProfileEntryType.SEARCH : ProfileEntryType.OTHER,
                 friendId: item.friendId || undefined,  // 优先使用 friend_id（如果有）
                 characterId: item.characterId || undefined,  // 如果没有 friend_id 则使用 character_id
                 roleName: item.roleName
             });
        }
    }

    private handleRightAction(item: FriendItem): void {
        switch (item.mode) {
            case FriendItemMode.FRIEND:
                this.deleteFriend(item);
                break;
            case FriendItemMode.REQUEST:
                this.rejectFriend(item);
                break;
            case FriendItemMode.SEARCH_RESULT:
                this.addFriend(item);
                break;
        }
    }

    // ====== 好友操作：全部走服务器 ======
    private deleteFriend(item: FriendItem): void {
        this.ws.request('delete_friend', {
            friend_id: item.friendId,
            character_id: item.characterId,
        }, (resp) => {
            if (!resp || !resp.success) {
                Logger.warn('[FriendPanel] 删除好友失败:', resp?.message);
                return;
            }
            this.refreshCurrentList(true);
        });
    }

    private approveFriend(item: FriendItem): void {
        this.ws.request('approve_friend', {
            friend_id: item.friendId,
            character_id: item.characterId,
        }, (resp) => {
            if (!resp || !resp.success) {
                Logger.warn('[FriendPanel] 同意好友失败:', resp?.message);
                return;
            }
            // 同意后：从申请列表移除，并让好友列表缓存失效
            this.listCache.friend = null;
            this.listCacheAt.friend = 0;
            this.refreshCurrentList(true);
        });
    }

    private rejectFriend(item: FriendItem): void {
        this.ws.request('reject_friend', {
            friend_id: item.friendId,
            character_id: item.characterId,
        }, (resp) => {
            if (!resp || !resp.success) {
                Logger.warn('[FriendPanel] 拒绝好友失败:', resp?.message);
                return;
            }
            this.refreshCurrentList(true);
        });
    }

    private addFriend(item: FriendItem): void {
        this.ws.request('add_friend', {
            target_friend_id: item.friendId,
            target_character_id: item.characterId,
        }, (resp) => {
            if (!resp || !resp.success) {
                Logger.warn('[FriendPanel] 添加好友失败:', resp?.message);
                return;
            }
            // 添加成功后可以自动切到好友列表
            this.addFriendPanel.active = false;
            this.currentTab = 'friend';
            this.refreshCurrentList(true);
        });
    }

    // ====== AddFriendPanel 逻辑 ======
    public onConfirmAddFriend(): void {
        if (!this.addFriendEditBox) {
            return;
        }
        const text = (this.addFriendEditBox.string || '').trim();
        
        // 输入验证：空输入
        if (!text) {
            this.showSearchError('请输入好友ID');
            return;
        }
        
        // 输入验证：非数字
        if (!/^\d+$/.test(text)) {
            this.showSearchError('好友ID只能包含数字');
            return;
        }
        
        // 输入验证：位数不够
        if (text.length < 6) {
            this.showSearchError(`好友ID不足6位，当前${text.length}位`);
            return;
        }
        
        // 输入验证：位数太多
        if (text.length > 6) {
            this.showSearchError(`好友ID超过6位，当前${text.length}位`);
            return;
        }
        
        // 验证通过，执行搜索
        this.searchFriendById(text);
    }
    
    /**
     * 显示搜索错误提示
     */
    private showSearchError(message: string): void {
        Logger.debug('[FriendPanel] 显示错误提示:', message);
        // 先清空搜索结果（不隐藏标签）
        this.clearAddFriendResult(false);
        // 然后显示错误文本
        if (this.addFriendResultLabel) {
            const label = this.addFriendResultLabel.getComponent(Label);
            if (label) {
                label.string = message;
                label.color = new Color(255, 0, 0, 255); // 大红色
                Logger.debug('[FriendPanel] 已设置错误文本:', message);
            } else {
                Logger.warn('[FriendPanel] Result节点上没有Label组件！');
            }
            this.addFriendResultLabel.active = true;
            Logger.debug('[FriendPanel] Result节点已激活');
        } else {
            Logger.warn('[FriendPanel] addFriendResultLabel 未绑定！');
        }
    }

    private searchFriendById(friendId: string): void {
        this.ws.request('search_friend', { friend_id: friendId }, (resp: any) => {
            this.clearAddFriendResult(true);

            if (!resp || !resp.success || !resp.data || !resp.data.friend) {
                Logger.warn('[FriendPanel] 未找到该好友:', resp?.message);
                // 显示"不存在该玩家"文本（大红色）
                if (this.addFriendResultLabel) {
                    const label = this.addFriendResultLabel.getComponent(Label);
                    if (label) {
                        label.string = '不存在该玩家';
                        label.color = new Color(255, 0, 0, 255); // 大红色
                    }
                    this.addFriendResultLabel.active = true;
                }
                return;
            }

            // 搜索成功：隐藏错误文本
            if (this.addFriendResultLabel) {
                this.addFriendResultLabel.active = false;
            }

            const f: FriendData = resp.data.friend;
            if (!this.friendItemPrefab || !this.addFriendResultRoot) {
                return;
            }

            const node = instantiate(this.friendItemPrefab);
            node.parent = this.addFriendResultRoot;
            // 设置 FriendItemPrefab 的 x 位置为 0
            node.setPosition(0, node.position.y, node.position.z);
            
            // 确保节点在父节点的最后（顶层），这样操作窗口不会被遮挡
            const lastIndex = this.addFriendResultRoot.children.length - 1;
            if (lastIndex >= 0) {
                node.setSiblingIndex(lastIndex);
            }
            const item = node.getComponent(FriendItem);
            if (!item) return;

            item.init(
                {
                    characterId: f.character_id,
                    friendId: f.friend_id,
                    spriteIndex: f.Sprite ?? 0,
                    roleName: f.role_name ?? '',
                    isOnline: !!f.online,
                    mode: FriendItemMode.SEARCH_RESULT,
                },
                {
                    onOpenSetPanel: (i) => this.handleOpenSetPanel(i),
                    onLeftAction: (i) => this.handleLeftAction(i),
                    onRightAction: (i) => this.handleRightAction(i),
                }
            );

            this.addFriendResultItem = item;
        });
    }

    /**
     * 清空搜索结果
     * @param hideLabel 是否同时隐藏错误文本（默认 true）
     */
    private clearAddFriendResult(hideLabel: boolean = true): void {
        if (this.addFriendResultRoot) {
            // 只移除 FriendItemPrefab，保留 Result Label
            const children = this.addFriendResultRoot.children.slice();
            for (const child of children) {
                // 如果不是 Result Label，就移除
                if (child !== this.addFriendResultLabel) {
                    child.removeFromParent();
                }
            }
        }
        this.addFriendResultItem = null;
        if (hideLabel && this.addFriendResultLabel) {
            this.addFriendResultLabel.active = false;
        }
    }

    // ====== BackControl：关闭所有浮层，如果没有浮层则关闭好友界面 ======
    private handleBackControl(): void {
        // 检查是否有打开的 Set 面板
        let hasOpenSetPanel = false;
        for (const it of this.currentItems) {
            if (it.isSetPanelOpen()) {
                hasOpenSetPanel = true;
                break;
            }
        }
        if (!hasOpenSetPanel && this.addFriendResultItem && this.addFriendResultItem.isSetPanelOpen()) {
            hasOpenSetPanel = true;
        }

        // 检查 AddFriendPanel 是否打开
        const isAddFriendPanelOpen = this.addFriendPanel ? this.addFriendPanel.active : false;

        // 如果有打开的浮层，先关闭它们
        if (hasOpenSetPanel || isAddFriendPanelOpen) {
            // 关闭所有 Set 面板
            for (const it of this.currentItems) {
                it.closeSetPanel();
            }
            if (this.addFriendResultItem) {
                this.addFriendResultItem.closeSetPanel();
            }
            // 关闭 AddFriendPanel
            if (this.addFriendPanel) {
                this.addFriendPanel.active = false;
            }
        } else {
            // 没有任何打开的浮层，直接关闭好友界面
            this.node.active = false;
        }
    }
}


