System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, WebSocketManager, GameConfig, _dec, _class, _crd, ccclass, property, AutoLoginUser;

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "../global/GameConfig", _context.meta, extras);
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
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      GameConfig = _unresolved_3.GameConfig;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "48162eY9ZhBlZZ1eTY+BN/x", "AutoLoginUser", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("AutoLoginUser", AutoLoginUser = (_dec = ccclass('AutoLoginUser'), _dec(_class = class AutoLoginUser extends Component {
        constructor() {
          super(...arguments);
          // 不使用硬编码默认凭证：断线/重进自动登录只依赖 WebSocketManager 的本地持久化恢复
          // 当前保存的凭证（会被手动登录/切换角色/创建角色时更新）
          this.currentToken = '';
          this.currentUserId = '';
          this.currentCharacterId = '';
          this.wsManager = null;
          // 认证状态标记
          this.isAuthenticated = false;

          /**
           * 网络连接成功回调
           */
          this.onNetworkConnect = () => {
            console.log('👤 AutoLoginUser: 网络连接成功，凭证已自动应用到WebSocketManager'); // 凭证已经在autoLogin中应用，WebSocketManager连接成功后会自动发送auth_request验证token
            // 但为了确保user_id和character_id也被发送（测试模式），我们也手动发送一次

            this.scheduleOnce(() => {
              this.sendAuthRequestWithFallback();
            }, 0.1);
          };

          /**
           * 处理认证响应
           */
          this.onAuthResponse = data => {
            if (data.success) {
              console.log('✅ [AutoLoginUser] Token验证成功，自动登录成功'); // 断线重连容错：服务端可能返回 character_id=null，
              // 此时优先使用 WebSocketManager 当前内存里的 character_id，避免把角色覆盖成 ''。

              var wsCharacterId = this.wsManager.getCharacterId();

              if (wsCharacterId && !this.currentCharacterId) {
                this.currentCharacterId = wsCharacterId;
              } // 关键修复：更新 user_id（服务器端返回的 user_id 是权威的）


              if (data.user_id) {
                console.log("\u2705 [AutoLoginUser] \u66F4\u65B0 user_id: " + data.user_id);
                this.currentUserId = data.user_id;
              } // 如果服务器端返回了 character_id（说明自动选择角色成功），使用服务器返回的


              if (data.character_id) {
                console.log("\u2705 [AutoLoginUser] \u670D\u52A1\u5668\u7AEF\u5DF2\u81EA\u52A8\u9009\u62E9\u89D2\u8272: " + data.character_id);
                this.currentCharacterId = data.character_id; // 重新应用凭证（包含更新后的 user_id 和 character_id）

                this.applyCredentials(); // 标记为已认证

                this.isAuthenticated = true;
                console.log('✅ [AutoLoginUser] 认证完成，可以正常使用游戏功能');
              } else {
                // 服务器未返回角色ID时，主动清空本地角色，避免脏ID导致状态错乱/误跳转。
                this.currentCharacterId = '';
                this.wsManager.clearCharacterId();
                this.applyCredentials();
                this.isAuthenticated = true;
              }
            } else {
              console.error('❌ [AutoLoginUser] Token验证失败:', data.message);
              this.isAuthenticated = false; // Token验证失败，但这里不做自动登录，因为可能需要用户输入账号密码
              // 如果需要自动登录，可以在这里调用登录接口（如果有账号密码的话）
            }
          };

          /**
           * 处理登录响应：更新凭证
           */
          this.onLoginResponse = data => {
            if (data.success && data.token && data.user_id) {
              console.log('👤 AutoLoginUser: 检测到登录成功，更新凭证');
              this.currentToken = data.token;
              this.currentUserId = data.user_id; // 注意：登录时还没有 character_id，所以不更新它
              // character_id 会在选择角色或创建角色时更新
            }
          };

          /**
           * 处理选择角色响应：更新凭证
           */
          this.onSelectCharacterResponse = data => {
            if (data.success && data.character_id) {
              console.log('✅ [AutoLoginUser] 检测到选择角色成功，更新凭证');
              var userId = this.wsManager.getUserId();

              if (userId) {
                this.currentUserId = userId;
              }

              this.currentCharacterId = data.character_id; // 重新应用凭证

              this.applyCredentials(); // 标记为已认证

              this.isAuthenticated = true;
              console.log('✅ [AutoLoginUser] 选择角色完成，认证状态已更新');
            }
          };

          /**
           * 处理创建角色响应：更新凭证
           */
          this.onCreateCharacterResponse = data => {
            if (data.success && data.character_id) {
              console.log('👤 AutoLoginUser: 检测到创建角色成功，更新凭证');
              var userId = this.wsManager.getUserId();
              var token = this.wsManager.getToken();

              if (userId) {
                this.currentUserId = userId;
              }

              if (token) {
                this.currentToken = token;
              }

              this.currentCharacterId = data.character_id; // 重新应用凭证

              this.applyCredentials();
            }
          };
        }

        onLoad() {
          console.log('👤 AutoLoginUser: Auto-login script loaded.');
          this.wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();

          if (!this.wsManager) {
            console.error('❌ AutoLoginUser: WebSocketManager instance not found.');
            return;
          } // 监听登录、选择角色、创建角色事件，以便更新凭证


          this.setupEventListeners(); // 初始化凭证（优先使用 WebSocketManager 中已有的凭证）

          this.initializeCredentials(); // 执行自动登录

          this.autoLogin();
        }

        onDestroy() {
          // 移除事件监听
          if (this.wsManager) {
            this.wsManager.off('login_response', this.onLoginResponse, this);
            this.wsManager.off('auth_response', this.onAuthResponse, this);
            this.wsManager.off('select_character_response', this.onSelectCharacterResponse, this);
            this.wsManager.off('create_character_response', this.onCreateCharacterResponse, this);
          }
        }
        /**
         * 设置事件监听器，监听登录、选择角色、创建角色事件
         */


        setupEventListeners() {
          // 监听登录响应
          this.wsManager.on('login_response', this.onLoginResponse, this); // 监听认证响应（auth_response），用于验证token是否有效

          this.wsManager.on('auth_response', this.onAuthResponse, this); // 监听选择角色响应

          this.wsManager.on('select_character_response', this.onSelectCharacterResponse, this); // 监听创建角色响应

          this.wsManager.on('create_character_response', this.onCreateCharacterResponse, this);
        }

        /**
         * 初始化凭证：优先使用 WebSocketManager 中已有的凭证，如果没有则使用默认值
         */
        initializeCredentials() {
          var existingToken = this.wsManager.getToken();
          var existingUserId = this.wsManager.getUserId();
          var existingCharacterId = this.wsManager.getCharacterId(); // 自动登录只依赖 token 是否存在：
          // - token+user_id：完成 auth_request 验证
          // - 可能没有 character_id：auth 成功后由 UI 引导到角色选择

          this.currentToken = existingToken || '';
          this.currentUserId = existingUserId || '';
          this.currentCharacterId = existingCharacterId || '';

          if (this.currentToken) {
            console.log('👤 AutoLoginUser: 检测到本地 token，准备自动认证');
          } else {
            console.log('👤 AutoLoginUser: 本地 token 不存在，自动登录跳过');
          }
        }

        /**
         * 应用凭证到 WebSocketManager
         */
        applyCredentials() {
          if (this.currentToken) {
            this.wsManager.saveToken(this.currentToken);
          } // 关键修复：即使只有 user_id 也要保存（character_id 可以为空字符串）


          if (this.currentUserId) {
            // 角色兜底：如果 currentCharacterId 为空，则使用 wsManager 内存里的 characterId，
            // 避免在断线重连/服务端未回传 character_id 时把角色清空。
            var fallbackCharacterId = this.wsManager.getCharacterId() || '';
            var characterId = this.currentCharacterId || fallbackCharacterId;
            this.wsManager.saveGameIds(this.currentUserId, characterId);
          }
        }
        /**
         * 执行自动登录
         */


        autoLogin() {
          console.log('👤 AutoLoginUser: Setting credentials...'); // 应用凭证

          this.applyCredentials(); // 没有 token 就不做自动登录

          if (!this.currentToken) {
            console.log('👤 AutoLoginUser: token 不存在，自动登录跳过');
            return;
          } // Ensure connection


          if (!this.wsManager.isConnected()) {
            console.log('👤 AutoLoginUser: WebSocket not connected. Initiating connection...');
            this.wsManager.connect();
          } else {
            console.log('👤 AutoLoginUser: WebSocket already connected.'); // 认证请求由 WebSocketManager 在握手/重连阶段自动触发
          }

          console.log('✅ AutoLoginUser: Credentials set successfully.');
          console.log("   Token: " + this.currentToken.substring(0, 10) + "...");
          console.log("   UserID: " + this.currentUserId);
          console.log("   CharID: " + this.currentCharacterId);
        }
        /**
         * 发送认证请求（包含user_id和character_id作为备用验证）
         */


        sendAuthRequestWithFallback() {
          var token = this.wsManager.getToken();

          if (token) {
            // 发送auth_request，包含user_id和character_id作为备用（测试模式）
            var authMsg = {
              type: (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                error: Error()
              }), GameConfig) : GameConfig).MESSAGE_TYPES.AUTH_REQUEST,
              token: token,
              character_id: this.currentCharacterId
            };
            console.log('🔄 [AutoLoginUser] 发送认证请求');
            this.wsManager.send(authMsg, false, true);
          }
        }

      }) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=77e2b676c19797b9e8639da9788a76d2a9cadbf3.js.map