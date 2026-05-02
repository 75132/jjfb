import { _decorator, Component, Node, EditBox, Button, Label, director } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
import { GameConfig } from '../global/GameConfig';
import { ChangePasswordPanel } from './ChangePasswordPanel';
const { ccclass, property } = _decorator;

@ccclass('Login')
export class Login extends Component {

    @property(Button)
    loginButton: Button = null!;

    @property(Button)
    registerButton: Button = null!;

    @property(Button)
    startButton: Button = null!;

    @property(Button)
    logoutButton: Button = null!;  // 添加登出按钮

    @property(Button)
    changePasswordButton: Button = null!;

    @property(Node)
    changePasswordPanelNode: Node = null!;

    @property(ChangePasswordPanel)
    changePasswordPanel: ChangePasswordPanel = null!;

    @property(EditBox)
    accountEditBox: EditBox = null!;

    @property(EditBox)
    passwordEditBox: EditBox = null!;

    @property(Label)
    tipLabel: Label = null!;

    @property(Node)
    loginPanelNode: Node = null!; // 登录面板节点，必须手动拖拽绑定

    // 游戏面板节点
    private gamePanelNode: Node = null!;

    private webSocketManager: WebSocketManager = null!;
    /** 修复点：防抖/节流，避免高频点击重复发登录/注册请求 */
    private isLoginRequesting: boolean = false;
    private isRegisterRequesting: boolean = false;
    private isLogoutRequesting: boolean = false;
    /** 修复点：自动登录跳转回调引用，便于 onDestroy 时 unschedule 取消，避免组件销毁后仍执行 */
    private _autoLoginJumpCallback: (() => void) | null = null;
    /** 修复点：记录登录连接重试定时器，避免场景切换后回调访问空对象 */
    private _loginConnectTimer: ReturnType<typeof setTimeout> | null = null;
    /** 修复点：登出回包超时兜底，避免“点了没反应” */
    private _logoutFallbackTimer: ReturnType<typeof setTimeout> | null = null;

    start() {
        // 修复点：未绑定 loginPanelNode 时提前 return，避免后续访问空指针
        if (!this.loginPanelNode) {
            console.error('loginPanelNode 未绑定，请在编辑器属性面板拖拽绑定登录面板节点！');
            return;
        }
        this.webSocketManager = WebSocketManager.getInstance();
        // 规范性：先绑定监听，再 connect，避免 auth_response 等事件过快到达导致错过回调
        // 同时不要在进入登录场景时无条件清除 token，否则会破坏自动认证/自动跳转分支
        this.webSocketManager.off('auth_response', this.handleAuthResponse, this);
        this.webSocketManager.on('auth_response', this.handleAuthResponse, this);
        this.webSocketManager.off('network_disconnect', this.handleNetworkDisconnect, this);
        this.webSocketManager.on('network_disconnect', this.handleNetworkDisconnect, this);
        this.webSocketManager.off('logout_success', this.handleLogoutSuccess, this);
        this.webSocketManager.on('logout_success', this.handleLogoutSuccess, this);
        this.webSocketManager.off('logout_failure', this.handleLogoutFailure, this);
        this.webSocketManager.on('logout_failure', this.handleLogoutFailure, this);
        this.webSocketManager.off('logout_response', this.handleLogoutResponse, this);
        this.webSocketManager.on('logout_response', this.handleLogoutResponse, this);
        try { this.webSocketManager.connect(); } catch {}
        if (this.tipLabel) this.tipLabel.string = '';
        if (this.changePasswordPanelNode) this.changePasswordPanelNode.active = false;
        // 只保留编辑器Click Events绑定，移除代码绑定
        if (this.logoutButton) {
            this.logoutButton.node.on(Button.EventType.CLICK, this.onLogoutClick, this);
            this.logoutButton.node.active = false;
        }
        if (this.changePasswordButton) {
            this.changePasswordButton.node.on(Button.EventType.CLICK, this.onOpenChangePasswordPanel, this);
        }
        if (this.startButton) {
            this.startButton.node.on(Button.EventType.CLICK, this.onStartButtonClick, this);
            this.startButton.node.active = false;
        }
        // 检查内存中的Token状态
        const token = this.webSocketManager.getToken();
        const hasGameIds = this.webSocketManager.hasGameIds();
        
        if (token) {
            console.log('检测到内存中的Token，准备自动登录');
            if (this.tipLabel) this.tipLabel.string = '自动登录中...';
            this.loginPanelNode.active = false;

            // 断线/返回登录页时：通常此时“没有 characterId”，但 token 仍有效
            // 因此需要显式显示“进入游戏”按钮（否则会因为初始化时强制 active=false 而看不到）
            if (this.startButton && this.startButton.node) this.startButton.node.active = !hasGameIds;
            if (this.logoutButton && this.logoutButton.node) this.logoutButton.node.active = true;

            // 主动发起一次认证，让服务端确认 token 是否有效；
            // 若无效，handleAuthFailure 会自动回退 UI。
            try {
                const userId = this.webSocketManager.getUserId();
                const characterId = this.webSocketManager.getCharacterId();
                const authMsg: any = {
                    type: GameConfig.MESSAGE_TYPES.AUTH_REQUEST,
                    token: token
                };
                if (userId) authMsg.user_id = userId;
                if (characterId) authMsg.character_id = characterId;
                this.webSocketManager.send(authMsg, false, true);
            } catch {}

            // 不在这里提前自动跳转，改为等待 auth_response 成功后再决定跳转，避免脏本地ID导致误跳。
        } else {
            console.log('内存中无Token，显示登录面板');
            this.loginPanelNode.active = true;
        }
        console.log('登录组件初始化完成');
    }

