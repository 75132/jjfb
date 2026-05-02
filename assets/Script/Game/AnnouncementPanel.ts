import { _decorator, Component, Node, Prefab, instantiate, Label, ScrollView, UITransform, Layout } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
const { ccclass, property } = _decorator;

@ccclass('AnnouncementPanel')
export class AnnouncementPanel extends Component {
    @property({ type: Node }) content: Node | null = null;
    @property({ type: ScrollView }) scrollView: ScrollView | null = null;
    @property({ type: Prefab }) msgLabelPrefab: Prefab | null = null;

    private wsManager: WebSocketManager = null!;
    private maxItems: number = 15;
    private historyLoaded: boolean = false;
    private annList: any[] = [];
    private chatList: any[] = [];
    private annLoaded: boolean = false;
    private chatLoaded: boolean = false;
    private hasRequestedHistory: boolean = false; // 标记是否已请求过历史记录

    start() {
        this.wsManager = WebSocketManager.getInstance();
        this.ensureLayout();
        this.historyLoaded = false;
        this.annLoaded = false;
        this.chatLoaded = false;
        this.annList = [];
        this.chatList = [];
        this.hasRequestedHistory = false;
        
        // 注册消息监听
        this.wsManager.on(GameConfig.MESSAGE_TYPES.ANNOUNCEMENT, this.onAnnouncement, this);
        this.wsManager.on('chat_message', this.onChatMessage, this);
        this.wsManager.on('chat_history', this.onChatHistory, this);
        this.wsManager.on('announcement_list', this.onAnnouncementList, this);
        
        // 监听网络连接事件（MMO最佳实践：连接成功后再加载数据）
        const wsNode = (this.wsManager as any).node;
        if (wsNode) {
            wsNode.on('network_connect', this.onNetworkConnect, this);
            wsNode.on('data_changed', this.onDataChanged, this);
        }
        
        // 如果已经连接，立即加载；否则等待连接成功
        this.tryLoadHistory();
    }

    /**
     * 网络连接成功回调（MMO最佳实践：连接成功后再加载数据）
     */
    private onNetworkConnect = () => {
        console.log('🔄 [AnnouncementPanel] 网络连接成功，尝试加载聊天记录');
        this.tryLoadHistory();
    };

    /**
     * 数据变化回调（MMO最佳实践：登录成功后加载数据）
     */
    private onDataChanged = (data: any) => {
        // 当 token 或 characterId 被设置时，尝试加载聊天记录
        if (data && (data.token || data.characterId)) {
            console.log('🔄 [AnnouncementPanel] 检测到登录数据变化，尝试加载聊天记录');
            this.tryLoadHistory();
        }
    };

    /**
     * 尝试加载聊天记录（检查连接状态）
     */
    private tryLoadHistory(): void {
        // 如果已经请求过，不再重复请求
        if (this.hasRequestedHistory) {
            return;
        }
        
        // 检查连接状态
        if (!this.wsManager || !this.wsManager.isConnected()) {
            console.log('⏳ [AnnouncementPanel] WebSocket未连接，等待连接...');
            return;
        }
        
        // 检查是否有必要的凭证（登录后才有）
        const token = this.wsManager.getToken?.();
        if (!token) {
            console.log('⏳ [AnnouncementPanel] 未登录，等待登录...');
            return;
        }
        
        // 连接成功且已登录，加载聊天记录
        console.log('📥 [AnnouncementPanel] 开始加载聊天记录');
        this.hasRequestedHistory = true;
        
        // 优化：使用request方法，自动生成request_id并匹配响应
        this.wsManager.request(
            GameConfig.MESSAGE_TYPES.GET_CHAT_HISTORY,
            { limit: 8 },
            (response: any) => {
                // 通过request_id匹配的响应回调
                this.onChatHistory(response);
            },
            true, // 需要认证
            10000 // 10秒超时
        );
        
        this.wsManager.request(
            GameConfig.MESSAGE_TYPES.GET_ANNOUNCEMENTS_HISTORY,
            { limit: 8 },
            (response: any) => {
                // 通过request_id匹配的响应回调
                this.onAnnouncementList(response);
            },
            true, // 需要认证
            10000 // 10秒超时
        );
    }

    /**
     * 当节点启用时调用（面板显示时）
     * MMO最佳实践：确保每次显示时都有最新数据
     */
    onEnable(): void {
        // 重置加载状态，允许重新加载
        this.historyLoaded = false;
        this.annLoaded = false;
        this.chatLoaded = false;
        this.annList = [];
        this.chatList = [];
        
        // 尝试加载历史记录（如果连接已建立）
        this.hasRequestedHistory = false; // 重置标记，允许重新请求
        this.tryLoadHistory();
    }

    private onAnnouncement(data: any) {
        if (!data) { return; }
        const text = String(data.text || '');
        if (!text) { return; }
        // 统一格式：与大窗口一致，使用 [世]系统：前缀
        this.addMessage(`[世]系统：${text}`);
    }

