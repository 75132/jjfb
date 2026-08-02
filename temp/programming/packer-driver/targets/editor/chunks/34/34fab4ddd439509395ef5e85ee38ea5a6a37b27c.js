System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, EditBox, Button, Label, director, WebSocketManager, GameConfig, ChangePasswordPanel, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _crd, ccclass, property, Login;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "../global/GameConfig", _context.meta, extras);
  }

  function _reportPossibleCrUseOfChangePasswordPanel(extras) {
    _reporterNs.report("ChangePasswordPanel", "./ChangePasswordPanel", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      Node = _cc.Node;
      EditBox = _cc.EditBox;
      Button = _cc.Button;
      Label = _cc.Label;
      director = _cc.director;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      GameConfig = _unresolved_3.GameConfig;
    }, function (_unresolved_4) {
      ChangePasswordPanel = _unresolved_4.ChangePasswordPanel;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "21752vvgT1BqZ7n+8Wdrw8q", "login", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'EditBox', 'Button', 'Label', 'director']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("Login", Login = (_dec = ccclass('Login'), _dec2 = property(Button), _dec3 = property(Button), _dec4 = property(Button), _dec5 = property(Button), _dec6 = property(Button), _dec7 = property(Node), _dec8 = property(_crd && ChangePasswordPanel === void 0 ? (_reportPossibleCrUseOfChangePasswordPanel({
        error: Error()
      }), ChangePasswordPanel) : ChangePasswordPanel), _dec9 = property(EditBox), _dec10 = property(EditBox), _dec11 = property(Label), _dec12 = property(Node), _dec13 = property({
        type: Node,
        tooltip: '进入选角加载时可选遮罩（未绑定则仅用 tipLabel）'
      }), _dec(_class = (_class2 = class Login extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "loginButton", _descriptor, this);

          _initializerDefineProperty(this, "registerButton", _descriptor2, this);

          _initializerDefineProperty(this, "startButton", _descriptor3, this);

          _initializerDefineProperty(this, "logoutButton", _descriptor4, this);

          // 添加登出按钮
          _initializerDefineProperty(this, "changePasswordButton", _descriptor5, this);

          _initializerDefineProperty(this, "changePasswordPanelNode", _descriptor6, this);

          _initializerDefineProperty(this, "changePasswordPanel", _descriptor7, this);

          _initializerDefineProperty(this, "accountEditBox", _descriptor8, this);

          _initializerDefineProperty(this, "passwordEditBox", _descriptor9, this);

          _initializerDefineProperty(this, "tipLabel", _descriptor10, this);

          _initializerDefineProperty(this, "loginPanelNode", _descriptor11, this);

          // 登录面板节点，必须手动拖拽绑定
          _initializerDefineProperty(this, "startJumpMaskNode", _descriptor12, this);

          // 游戏面板节点
          this.gamePanelNode = null;
          this.webSocketManager = null;

          /** 修复点：防抖/节流，避免高频点击重复发登录/注册请求 */
          this.isLoginRequesting = false;
          this.isRegisterRequesting = false;
          this.isLogoutRequesting = false;

          /** 修复点：自动登录跳转回调引用，便于 onDestroy 时 unschedule 取消，避免组件销毁后仍执行 */
          this._autoLoginJumpCallback = null;

          /** 修复点：记录登录连接重试定时器，避免场景切换后回调访问空对象 */
          this._loginConnectTimer = null;

          /** 修复点：登出回包超时兜底，避免“点了没反应” */
          this._logoutFallbackTimer = null;
        }

        start() {
          // 修复点：未绑定 loginPanelNode 时提前 return，避免后续访问空指针
          if (!this.loginPanelNode) {
            console.error('loginPanelNode 未绑定，请在编辑器属性面板拖拽绑定登录面板节点！');
            return;
          }

          this.webSocketManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance(); // 规范性：先绑定监听，再 connect，避免 auth_response 等事件过快到达导致错过回调
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

          try {
            this.webSocketManager.connect();
          } catch {}

          if (this.tipLabel) this.tipLabel.string = '';
          if (this.changePasswordPanelNode) this.changePasswordPanelNode.active = false; // 只保留编辑器Click Events绑定，移除代码绑定

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
          } // 检查内存中的Token状态


          const token = this.webSocketManager.getToken();
          const hasGameIds = this.webSocketManager.hasGameIds();

          if (token) {
            console.log('检测到内存中的Token，准备自动登录');
            if (this.tipLabel) this.tipLabel.string = '自动登录中...';
            this.loginPanelNode.active = false; // 断线/返回登录页时：通常此时“没有 characterId”，但 token 仍有效
            // 因此需要显式显示“进入游戏”按钮（否则会因为初始化时强制 active=false 而看不到）

            if (this.startButton && this.startButton.node) this.startButton.node.active = !hasGameIds;
            if (this.logoutButton && this.logoutButton.node) this.logoutButton.node.active = true; // 主动发起一次认证，让服务端确认 token 是否有效；
            // 若无效，handleAuthFailure 会自动回退 UI。

            try {
              const userId = this.webSocketManager.getUserId();
              const characterId = this.webSocketManager.getCharacterId();
              const authMsg = {
                type: (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                  error: Error()
                }), GameConfig) : GameConfig).MESSAGE_TYPES.AUTH_REQUEST,
                token: token
              };
              if (userId) authMsg.user_id = userId;
              if (characterId) authMsg.character_id = characterId;
              this.webSocketManager.send(authMsg, false, true);
            } catch {} // 不在这里提前自动跳转，改为等待 auth_response 成功后再决定跳转，避免脏本地ID导致误跳。

          } else {
            console.log('内存中无Token，显示登录面板');
            this.loginPanelNode.active = true;
          }

          console.log('登录组件初始化完成');
        }

        onLoginClick() {
          if (this.isLoginRequesting) return;

          if (!this.webSocketManager) {
            this.webSocketManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
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


        sendLoginRequest(account, password) {
          this.webSocketManager.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.LOGIN, {
            account: account,
            password: password
          }, response => {
            // 统一由 request 回调处理，避免 login_response 事件与回调双触发导致状态竞争
            if (response && response.code === 408) {
              this.isLoginRequesting = false;
              if (this.loginButton) this.loginButton.interactable = true;
              if (this.tipLabel) this.tipLabel.string = '登录超时，请重试';
              return;
            }

            this.handleLoginResponse(response);
          }, false, // 登录时不需要token认证
          10000 // 10秒超时
          );
          console.log('发送登录请求:', {
            account,
            type: (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.LOGIN
          });
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
          if (this.registerButton && this.registerButton.node) this.registerButton.interactable = false; // 使用request方法发送注册请求；正常响应由 handleRegisterResponse 通过事件处理，回调仅处理超时

          this.webSocketManager.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.REGISTER, {
            account: account,
            password: password
          }, response => {
            // 统一由 request 回调处理，避免 register_response 事件与回调双触发导致状态竞争
            if (response && response.code === 408) {
              if (this.tipLabel) this.tipLabel.string = '注册超时，请重试';
              this.isRegisterRequesting = false;
              if (this.registerButton && this.registerButton.node) this.registerButton.interactable = true;
              return;
            }

            this.handleRegisterResponse(response);
          }, false, // 注册时不需要token认证
          10000 // 10秒超时
          );
          console.log('发送注册请求:', {
            account,
            type: (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.REGISTER
          });
          if (this.tipLabel) this.tipLabel.string = ''; // 清空提示
        }
        /**
         * 处理登录响应（优化：支持标准格式和直接格式）
         */


        handleLoginResponse(data) {
          this.isLoginRequesting = false;
          if (this.loginButton) this.loginButton.interactable = true;
          if (!this.loginPanelNode || !this.tipLabel) return;
          const responseData = data.data || data;

          if (data.success) {
            // 保存Token（支持refresh_token和过期时间）
            if (responseData.token || data.token) {
              const token = responseData.token || data.token;
              this.webSocketManager.saveToken(token); // 保存 token_expires_at（如果服务器下发），用于断线/重进后的有效性判断

              const tokenExpiresAt = responseData.token_expires_at || data.token_expires_at;

              if (tokenExpiresAt !== undefined && tokenExpiresAt !== null && tokenExpiresAt !== '') {
                this.webSocketManager.saveTokenExpiresAt(tokenExpiresAt);
              }
            } // 保存refresh_token和过期时间（如果存在）


            if (responseData.refresh_token || data.refresh_token) {
              const refreshToken = responseData.refresh_token || data.refresh_token;
              const refreshTokenExpiresAt = responseData.refresh_token_expires_at || data.refresh_token_expires_at;
              this.webSocketManager.saveRefreshToken(refreshToken, refreshTokenExpiresAt);
            } // 登录成功后保存userId（角色选择场景需要验证userId）


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
            } // 已连接则提前拉角色列表，进选角时可与缓存对比减少重复刷 UI（未连接则忽略）


            this.prefetchCharactersIfReady();
          } else {
            const errorMessage = data.message || '登录失败';
            this.tipLabel.string = data.code === 429 ? errorMessage : `登录失败: ${errorMessage}`;
            console.error('登录失败:', {
              code: data.code,
              message: errorMessage
            });
          }
        }
        /**
         * 处理注册响应（优化：支持标准格式和直接格式）
         */


        handleRegisterResponse(data) {
          this.isRegisterRequesting = false;
          if (this.registerButton && this.registerButton.node) this.registerButton.interactable = true;
          if (!this.tipLabel) return;
          const responseData = data.data || data;

          if (data.success) {
            // 保存Token（注册时只返回初始token，不返回refresh_token）
            const token = responseData.token || data.token;

            if (token) {
              this.webSocketManager.saveToken(token);
            } // 注册返回的 token 也可能带过期时间


            const tokenExpiresAt = responseData.token_expires_at || data.token_expires_at;

            if (tokenExpiresAt !== undefined && tokenExpiresAt !== null && tokenExpiresAt !== '') {
              this.webSocketManager.saveTokenExpiresAt(tokenExpiresAt);
            } // 注册成功后保存userId（角色选择场景需要验证userId）


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
            console.error('注册失败:', {
              code: data.code,
              message: errorMessage
            });
          }
        }

        handleAuthResponse(data) {
          if (data && data.success) {
            this.handleAuthSuccess(data);
          } else {
            this.handleAuthFailure(data);
          }
        }
        /**
         * 处理认证成功
         */


        handleAuthSuccess(data) {
          console.log('自动认证成功，用户ID:', data == null ? void 0 : data.user_id);

          if (data != null && data.user_id) {
            const serverCharacterId = (data == null ? void 0 : data.character_id) || '';
            this.webSocketManager.saveGameIds(data.user_id, serverCharacterId);
          }

          if (this.tipLabel) this.tipLabel.string = '';
          if (this.loginPanelNode) this.loginPanelNode.active = false;
          if (this.startButton && this.startButton.node) this.startButton.node.active = true;
          if (this.logoutButton && this.logoutButton.node) this.logoutButton.node.active = true; // 仅当服务端明确返回有效 character_id 时才自动进入角色选择。

          if (data != null && data.character_id) {
            if (this.tipLabel) this.tipLabel.string = '正在进入选角…';
            if (this.startJumpMaskNode) this.startJumpMaskNode.active = true;

            this._autoLoginJumpCallback = () => {
              this._autoLoginJumpCallback = null;
              if (!this.isValid) return;
              director.loadScene((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                error: Error()
              }), GameConfig) : GameConfig).SCENE_NAMES.CHARACTER_SELECT);
            };

            this.scheduleOnce(this._autoLoginJumpCallback, 0.2);
          }

          this.prefetchCharactersIfReady();
        }
        /**
         * 处理认证失败
         */


        handleAuthFailure(data) {
          console.log('自动认证失败:', data == null ? void 0 : data.message);

          try {
            this.webSocketManager.clearAll();
          } catch {}

          if (this.tipLabel) this.tipLabel.string = '自动登录失败，请重新登录';
          if (this.loginPanelNode) this.loginPanelNode.active = true;
          if (this.startButton && this.startButton.node) this.startButton.node.active = false;
          if (this.logoutButton && this.logoutButton.node) this.logoutButton.node.active = false;
        }
        /**
         * 处理网络断开
         */


        handleNetworkDisconnect() {
          console.log('网络断开，显示登录面板');
          if (this.tipLabel) this.tipLabel.string = '网络连接已断开，请重新登录';
          if (this.loginPanelNode) this.loginPanelNode.active = true;
          if (this.startButton && this.startButton.node) this.startButton.node.active = false;
          if (this.logoutButton && this.logoutButton.node) this.logoutButton.node.active = false;
        }
        /**
         * 登出按钮点击事件
         */


        onLogoutClick() {
          if (this.isLogoutRequesting) return;
          this.isLogoutRequesting = true;
          if (this.logoutButton) this.logoutButton.interactable = false;
          console.log('执行登出操作');

          if (!this.webSocketManager) {
            this.webSocketManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
          }

          if (!this.webSocketManager) {
            this.finalizeLogoutLocally('网络模块异常，已本地退出');
            return;
          } // 无连接时直接本地兜底，避免按钮点击无反馈


          if (!this.webSocketManager.isConnected()) {
            this.finalizeLogoutLocally('连接已断开，已本地退出');
            return;
          } // 登录页“登出”语义应为完全退出，必须清空 token/user/character。


          this.webSocketManager.fullLogout(); // 服务端未回包时兜底处理，保证按钮总有反应

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


        handleLogoutSuccess(data) {
          this.clearLogoutState();
          this.webSocketManager.clearAll();
          if (this.loginPanelNode) this.loginPanelNode.active = true;
          if (this.startButton && this.startButton.node) this.startButton.node.active = false;
          if (this.logoutButton && this.logoutButton.node) this.logoutButton.node.active = false;
          if (this.tipLabel) this.tipLabel.string = '登出成功';
          director.loadScene((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).SCENE_NAMES.LOGIN);
        }
        /**
         * 处理登出失败
         */


        handleLogoutFailure(data) {
          this.clearLogoutState();
          console.error('登出失败:', data == null ? void 0 : data.message);
          if (this.tipLabel) this.tipLabel.string = '登出失败: ' + ((data == null ? void 0 : data.message) || '');
          if (this.loginPanelNode) this.loginPanelNode.active = true;
          if (this.startButton && this.startButton.node) this.startButton.node.active = false;
          if (this.logoutButton && this.logoutButton.node) this.logoutButton.node.active = false;
        }
        /**
         * 处理登出响应
         * 注意：只在登录场景中处理登出响应，避免在游戏场景中干扰登出流程
         */


        handleLogoutResponse(data) {
          // 检查当前场景，只在登录场景中处理登出响应
          const currentScene = director.getScene();

          if (currentScene && currentScene.name !== (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).SCENE_NAMES.LOGIN) {
            // 不在登录场景，不处理登出响应（由其他场景自己处理）
            return;
          }

          if (data.success) {
            this.handleLogoutSuccess(data);
          } else {
            this.handleLogoutFailure(data);
          }
        }

        clearLogoutState() {
          if (this._logoutFallbackTimer) {
            clearTimeout(this._logoutFallbackTimer);
            this._logoutFallbackTimer = null;
          }

          this.isLogoutRequesting = false;
          if (this.logoutButton) this.logoutButton.interactable = true;
        }

        finalizeLogoutLocally(message) {
          this.clearLogoutState();

          try {
            var _this$webSocketManage;

            (_this$webSocketManage = this.webSocketManager) == null || _this$webSocketManage.clearAll();
          } catch {}

          if (this.loginPanelNode) this.loginPanelNode.active = true;
          if (this.startButton && this.startButton.node) this.startButton.node.active = false;
          if (this.logoutButton && this.logoutButton.node) this.logoutButton.node.active = false;
          if (this.tipLabel) this.tipLabel.string = message;
        }

        onOpenChangePasswordPanel() {
          var _this$accountEditBox;

          const account = ((_this$accountEditBox = this.accountEditBox) == null || (_this$accountEditBox = _this$accountEditBox.string) == null ? void 0 : _this$accountEditBox.trim()) || '';

          if (this.changePasswordPanel) {
            this.changePasswordPanel.openFromLogin(account, msg => {
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


        prefetchCharactersIfReady() {
          if (!this.webSocketManager) {
            this.webSocketManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
          }

          if (this.webSocketManager.isConnected()) {
            this.webSocketManager.prefetchAllCharactersIfConnected(true);
          }
        }

        onStartButtonClick() {
          if (!this.startButton || !this.startButton.node) return;
          this.startButton.interactable = false;
          if (this.tipLabel) this.tipLabel.string = '正在进入选角…';
          if (this.startJumpMaskNode) this.startJumpMaskNode.active = true;
          console.log('🔄 准备跳转到角色选择场景');
          this.prefetchCharactersIfReady();

          try {
            director.loadScene((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).SCENE_NAMES.CHARACTER_SELECT, error => {
              if (error) {
                console.error('❌ 跳转到角色选择场景失败:', error);
                console.log('💡 请检查场景名称和构建设置');
                if (this.isValid && this.startButton) this.startButton.interactable = true;
                if (this.isValid && this.tipLabel) this.tipLabel.string = '';
                if (this.isValid && this.startJumpMaskNode) this.startJumpMaskNode.active = false;
              } else {
                console.log('✅ 跳转到角色选择场景成功');
              }
            });
          } catch (error) {
            console.error('❌ 场景跳转异常:', error);
            if (this.startButton) this.startButton.interactable = true;
            if (this.tipLabel) this.tipLabel.string = '';
            if (this.startJumpMaskNode) this.startJumpMaskNode.active = false;
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "loginButton", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "registerButton", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "startButton", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "logoutButton", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "changePasswordButton", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "changePasswordPanelNode", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "changePasswordPanel", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "accountEditBox", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "passwordEditBox", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "tipLabel", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "loginPanelNode", [_dec12], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "startJumpMaskNode", [_dec13], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=34fab4ddd439509395ef5e85ee38ea5a6a37b27c.js.map