    onLoginClick() {
        if (this.isLoginRequesting) return;
        if (!this.webSocketManager) {
            this.webSocketManager = WebSocketManager.getInstance();
        }
        if (!this.webSocketManager) {
            if (this.tipLabel) this.tipLabel.string = '网络模块未初始化，请重试';
            return;
        }
        if (!this.accountEditBox || !this.passwordEditBox) {
            if (this.tipLabel) this.tipLabel.string = '登录组件未完整绑定';
            return;
        }
        const account = this.accountEditBox.string.trim();
        const password = this.passwordEditBox.string;

        if (!account || !password) {
            if (this.tipLabel) this.tipLabel.string = '账号或密码不能为空';
            return;
        }

        this.isLoginRequesting = true;
        if (this.loginButton && this.loginButton.node) this.loginButton.interactable = false;

        const trySend = () => {
            if (!this.isValid || !this.webSocketManager) return;
            if (this.webSocketManager.isConnected()) {
                this.sendLoginRequest(account, password);
            } else {
                if (this.tipLabel) this.tipLabel.string = '正在连接服务器，请稍候...';
                this.webSocketManager.connect();
                if (this._loginConnectTimer) {
                    clearTimeout(this._loginConnectTimer);
                    this._loginConnectTimer = null;
                }
                this._loginConnectTimer = setTimeout(() => {
                    this._loginConnectTimer = null;
                    if (!this.isValid || !this.webSocketManager) return;
                    if (this.webSocketManager.isConnected()) {
                        this.sendLoginRequest(account, password);
                    } else {
                        if (this.tipLabel) this.tipLabel.string = '连接服务器超时，请重试';
                        this.isLoginRequesting = false;
                        if (this.loginButton && this.loginButton.node) this.loginButton.interactable = true;
                    }
                }, 1000);
            }
        };
        trySend();
    }
    