    private onChatHistory(data: any) {
        console.log('📥 [AnnouncementPanel] 收到chat_history响应:', data);
        // 兼容服务器返回的格式：可能是 data.messages 或 data.list 或 data.data.messages
        let list: any[] = [];
        if (data && data.data && Array.isArray(data.data.messages)) {
            list = data.data.messages;
        } else if (data && Array.isArray(data.messages)) {
            list = data.messages;
        } else if (data && Array.isArray(data.list)) {
            list = data.list;
        }
        this.chatList = list;
        this.chatLoaded = true;
        console.log(`✅ [AnnouncementPanel] 聊天历史已加载，共 ${list.length} 条`);
        this.renderCombinedHistory();
    }

    private onAnnouncementList(data: any) {
        console.log('📥 [AnnouncementPanel] 收到announcement_list响应:', data);
        // 兼容服务器返回的格式：可能是 data.announcements 或 data.list 或 data.data.announcements
        let list: any[] = [];
        if (data && data.data && Array.isArray(data.data.announcements)) {
            list = data.data.announcements;
        } else if (data && Array.isArray(data.announcements)) {
            list = data.announcements;
        } else if (data && Array.isArray(data.list)) {
            list = data.list;
        }
        this.annList = list;
        this.annLoaded = true;
        console.log(`✅ [AnnouncementPanel] 公告列表已加载，共 ${list.length} 条`);
        this.renderCombinedHistory();
    }

    private renderCombinedHistory() {
        if (this.historyLoaded) { return; }
        if (!(this.annLoaded && this.chatLoaded)) { return; }
        // 统一格式：与大窗口一致
        const ann = this.annList.map((m) => ({
            created_at: (m && m.created_at) ? Date.parse(m.created_at) : 0,
            line: `[世]系统：${String(m && m.text || '')}`
        }));
        const chat = this.chatList.map((m) => ({
            created_at: (m && m.created_at) ? Date.parse(m.created_at) : 0,
            // 玩家消息格式：[世]名：消息（与大窗口一致）
            line: `[世]${String(m && m.sender || '')}：${String(m && m.text || '')}`
        }));
        const merged = ann.concat(chat).filter(x => x.line.trim().length > 0);
        if (merged.length === 0) { return; }
        merged.sort((a, b) => b.created_at - a.created_at);
        if (this.content) { this.content.removeAllChildren(); }
        for (let i = merged.length - 1; i >= 0; i--) {
            this.addMessage(merged[i].line);
        }
        this.historyLoaded = true;
    }

    private onChatMessage(data: any) {
        if (!data) { return; }
        const sender = String(data.sender || '');
        const text = String(data.text || '');
        // 统一格式：与大窗口一致，使用 [世]名：消息 格式
        const line = sender ? `[世]${sender}：${text}` : `[世]系统：${text}`;
        if (line) { this.addMessage(line); }
    }

    private addMessage(text: string) {
        if (!this.content || !this.msgLabelPrefab) { return; }
        const node = instantiate(this.msgLabelPrefab);
        const label = node.getComponent(Label);
        if (label) {
            label.string = text;
            label.overflow = Label.Overflow.RESIZE_HEIGHT;
            label.enableWrapText = true;
            label.verticalAlign = Label.VerticalAlign.TOP;
        }
        const contentUT = this.content.getComponent(UITransform);
        const nodeUT = node.getComponent(UITransform);
        if (contentUT && nodeUT) {
            nodeUT.width = contentUT.width;
        }
        this.content.insertChild(node, 0);
        const layout = this.content.getComponent(Layout);
        if (layout) { layout.updateLayout(); }
        const children = this.content.children;
        if (children.length > this.maxItems) {
            const last = children[children.length - 1];
            try {
                if (last && (last as any).isValid && !(last as any).__scheduledDestroy) {
                    last.removeFromParent();
                    (last as any).__scheduledDestroy = true;
                    last.destroy();
                }
            } catch {}
        }
        if (this.scrollView) { this.scrollView.scrollToTop(0.2, true); }
    }

    onDestroy() {
        if (this.wsManager) {
            this.wsManager.off(GameConfig.MESSAGE_TYPES.ANNOUNCEMENT, this.onAnnouncement, this);
            this.wsManager.off('chat_message', this.onChatMessage, this);
            this.wsManager.off('chat_history', this.onChatHistory, this);
            this.wsManager.off('announcement_list', this.onAnnouncementList, this);
        }
        
        // 移除网络连接和数据变化事件监听
        const wsNode = (this.wsManager as any)?.node;
        if (wsNode) {
            wsNode.off('network_connect', this.onNetworkConnect, this);
            wsNode.off('data_changed', this.onDataChanged, this);
        }
    }

    private ensureLayout() {
        if (!this.content) { return; }
        const contentUT = this.content.getComponent(UITransform);
        if (contentUT) { contentUT.anchorY = 1; }
        let layout = this.content.getComponent(Layout);
        if (!layout) { layout = this.content.addComponent(Layout); }
        layout.type = Layout.Type.VERTICAL;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;
        layout.verticalDirection = Layout.VerticalDirection.TOP_TO_BOTTOM;
        layout.spacingY = 6;
        layout.paddingTop = 4;
        layout.paddingBottom = 4;
        layout.updateLayout();
    }
}