    /**
     * 发送登录请求（优化：使用request方法，自动生成request_id）
     * 修复点：request 的回调不再调用 handleLoginResponse，避免与 on('login_response') 双触发导致重复处理。
     * 正常响应由 handleLoginResponse 通过事件统一处理；回调仅处理超时等无事件派发的情况。
     */
    private sendLoginRequest(account: string, password: string) {
        this.webSocketManager.request(
            GameConfig.MESSAGE_TYPES.LOGIN,
            {
                account: account,
                password: password
            },
            (response: any) => {
                // 统一由 request 回调处理，避免 login_response 事件与回调双触发导致状态竞争
                if (response && response.code === 408) {
                    this.isLoginRequesting = false;
                    if (this.loginButton) this.loginButton.interactable = true;
                    if (this.tipLabel) this.tipLabel.string = '登录超时，请重试';
                    return;
                }
                this.handleLoginResponse(response);
            },
            false, // 登录时不需要token认证
            10000 // 10秒超时
        );
        console.log('发送登录请求:', { account, type: GameConfig.MESSAGE_TYPES.LOGIN });
        if (this.tipLabel) this.tipLabel.string = '登录中...';
    }

    onRegisterClick() {
        if (this.isRegisterRequesting) return;
        if (!this.accountEditBox || !this.passwordEditBox) {
            if (this.tipLabel) this.tipLabel.string = '登录组件未完整绑定';
            return;
        }
        const account = this.accountEditBox.string.trim();
        const password = this.passwordEditBox.string;

        if (!account || !password) {
            if (this.tipLabel) this.tipLabel.string = '账号或密码不能为空';
            return;
        }

        this.isRegisterRequesting = true;
        if (this.registerButton && this.registerButton.node) this.registerButton.interactable = false;

        // 使用request方法发送注册请求；正常响应由 handleRegisterResponse 通过事件处理，回调仅处理超时
        this.webSocketManager.request(
            GameConfig.MESSAGE_TYPES.REGISTER,
            {
                account: account,
                password: password
            },
            (response: any) => {
                // 统一由 request 回调处理，避免 register_response 事件与回调双触发导致状态竞争
                if (response && response.code === 408) {
                    if (this.tipLabel) this.tipLabel.string = '注册超时，请重试';
                    this.isRegisterRequesting = false;
                    if (this.registerButton && this.registerButton.node) this.registerButton.interactable = true;
                    return;
                }
                this.handleRegisterResponse(response);
            },
            false, // 注册时不需要token认证
            10000 // 10秒超时
        );
        console.log('发送注册请求:', { account, type: GameConfig.MESSAGE_TYPES.REGISTER });
        if (this.tipLabel) this.tipLabel.string = ''; // 清空提示
    }

    /**
     * 处理登录响应（优化：支持标准格式和直接格式）
     */
    private handleLoginResponse(data: any) {
        this.isLoginRequesting = false;
        if (this.loginButton) this.loginButton.interactable = true;

        if (!this.loginPanelNode || !this.tipLabel) return;
        const responseData = data.data || data;
        
        if (data.success) {
            // 保存Token（支持refresh_token和过期时间）
            if (responseData.token || data.token) {
                const token = responseData.token || data.token;
                this.webSocketManager.saveToken(token);
                
                // 保存 token_expires_at（如果服务器下发），用于断线/重进后的有效性判断
                const tokenExpiresAt = responseData.token_expires_at || data.token_expires_at;
                if (tokenExpiresAt !== undefined && tokenExpiresAt !== null && tokenExpiresAt !== '') {
                    this.webSocketManager.saveTokenExpiresAt(tokenExpiresAt);
                }
            }
            // 保存refresh_token和过期时间（如果存在）
            if (responseData.refresh_token || data.refresh_token) {
                // 可以保存到localStorage或其他存储
                const refreshToken = responseData.refresh_token || data.refresh_token;
                const tokenExpiresAt = responseData.token_expires_at || data.token_expires_at;
                const refreshTokenExpiresAt = responseData.refresh_token_expires_at || data.refresh_token_expires_at;
                // TODO: 保存refresh_token和过期时间到localStorage
                console.log('保存Token信息:', { tokenExpiresAt, refreshTokenExpiresAt });
            }
            
            // 登录成功后保存userId（角色选择场景需要验证userId）
            const userId = responseData.user_id || data.user_id;
            if (userId) {
                // 注意：这里只保存userId，不保存characterId（因为还没有选择角色）
                this.webSocketManager.saveGameIds(userId, ''); // characterId设为空字符串
            }
            console.log('登录成功，user_id:', userId);
            this.loginPanelNode.active = false; // 隐藏登录面板
            if (this.startButton) {
                this.startButton.node.active = true;
            }
            if (this.logoutButton) {
                this.logoutButton.node.active = true;
            }
            // 已连接则提前拉角色列表，进选角时可与缓存对比减少重复刷 UI（未连接则忽略）
            this.prefetchCharactersIfReady();
        } else {
            const errorMessage = data.message || '登录失败';
            this.tipLabel.string = data.code === 429 ? errorMessage : `登录失败: ${errorMessage}`;
            console.error('登录失败:', { code: data.code, message: errorMessage });
        }
    }

    /**
     * 处理注册响应（优化：支持标准格式和直接格式）
     */
    private handleRegisterResponse(data: any) {
        this.isRegisterRequesting = false;
        if (this.registerButton && this.registerButton.node) this.registerButton.interactable = true;
        if (!this.tipLabel) return;

        const responseData = data.data || data;
        
        if (data.success) {
            // 保存Token（注册时只返回初始token，不返回refresh_token）
            const token = responseData.token || data.token;
            if (token) {
                this.webSocketManager.saveToken(token);
            }
            // 注册返回的 token 也可能带过期时间
            const tokenExpiresAt = responseData.token_expires_at || data.token_expires_at;
            if (tokenExpiresAt !== undefined && tokenExpiresAt !== null && tokenExpiresAt !== '') {
                this.webSocketManager.saveTokenExpiresAt(tokenExpiresAt);
            }
            
            // 注册成功后保存userId（角色选择场景需要验证userId）
            const userId = responseData.user_id || data.user_id;
            if (userId) {
                // 注意：这里只保存userId，不保存characterId（因为还没有选择角色）
                this.webSocketManager.saveGameIds(userId, ''); // characterId设为空字符串
            }
            this.tipLabel.string = '注册成功，请登录';
            console.log('注册成功，user_id:', userId);
        } else {
            // 处理错误响应
            const errorMessage = data.message || '注册失败';
            this.tipLabel.string = `注册失败: ${errorMessage}`;
            console.error('注册失败:', { code: data.code, message: errorMessage });
        }
    }

    private handleAuthResponse(data: any) {
        if (data && data.success) {
            this.handleAuthSuccess(data);
        } else {
            this.handleAuthFailure(data);
        }
    }

    /**
     * 处理认证成功
     */
    private handleAuthSuccess(data: any) {
        console.log('自动认证成功，用户ID:', data?.user_id);
        if (data?.user_id) {
            const serverCharacterId = data?.character_id || '';
            this.webSocketManager.saveGameIds(data.user_id, serverCharacterId);
        }
        if (this.tipLabel) this.tipLabel.string = '';
        if (this.loginPanelNode) this.loginPanelNode.active = false;
        if (this.startButton && this.startButton.node) this.startButton.node.active = true;
        if (this.logoutButton && this.logoutButton.node) this.logoutButton.node.active = true;

        // 仅当服务端明确返回有效 character_id 时才自动进入角色选择。
        if (data?.character_id) {
            this._autoLoginJumpCallback = () => {
                this._autoLoginJumpCallback = null;
                if (!this.isValid) return;
                director.loadScene('CharacterSelect');
            };
            this.scheduleOnce(this._autoLoginJumpCallback, 0.2);
        }
        this.prefetchCharactersIfReady();
    }

    /**
     * 处理认证失败
     */
    private handleAuthFailure(data: any) {
        console.log('自动认证失败:', data?.message);
        try { this.webSocketManager.clearAll(); } catch {}
        if (this.tipLabel) this.tipLabel.string = '自动登录失败，请重新登录';
        if (this.loginPanelNode) this.loginPanelNode.active = true;
        if (this.startButton && this.startButton.node) this.startButton.node.active = false;
        if (this.logoutButton && this.logoutButton.node) this.logoutButton.node.active = false;
    }

    /**
     * 处理网络断开
     */
    private handleNetworkDisconnect() {
        console.log('网络断开，显示登录面板');
        if (this.tipLabel) this.tipLabel.string = '网络连接已断开，请重新登录';
        if (this.loginPanelNode) this.loginPanelNode.active = true;
        if (this.startButton && this.startButton.node) this.startButton.node.active = false;
        if (this.logoutButton && this.logoutButton.node) this.logoutButton.node.active = false;
    }

    /**
     * 登出按钮点击事件
     */
    private onLogoutClick() {
        if (this.isLogoutRequesting) return;
        this.isLogoutRequesting = true;
        if (this.logoutButton) this.logoutButton.interactable = false;
        console.log('执行登出操作');
        if (!this.webSocketManager) {
            this.webSocketManager = WebSocketManager.getInstance();
        }
        if (!this.webSocketManager) {
            this.finalizeLogoutLocally('网络模块异常，已本地退出');
            return;
        }

        // 无连接时直接本地兜底，避免按钮点击无反馈
        if (!this.webSocketManager.isConnected()) {
            this.finalizeLogoutLocally('连接已断开，已本地退出');
            return;
        }

        // 登录页“登出”语义应为完全退出，必须清空 token/user/character。
        this.webSocketManager.fullLogout();

        // 服务端未回包时兜底处理，保证按钮总有反应
        if (this._logoutFallbackTimer) {
            clearTimeout(this._logoutFallbackTimer);
        }
        this._logoutFallbackTimer = setTimeout(() => {
            this._logoutFallbackTimer = null;
            if (!this.isValid || !this.isLogoutRequesting) return;
            this.finalizeLogoutLocally('已退出登录');
        }, 1500);
    }
    
    /**
     * 处理登出成功
     */
    private handleLogoutSuccess(data: any) {
        this.clearLogoutState();
        this.webSocketManager.clearAll();
        if (this.loginPanelNode) this.loginPanelNode.active = true;
        if (this.startButton && this.startButton.node) this.startButton.node.active = false;
        if (this.logoutButton && this.logoutButton.node) this.logoutButton.node.active = false;
        if (this.tipLabel) this.tipLabel.string = '登出成功';
        director.loadScene(GameConfig.SCENE_NAMES.LOGIN);
    }
    
    /**
     * 处理登出失败
     */
    private handleLogoutFailure(data: any) {
        this.clearLogoutState();
        console.error('登出失败:', data?.message);
        if (this.tipLabel) this.tipLabel.string = '登出失败: ' + (data?.message || '');
        if (this.loginPanelNode) this.loginPanelNode.active = true;
        if (this.startButton && this.startButton.node) this.startButton.node.active = false;
        if (this.logoutButton && this.logoutButton.node) this.logoutButton.node.active = false;
    }

    /**
     * 处理登出响应
     * 注意：只在登录场景中处理登出响应，避免在游戏场景中干扰登出流程
     */
    private handleLogoutResponse(data: any) {
        // 检查当前场景，只在登录场景中处理登出响应
        const currentScene = director.getScene();
        if (currentScene && currentScene.name !== GameConfig.SCENE_NAMES.LOGIN) {
            // 不在登录场景，不处理登出响应（由其他场景自己处理）
            return;
        }
        
        if (data.success) {
            this.handleLogoutSuccess(data);
        } else {
            this.handleLogoutFailure(data);
        }
    }

    private clearLogoutState() {
        if (this._logoutFallbackTimer) {
            clearTimeout(this._logoutFallbackTimer);
            this._logoutFallbackTimer = null;
        }
        this.isLogoutRequesting = false;
        if (this.logoutButton) this.logoutButton.interactable = true;
    }

    private finalizeLogoutLocally(message: string) {
        this.clearLogoutState();
        try {
            this.webSocketManager?.clearAll();
        } catch {}
        if (this.loginPanelNode) this.loginPanelNode.active = true;
        if (this.startButton && this.startButton.node) this.startButton.node.active = false;
        if (this.logoutButton && this.logoutButton.node) this.logoutButton.node.active = false;
        if (this.tipLabel) this.tipLabel.string = message;
    }
    private onOpenChangePasswordPanel() {
        const account = this.accountEditBox?.string?.trim() || '';
        if (this.changePasswordPanel) {
            this.changePasswordPanel.openFromLogin(account, (msg: string) => {
                if (this.tipLabel) this.tipLabel.string = msg;
            });
            return;
        }
        if (this.loginPanelNode) this.loginPanelNode.active = false;
        if (this.changePasswordPanelNode) this.changePasswordPanelNode.active = true;
    }

    onDestroy() {
        this.clearLogoutState();
        if (this._loginConnectTimer) {
            clearTimeout(this._loginConnectTimer);
            this._loginConnectTimer = null;
        }
        if (this._autoLoginJumpCallback) {
            this.unschedule(this._autoLoginJumpCallback);
            this._autoLoginJumpCallback = null;
        }
        if (this.logoutButton && this.logoutButton.node) {
            this.logoutButton.node.off(Button.EventType.CLICK, this.onLogoutClick, this);
        }
        if (this.startButton && this.startButton.node) {
            this.startButton.node.off(Button.EventType.CLICK, this.onStartButtonClick, this);
        }
        if (this.changePasswordButton && this.changePasswordButton.node) {
            this.changePasswordButton.node.off(Button.EventType.CLICK, this.onOpenChangePasswordPanel, this);
        }
        if (this.webSocketManager) {
            // login/register 响应已统一由 request 回调处理，保留 off 仅为安全兜底
            this.webSocketManager.off('login_response', this.handleLoginResponse, this);
            this.webSocketManager.off('register_response', this.handleRegisterResponse, this);
            this.webSocketManager.off('auth_response', this.handleAuthResponse, this);
            this.webSocketManager.off('network_disconnect', this.handleNetworkDisconnect, this);
            this.webSocketManager.off('logout_success', this.handleLogoutSuccess, this);
            this.webSocketManager.off('logout_failure', this.handleLogoutFailure, this);
            this.webSocketManager.off('logout_response', this.handleLogoutResponse, this);
        }
    }

    /**
     * Start按钮点击事件，跳转到角色选择场景
     * 修复点：跳转中禁用按钮并做有效性检查，避免重复点击触发多次 loadScene
     */
    /** 登录页侧预拉列表：仅当 WS 已连接时发送，断线不处理 */
    private prefetchCharactersIfReady(): void {
        if (!this.webSocketManager) {
            this.webSocketManager = WebSocketManager.getInstance();
        }
        if (this.webSocketManager.isConnected()) {
            this.webSocketManager.prefetchAllCharactersIfConnected(true);
        }
    }

    private onStartButtonClick() {
        if (!this.startButton || !this.startButton.node) return;
        this.startButton.interactable = false;
        console.log('🔄 准备跳转到角色选择场景');
        this.prefetchCharactersIfReady();
        try {
            director.loadScene('CharacterSelect', (error) => {
                if (error) {
                    console.error('❌ 跳转到角色选择场景失败:', error);
                    console.log('💡 请检查场景名称和构建设置');
                    if (this.isValid && this.startButton) this.startButton.interactable = true;
                } else {
                    console.log('✅ 跳转到角色选择场景成功');
                }
            });
        } catch (error) {
            console.error('❌ 场景跳转异常:', error);
            if (this.startButton) this.startButton.interactable = true;
        }
    }
}
