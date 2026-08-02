System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, director, GameConfig, RequestRetryManager, RouteDictionary, DataCacheManager, _dec, _class, _class2, _crd, ccclass, property, WebSocketManager;

  function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "./GameConfig", _context.meta, extras);
  }

  function _reportPossibleCrUseOfClientMessage(extras) {
    _reporterNs.report("ClientMessage", "./MessageTypes", _context.meta, extras);
  }

  function _reportPossibleCrUseOfRequestRetryManager(extras) {
    _reporterNs.report("RequestRetryManager", "./RequestRetryManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfRouteDictionary(extras) {
    _reporterNs.report("RouteDictionary", "./RouteDictionary", _context.meta, extras);
  }

  function _reportPossibleCrUseOfDataCacheManager(extras) {
    _reporterNs.report("DataCacheManager", "./DataCacheManager", _context.meta, extras);
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
      director = _cc.director;
    }, function (_unresolved_2) {
      GameConfig = _unresolved_2.GameConfig;
    }, function (_unresolved_3) {
      RequestRetryManager = _unresolved_3.RequestRetryManager;
    }, function (_unresolved_4) {
      RouteDictionary = _unresolved_4.RouteDictionary;
    }, function (_unresolved_5) {
      DataCacheManager = _unresolved_5.DataCacheManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "9eef6CpLKFDiqLKFRox9mEC", "WebSocketManager", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'director']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("WebSocketManager", WebSocketManager = (_dec = ccclass('WebSocketManager'), _dec(_class = (_class2 = class WebSocketManager extends Component {
        constructor() {
          super(...arguments);
          this.socket = null;
          this.url = (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).getWsUrl();
          this.reconnectDelay = (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).RECONNECT_DELAY;
          this.isConnectedFlag = false;
          this.isReconnecting = false;
          this.maxReconnectAttempts = (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MAX_RECONNECT_ATTEMPTS;
          this.reconnectAttempts = 0;
          this.isGameRunning = false;
          this.messageQueue = [];
          this.isConnecting = false;

          /** 防重：同一时刻只允许一个连接在飞；并忽略旧 socket 回调 */
          this._connectSeq = 0;

          /** 记录重连定时器，避免多处重复 setTimeout 导致“连环重连” */
          this._reconnectTimerId = -1;

          /** 游戏内「切换角色/返回选角」流程中：即将断开当前角色会话（非登录页的账号登出） */
          this.isSwitchingCharacterSession = false;
          this.currentToken = null;
          this.currentUserId = null;
          this.currentCharacterId = null;
          // 路由字典（延迟初始化，避免循环依赖）
          this.routeDict = null;
          this.useRouteDict = false;
          // 是否使用路由压缩（由服务器 handshake 决定）
          // 消息协议版本（用于版本兼容性检查）
          this.MESSAGE_PROTOCOL_VERSION = '1.0.0';

          /**
           * 当前连接是否已通过鉴权（以 auth_response 为准；断线/清凭证即失效）。
           * 选角等场景可结合 tryMarkSessionAuthenticatedIfConnected 处理「不断线无二次 auth_response」。
           */
          this.sessionAuthenticated = false;

          /** 最近一次成功 all_characters_response 的规范化指纹（用于选角去重刷 UI） */
          this.lastAllCharactersFingerprint = '';
          this.heartbeatTimer = -1;
          this.HEARTBEAT_INTERVAL = 30000;
          // 握手状态标记
          this.handshakeCompleted = false;
          this.handshakeTimeout = -1;
        }

        /**
         * 获取 RouteDictionary 实例（延迟初始化）
         */
        getRouteDict() {
          if (!this.routeDict) {
            this.routeDict = (_crd && RouteDictionary === void 0 ? (_reportPossibleCrUseOfRouteDictionary({
              error: Error()
            }), RouteDictionary) : RouteDictionary).getInstance();
          }

          return this.routeDict;
        }

        static getInstance() {
          if (!this.instance) {
            var node = new Node('WebSocketManager');
            this.instance = node.addComponent(WebSocketManager);
            this.instanceNode = node;
            director.addPersistRootNode(node);
          }

          return this.instance;
        }

        isConnected() {
          return this.isConnectedFlag;
        }

        isSessionAuthenticated() {
          return this.sessionAuthenticated;
        }
        /**
         * 已连接且具备 token + userId 时，将会话标为已鉴权（用于不断线返回选角等收不到第二次 auth_response 的兜底）。
         * 若服务端已踢线，后续请求会以 401 体现，由业务层处理。
         */


        tryMarkSessionAuthenticatedIfConnected() {
          if (!this.isConnectedFlag) return false;
          var t = this.getToken();
          var u = this.getUserId();
          if (!t || !u) return false;
          this.sessionAuthenticated = true;
          return true;
        }
        /**
         * 与 requestGetAllCharactersNow 等价（保留旧调用点；不再做延迟合并）
         */


        scheduleGetAllCharacters(requireAuth) {
          if (requireAuth === void 0) {
            requireAuth = true;
          }

          this.requestGetAllCharactersNow(requireAuth);
        }
        /**
         * 立即请求角色列表
         */


        requestGetAllCharactersNow(requireAuth) {
          if (requireAuth === void 0) {
            requireAuth = true;
          }

          if (!this.isConnectedFlag || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
          }

          var requestId = "all_chars_" + Date.now();
          this.send({
            type: 'get_all_characters',
            request_id: requestId
          }, requireAuth, false);
        }
        /** 已连接则预拉角色列表（登录成功、进选角前、游戏内回选角等；未连接则忽略） */


        prefetchAllCharactersIfConnected(requireAuth) {
          if (requireAuth === void 0) {
            requireAuth = true;
          }

          this.requestGetAllCharactersNow(requireAuth);
        }
        /**
         * 对批量角色表做稳定指纹，供选角对比是否需重绘
         */


        static fingerprintAllCharactersPayload(characters) {
          if (!characters || typeof characters !== 'object') return '';
          var slotKeys = Object.keys(characters).map(k => parseInt(k, 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
          var norm = [];

          for (var si of slotKeys) {
            var _characters$key;

            var key = String(si);
            var v = (_characters$key = characters[key]) != null ? _characters$key : characters[si];
            norm.push([si, v]);
          }

          try {
            return JSON.stringify(norm);
          } catch (_unused) {
            return '';
          }
        }

        getLastAllCharactersFingerprint() {
          return this.lastAllCharactersFingerprint;
        }

        invalidateSessionAuth() {
          this.sessionAuthenticated = false;
          this.lastAllCharactersFingerprint = '';
        }

        applyAuthResponseToSession(data) {
          if (data && data.success) {
            this.sessionAuthenticated = true;
            this.markAuthVerifiedNow();
          } else {
            this.sessionAuthenticated = false;
          }
        }
        /**
         * 标记“本次鉴权成功”的时间戳，用于离线安全阀 TTL。
         * 只有登录/鉴权成功后才更新，失败不更新。
         */


        markAuthVerifiedNow() {
          try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(WebSocketManager.LS_LAST_AUTH_VERIFIED_AT, String(Date.now()));
          } catch (_unused2) {// ignore
          }
        }
        /**
         * 读取最近一次成功鉴权时间戳（毫秒）。
         */


        getLastAuthVerifiedAtMs() {
          try {
            if (typeof localStorage === 'undefined') return null;
            var raw = localStorage.getItem(WebSocketManager.LS_LAST_AUTH_VERIFIED_AT);
            if (!raw) return null;
            var n = Number(raw);
            return Number.isFinite(n) ? n : null;
          } catch (_unused3) {
            return null;
          }
        }
        /**
         * 安全阀：离线/未鉴权超过阈值 => 不允许直接用本地 token 自动重连，必须回登录。
         */


        isReloginRequiredByIdle() {
          var token = this.getToken();
          if (!token) return false; // 没 token 就不存在“自动上线”风险

          var lastAuthAt = this.getLastAuthVerifiedAtMs();

          if (!lastAuthAt) {
            // 从未成功鉴权（或旧版本未写入时间戳）=> 保守：要求回登录一次
            return true;
          }

          var idleMs = Date.now() - lastAuthAt;
          return idleMs > (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).AUTH_INACTIVITY_RELOGIN_MS;
        }
        /**
         * 发送消息（原有方法，保持兼容）
         * 关键修复：自动添加 user_id 和 character_id 作为备用验证（测试模式支持）
         */


        send(message, requireAuth, immediate) {
          if (requireAuth === void 0) {
            requireAuth = true;
          }

          if (immediate === void 0) {
            immediate = false;
          }

          var msgWithAuth = _extends({}, message); // 如果启用字典压缩，添加 route_id（同时保留 type 字段，向后兼容）


          if (this.useRouteDict && message.type) {
            var routeId = this.getRouteDict().encodeRoute(message.type);

            if (routeId !== null) {
              msgWithAuth.route_id = routeId;
            }
          }

          if (requireAuth) {
            var token = this.getToken();

            if (token) {
              msgWithAuth = _extends({}, msgWithAuth, {
                token
              });
            } // 关键修复：自动添加 user_id 和 character_id 作为备用验证（测试模式）
            // 这样即使 token 无效，服务器也能通过 user_id 验证用户身份


            var userId = this.getUserId();
            var characterId = this.getCharacterId();

            if (userId) {
              msgWithAuth.user_id = userId;
            }

            if (characterId) {
              msgWithAuth.character_id = characterId;
            }
          } // 如果未连接，加入离线队列（保持发送顺序）；连接后由 flushMessageQueue 按序发出


          if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.isConnectedFlag) {
            this.messageQueue.push(msgWithAuth);

            if (!this.isConnecting) {
              this.connect();
            }

            return;
          } // 直发：服务端无批量协议，原批处理层最终仍逐条 send，仅增加延迟


          try {
            this.socket.send(JSON.stringify(msgWithAuth));
          } catch (_unused4) {
            this.messageQueue.push(msgWithAuth);
          }
        }
        /**
         * Request 方法 - 参考 Pomelo 设计
         * 发送请求并等待响应（通过回调）
         * 
         * @param route 路由名称（消息类型）
         * @param data 消息数据
         * @param callback 响应回调函数
         * @param requireAuth 是否需要认证
         * @param timeout 超时时间（毫秒），默认 10 秒
         */


        request(route, data, callback, requireAuth, timeout) {
          if (data === void 0) {
            data = {};
          }

          if (requireAuth === void 0) {
            requireAuth = true;
          }

          if (timeout === void 0) {
            timeout = 10000;
          }

          // 超时重试（针对只读查询，避免偶发 408 直接失败）
          var RETRY_ON_TIMEOUT_ROUTES = new Set(['bag_get', 'bag_has_items', 'get_robot_pets', 'get_character_info', 'get_player', 'get_chat_history', 'get_announcements_history', 'battle_room_resume', 'world_enter']); // 生成 request_id（如果消息中没有）

          if (!data.request_id) {
            data.request_id = (_crd && RequestRetryManager === void 0 ? (_reportPossibleCrUseOfRequestRetryManager({
              error: Error()
            }), RequestRetryManager) : RequestRetryManager).generateRequestId(route, data);
          }

          var requestId = data.request_id; // 构建请求消息

          var message = _extends({
            type: route
          }, data); // 如果启用字典压缩，添加 route_id（同时保留 type 字段，向后兼容）


          if (this.useRouteDict && route) {
            var routeId = this.getRouteDict().encodeRoute(route);

            if (routeId !== null) {
              message.route_id = routeId;
            }
          } // 如果有回调，监听响应


          if (callback) {
            // 路由与服务端真实返回的事件 type 并非总是 `${route}_response`
            // 这里做兼容映射，避免监听错事件导致请求一直超时重试
            var responseType = route + "_response";

            switch (route) {
              case 'get_character_info':
                responseType = 'character_info_response';
                break;

              case 'bag_get':
                responseType = 'bag_items';
                break;

              case 'bag_has_items':
                responseType = 'bag_has_items_response';
                break;

              case 'get_robot_pets':
                responseType = 'robot_pets_response';
                break;

              case 'get_player':
                // 服务端 send_success_response(..., 'player_info') → player_info_response
                responseType = 'player_info_response';
                break;

              case 'get_robot_pet_info':
                // 服务端成功/失败均为 robot_pet_info_response（非 get_robot_pet_info_response）
                responseType = 'robot_pet_info_response';
                break;

              case 'world_enter':
                responseType = 'world_enter_response';
                break;

              case 'world_leave':
                responseType = 'world_leave_response';
                break;

              case 'world_step':
                responseType = 'world_step_response';
                break;
            }

            var timeoutId = -1;
            var responded = false; // 响应处理器

            var responseHandler = response => {
              if (responded) return; // ✅ 验证 request_id 匹配（如果响应中包含 request_id）

              if (response.request_id !== undefined && response.request_id !== null) {
                if (response.request_id !== requestId) {
                  // request_id 不匹配，忽略此响应（可能是其他请求的响应）
                  console.log("[Request] \u23ED\uFE0F \u5FFD\u7565 request_id \u4E0D\u5339\u914D\u7684\u54CD\u5E94 (" + route + "):", {
                    received: response.request_id,
                    expected: requestId
                  });
                  return;
                }

                console.log("[Request] \u2705 request_id \u5339\u914D (" + route + "):", requestId);
              } else {
                // 如果没有 request_id，使用旧的匹配方式（向后兼容）
                console.log("[Request] \u26A0\uFE0F \u54CD\u5E94\u7F3A\u5C11 request_id\uFF0C\u4F7F\u7528\u65E7\u5339\u914D\u65B9\u5F0F (" + route + ")");
              }

              responded = true;

              if (timeoutId !== -1) {
                clearTimeout(timeoutId);
              } // 移除监听


              this.off(responseType, responseHandler); // 处理特殊错误码（429限流、503服务器繁忙）

              if (!response.success) {
                var code = response.code || 500; // 限流错误（429）- 不自动重试，显示友好提示

                if (code === 429) {
                  console.warn("\u26A0\uFE0F [WebSocketManager] \u8BF7\u6C42\u9650\u6D41: " + route); // 可以在这里显示友好提示（如果有UI提示组件）
                  // 例如：ToastManager.getInstance()?.show('操作过于频繁，请稍后再试');
                } // 服务器繁忙（503）- 延迟后重试（最多重试1次）


                if (code === 503) {
                  console.warn("\u26A0\uFE0F [WebSocketManager] \u670D\u52A1\u5668\u7E41\u5FD9: " + route); // 延迟3秒后重试（最多重试1次）

                  var retryCount = (data._retryCount || 0) + 1;

                  if (retryCount <= 1) {
                    console.log("\uD83D\uDD04 [WebSocketManager] 3\u79D2\u540E\u81EA\u52A8\u91CD\u8BD5 (" + route + ")");
                    setTimeout(() => {
                      var retryData = _extends({}, data, {
                        _retryCount: retryCount
                      });

                      this.request(route, retryData, callback, requireAuth, timeout);
                    }, 3000);
                    return; // 不调用回调，等待重试结果
                  } else {
                    console.warn("\u26A0\uFE0F [WebSocketManager] \u91CD\u8BD5\u6B21\u6570\u5DF2\u8FBE\u4E0A\u9650\uFF0C\u653E\u5F03\u91CD\u8BD5 (" + route + ")"); // 可以显示友好提示
                    // 例如：ToastManager.getInstance()?.show('服务器繁忙，请稍后再试');
                  }
                }
              } // 调用回调


              try {
                callback(response);
              } catch (error) {
                console.error("[Request] \u56DE\u8C03\u6267\u884C\u9519\u8BEF (" + route + "):", error);
              }
            }; // 设置超时


            timeoutId = setTimeout(() => {
              if (!responded) {
                responded = true;
                this.off(responseType, responseHandler);
                console.warn("[Request] \u8BF7\u6C42\u8D85\u65F6 (" + route + "), request_id: " + requestId); // 仅对部分只读路由执行一次超时重试

                var canRetry = RETRY_ON_TIMEOUT_ROUTES.has(route);
                var timeoutRetryCount = (data._timeoutRetryCount || 0) + 1;

                if (canRetry && timeoutRetryCount <= 1) {
                  console.log("\uD83D\uDD04 [WebSocketManager] \u8BF7\u6C42\u8D85\u65F6\u81EA\u52A8\u91CD\u8BD5 (" + route + ")\uFF0C\u7B2C " + timeoutRetryCount + " \u6B21");
                  setTimeout(() => {
                    var retryData = _extends({}, data, {
                      _timeoutRetryCount: timeoutRetryCount
                    });

                    this.request(route, retryData, callback, requireAuth, timeout);
                  }, 3000);
                  return;
                }

                callback({
                  success: false,
                  code: 408,
                  message: 'Request timeout',
                  type: responseType,
                  request_id: requestId
                });
              }
            }, timeout); // 监听响应

            this.on(responseType, responseHandler);
          } // 发送请求


          this.send(message, requireAuth, false);
        }
        /**
         * Notify 方法 - 参考 Pomelo 设计
         * 发送通知（不需要响应）
         * 
         * @param route 路由名称
         * @param data 消息数据
         * @param requireAuth 是否需要认证
         */


        notify(route, data, requireAuth) {
          if (data === void 0) {
            data = {};
          }

          if (requireAuth === void 0) {
            requireAuth = true;
          }

          var message = _extends({
            type: route
          }, data);

          this.send(message, requireAuth, false);
        }

        getToken() {
          if (this.currentToken) return this.currentToken; // 懒加载：从本地恢复 token（用于“重进自动登录”）

          try {
            if (typeof localStorage !== 'undefined') {
              var lastToken = localStorage.getItem(WebSocketManager.LS_LAST_TOKEN);
              if (!lastToken) return null; // 可选：如果 token_expires_at 存在且能解析，超时则清除

              var expiresAtRaw = localStorage.getItem(WebSocketManager.LS_LAST_TOKEN_EXPIRES_AT);

              if (expiresAtRaw) {
                var expiresAt = this.parseExpiresAtMs(expiresAtRaw);

                if (expiresAt !== null && Date.now() >= expiresAt) {
                  this.clearToken();
                  return null;
                }
              }

              this.currentToken = lastToken;
              return lastToken;
            }
          } catch (_) {}

          return this.currentToken;
        }

        saveToken(token) {
          var hadToken = this.currentToken !== null;
          this.currentToken = token; // 断线/重进自动登录需要 token 持久化

          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(WebSocketManager.LS_LAST_TOKEN, token);
            }
          } catch (_) {} // 触发数据变化事件（MMO最佳实践：通知其他组件token已设置）


          if (!hadToken && token) {
            this.emitDataChanged('token_saved');
          }
        }

        clearToken() {
          var hadToken = this.currentToken !== null;
          this.currentToken = null;
          this.isGameRunning = false;
          this.invalidateSessionAuth(); // 清 token 时同步清持久化，避免“已退出/已过期”还在自动登录

          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.removeItem(WebSocketManager.LS_LAST_TOKEN);
              localStorage.removeItem(WebSocketManager.LS_LAST_TOKEN_EXPIRES_AT);
              localStorage.removeItem(WebSocketManager.LS_LAST_REFRESH_TOKEN);
              localStorage.removeItem(WebSocketManager.LS_LAST_REFRESH_TOKEN_EXPIRES_AT);
              localStorage.removeItem(WebSocketManager.LS_LAST_AUTH_VERIFIED_AT);
            }
          } catch (_) {} // 触发数据变化事件（立即通知监听者）


          if (hadToken) {
            this.emitDataChanged('token_cleared');
          }
        } // 尝试解析服务器下发的过期时间到毫秒


        parseExpiresAtMs(expiresAtRaw) {
          try {
            // ISO 时间
            if (expiresAtRaw.includes('-')) {
              var t = Date.parse(expiresAtRaw);
              return Number.isFinite(t) ? t : null;
            }

            var num = Number(expiresAtRaw);
            if (!Number.isFinite(num) || num <= 0) return null; // 可能是秒（通常 < 1e12）

            if (num < 1e12) return Math.floor(num * 1000);
            return Math.floor(num);
          } catch (_unused5) {
            return null;
          }
        } // 保存 token 过期时间（用于 getToken 的到期校验）


        saveTokenExpiresAt(expiresAt) {
          try {
            if (typeof localStorage === 'undefined') return;

            if (expiresAt === null || expiresAt === undefined || expiresAt === '') {
              localStorage.removeItem(WebSocketManager.LS_LAST_TOKEN_EXPIRES_AT);
              return;
            }

            localStorage.setItem(WebSocketManager.LS_LAST_TOKEN_EXPIRES_AT, String(expiresAt));
          } catch (_) {}
        }

        saveRefreshToken(refreshToken, refreshExpiresAt) {
          try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(WebSocketManager.LS_LAST_REFRESH_TOKEN, refreshToken);

            if (refreshExpiresAt !== undefined && refreshExpiresAt !== null && refreshExpiresAt !== '') {
              localStorage.setItem(WebSocketManager.LS_LAST_REFRESH_TOKEN_EXPIRES_AT, String(refreshExpiresAt));
            }
          } catch (_) {}
        }

        getRefreshToken() {
          try {
            if (typeof localStorage === 'undefined') return null;
            return localStorage.getItem(WebSocketManager.LS_LAST_REFRESH_TOKEN);
          } catch (_) {
            return null;
          }
        }
        /** access token 将过期时尝试用 refresh_token 换新 */


        tryRefreshTokenIfNeeded(onDone) {
          try {
            var expiresRaw = localStorage.getItem(WebSocketManager.LS_LAST_TOKEN_EXPIRES_AT);
            var refresh = this.getRefreshToken();

            if (!refresh || !expiresRaw) {
              onDone == null || onDone(false);
              return;
            }

            var expiresAt = this.parseExpiresAtMs(expiresRaw);

            if (expiresAt === null || Date.now() < expiresAt - 60000) {
              onDone == null || onDone(true);
              return;
            }

            this.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.REFRESH_TOKEN, {
              refresh_token: refresh
            }, resp => {
              if (!(resp != null && resp.success)) {
                onDone == null || onDone(false);
                return;
              }

              var d = resp.data || resp;
              var token = d.token || resp.token;
              if (token) this.saveToken(token);
              var te = d.token_expires_at || resp.token_expires_at;
              if (te) this.saveTokenExpiresAt(te);
              var rt = d.refresh_token || resp.refresh_token;
              var rte = d.refresh_token_expires_at || resp.refresh_token_expires_at;
              if (rt) this.saveRefreshToken(rt, rte);
              onDone == null || onDone(true);
            }, false, 10000);
          } catch (_unused6) {
            onDone == null || onDone(false);
          }
        }

        clearUserId() {
          var hadUserId = this.currentUserId !== null;
          this.currentUserId = null; // 触发数据变化事件（立即通知监听者）

          if (hadUserId) {
            this.emitDataChanged('user_id_cleared');
          }
        }

        clearCharacterId() {
          var cacheManager = (_crd && DataCacheManager === void 0 ? (_reportPossibleCrUseOfDataCacheManager({
            error: Error()
          }), DataCacheManager) : DataCacheManager).getInstance(); // 关键修复：切换角色时清空「所有」数据缓存，避免新角色仍读到旧角色数据

          cacheManager.clearAllCache(); // 关键修复：清除 localStorage 中的 last_character_id，否则 getCharacterId() 会从本地恢复成上一个角色，导致「切换角色后进去还是第一个角色的数据」

          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.removeItem(WebSocketManager.LS_LAST_CHARACTER_ID);
            }
          } catch (_) {} // 不再清除 ResourceManager 缓存：JSON/图集等为账号级共享，与角色无关；清掉会导致机甲列表等巨慢。


          var hadCharacterId = this.currentCharacterId !== null;
          this.currentCharacterId = null; // 触发数据变化事件（立即通知监听者）

          if (hadCharacterId) {
            this.emitDataChanged('character_id_cleared');
          }
        }

        clearAll() {
          // 关键修复：清除所有缓存（完全登出时）
          var cacheManager = (_crd && DataCacheManager === void 0 ? (_reportPossibleCrUseOfDataCacheManager({
            error: Error()
          }), DataCacheManager) : DataCacheManager).getInstance();
          cacheManager.clearAllCache();
          var hadData = !!(this.currentToken || this.currentUserId || this.currentCharacterId);
          this.currentToken = null;
          this.currentUserId = null;
          this.currentCharacterId = null; // 完全清除持久化（完全登出/重连失败）

          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.removeItem(WebSocketManager.LS_LAST_TOKEN);
              localStorage.removeItem(WebSocketManager.LS_LAST_TOKEN_EXPIRES_AT);
              localStorage.removeItem(WebSocketManager.LS_LAST_REFRESH_TOKEN);
              localStorage.removeItem(WebSocketManager.LS_LAST_REFRESH_TOKEN_EXPIRES_AT);
              localStorage.removeItem(WebSocketManager.LS_LAST_USER_ID);
              localStorage.removeItem(WebSocketManager.LS_LAST_CHARACTER_ID);
              localStorage.removeItem(WebSocketManager.LS_LAST_AUTH_VERIFIED_AT);
            }
          } catch (_) {}

          this.isGameRunning = false;
          this.invalidateSessionAuth(); // 触发数据变化事件（立即通知监听者）

          if (hadData) {
            this.emitDataChanged('all_cleared');
          }
        }
        /**
         * 触发数据变化事件（供内部使用）
         */


        emitDataChanged(reason) {
          var node = this.node;

          if (node && typeof node.emit === 'function') {
            node.emit('data_changed', {
              reason,
              token: this.currentToken,
              userId: this.currentUserId,
              characterId: this.currentCharacterId
            });
          }
        }

        saveGameIds(userId, characterId) {
          var hadGameIds = !!(this.currentUserId && this.currentCharacterId);
          this.currentUserId = userId;
          this.currentCharacterId = characterId; // 断线/重进自动登录需要：持久化 user_id / character_id
          // 登录时 characterId 可能为空字符串：依然要持久化 user_id

          try {
            if (typeof localStorage !== 'undefined') {
              if (userId) {
                localStorage.setItem(WebSocketManager.LS_LAST_USER_ID, userId);
              }

              if (characterId) {
                localStorage.setItem(WebSocketManager.LS_LAST_CHARACTER_ID, characterId);
              } else {
                localStorage.removeItem(WebSocketManager.LS_LAST_CHARACTER_ID);
              }
            }
          } catch (_) {} // 触发数据变化事件（MMO最佳实践：通知其他组件游戏ID已设置）


          if (!hadGameIds && userId && characterId) {
            this.emitDataChanged('game_ids_saved');
          }
        }

        getUserId() {
          if (this.currentUserId) return this.currentUserId; // 懒加载：从本地恢复 user_id（用于“重进自动登录”）

          try {
            if (typeof localStorage !== 'undefined') {
              var last = localStorage.getItem(WebSocketManager.LS_LAST_USER_ID);

              if (last) {
                this.currentUserId = last;
                return last;
              }
            }
          } catch (_) {}

          return this.currentUserId;
        }

        getCharacterId() {
          if (this.currentCharacterId) return this.currentCharacterId; // 懒加载：从本地恢复 character_id（用于“重进自动登录”）

          try {
            if (typeof localStorage !== 'undefined') {
              var last = localStorage.getItem(WebSocketManager.LS_LAST_CHARACTER_ID);

              if (last) {
                this.currentCharacterId = last;
                return last;
              }
            }
          } catch (_) {}

          return this.currentCharacterId;
        }

        hasGameIds() {
          // 使用 getter：保证懒加载/持久化恢复后仍能判断完整性
          return !!(this.getToken() && this.getUserId() && this.getCharacterId());
        }

        clearTokenByCommand() {
          this.clearToken();
        }

        on(event, callback, target) {
          var node = this.node;

          if (node && typeof node.on === 'function') {
            node.on(event, callback, target);
          }
        }

        off(event, callback, target) {
          var node = this.node;

          if (node && typeof node.off === 'function') {
            node.off(event, callback, target);
          }
        }

        connect() {
          if (this.isConnecting) {
            return;
          } // 关键：readyState=CONNECTING 时也必须视为“正在连接”，否则会重复 new WebSocket 导致 1006 抖动


          if (this.socket) {
            if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
              return;
            }
          } // 安全阀门控：离线/未鉴权超过阈值，禁止直接使用本地 token 自动上线


          if (this.isReloginRequiredByIdle()) {
            console.warn("\u26A0\uFE0F [WebSocketManager] \u79BB\u7EBF\u8D85\u8FC7\u9608\u503C\uFF08" + (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).AUTH_INACTIVITY_RELOGIN_MS + "ms\uFF09\uFF0C\u5F3A\u5236\u56DE\u767B\u5F55\u5E76\u6E05\u9664\u672C\u5730\u4F1A\u8BDD");
            this.returnToLogin();
            return;
          }

          this.isConnecting = true; // 开新连接前：清掉上一次的重连定时器与握手超时，避免堆积触发

          if (this._reconnectTimerId !== -1) {
            clearTimeout(this._reconnectTimerId);
            this._reconnectTimerId = -1;
          }

          if (this.handshakeTimeout !== -1) {
            clearTimeout(this.handshakeTimeout);
            this.handshakeTimeout = -1;
          } // 每次连接前重新读取URL（支持运行时覆盖，如 localStorage['WS_URL']）


          this.url = (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).getWsUrl();

          try {
            console.log("WebSocket \u8FDE\u63A5\u5730\u5740: " + this.url);
          } catch (_unused7) {}

          var seq = ++this._connectSeq;
          var ws = new WebSocket(this.url);
          this.socket = ws;

          ws.onopen = () => {
            // 只处理“当前有效 socket”的回调（旧 socket 的回调直接丢弃）
            if (this.socket !== ws || this._connectSeq !== seq) return;

            try {
              console.log("[WS] \u5DF2\u8FDE\u63A5: " + this.url);
            } catch (_unused8) {}

            this.invalidateSessionAuth();
            this.isConnectedFlag = true;
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            this.isReconnecting = false; // 不在此处 flush messageQueue：否则断线重连后业务包会在 handshake/auth 之前发出，易被服务端丢弃（表现为选角「进游戏」首次无响应）
            // 队列在 handshake 完成后（无 token）或 auth_response 成功时刷出，见 onHandshakeCompleteOrTimeout / handleMessage
            // 启动心跳

            this.startHeartbeat(); // 先发送握手请求（参考 Pomelo 设计，向后兼容：如果服务器不支持握手，超时后继续正常流程）

            this.sendHandshake();
          };

          ws.onmessage = event => {
            if (this.socket !== ws || this._connectSeq !== seq) return;
            this.handleMessage(event.data);
          };

          ws.onclose = ev => {
            if (this.socket !== ws || this._connectSeq !== seq) return;

            try {
              console.warn("[WS] \u8FDE\u63A5\u5173\u95ED code=" + (ev == null ? void 0 : ev.code) + " reason=" + ((ev == null ? void 0 : ev.reason) || ''));
            } catch (_unused9) {}

            this.stopHeartbeat(); // 停止心跳

            this.invalidateSessionAuth();
            this.isConnectedFlag = false;
            this.isConnecting = false; // 断开时清掉握手超时定时器，避免“握手超时”在断线后仍刷屏

            if (this.handshakeTimeout !== -1) {
              clearTimeout(this.handshakeTimeout);
              this.handshakeTimeout = -1;
            } // 切换角色（游戏内回选角）：已清 characterId，仍保留 token/userId — 关闭旧连接后需重建 WS


            if (this.isSwitchingCharacterSession) {
              console.log('ℹ️ [WS] 切换角色会话结束（保留账号），将重建连接');
              this.isSwitchingCharacterSession = false;
              var token = this.getToken();
              var userId = this.getUserId();

              if (token && userId) {
                this.reconnectAttempts = 0;
                setTimeout(() => {
                  if (this.isConnectedFlag || this.isConnecting) return;

                  try {
                    console.log('🔄 [WS] 切换角色后重建 WebSocket（返回选角）');
                    this.connect();
                  } catch (e) {
                    console.warn('[WS] 切换角色后重建连接失败', e);
                  }
                }, 120);
              }

              return;
            } // 注意：连接关闭时不清除数据（token、userId、characterId），因为可能是临时断开
            // 只有在重连失败或明确登出时才清除数据


            var node = this.node;

            if (node && typeof node.emit === 'function') {
              node.emit('network_disconnect');
            }

            if (!this.isReconnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              this.isReconnecting = true; // 使用优化后的指数退避策略，根据网络状况调整重连延迟

              var backoffDelay = this.getReconnectDelay();
              console.log("\uD83D\uDD04 [WebSocketManager] \u5C06\u5728 " + backoffDelay + "ms \u540E\u5C1D\u8BD5\u91CD\u8FDE (\u5C1D\u8BD5 " + this.reconnectAttempts + "/" + this.maxReconnectAttempts + ")");

              if (this._reconnectTimerId !== -1) {
                clearTimeout(this._reconnectTimerId);
              }

              this._reconnectTimerId = setTimeout(() => {
                this._reconnectTimerId = -1;
                this.connect();
                this.isReconnecting = false;
              }, backoffDelay);
            } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
              // 只有“确实在游戏态”才把重连失败当作错误并清理数据。
              // 登录页/主动 logout/fullLogout 触发 close 时，reconnectAttempts 可能被预设到上限，
              // 这类情况下不应再打印 error（避免日志噪音，并避免误清 token）。
              if (this.isGameRunning) {
                console.error("\u274C [WebSocketManager] \u91CD\u8FDE\u5931\u8D25\uFF0C\u5DF2\u8FBE\u5230\u6700\u5927\u91CD\u8BD5\u6B21\u6570 (" + this.maxReconnectAttempts + ")");
                this.clearAll();
                this.returnToLogin();
              }
            }
          };

          ws.onerror = e => {
            if (this.socket !== ws || this._connectSeq !== seq) return;

            try {
              console.error('[WS] 错误', (e == null ? void 0 : e.message) || e);
            } catch (_unused10) {}

            this.stopHeartbeat(); // 停止心跳

            this.isConnectedFlag = false;
            this.isConnecting = false;

            if (this.handshakeTimeout !== -1) {
              clearTimeout(this.handshakeTimeout);
              this.handshakeTimeout = -1;
            }

            if (this.isGameRunning) {
              this.handleDisconnection();
            }
          };
        }

        close() {
          this.stopHeartbeat();

          if (this.socket) {
            this.socket.close();
          }
        }
        /**
         * 游戏内切换角色：通知服务端结束当前角色会话、清空本地 characterId，保留 token/userId，并关闭连接后自动重连。
         * 注意：这不是「账号登出」；登录界面的退出请用 {@link fullLogout}。
         * 协议层仍发送 type `logout`（与现有服务端约定一致）。
         */


        switchCharacterAndReturnToSelect() {
          this.isGameRunning = false;
          this.isSwitchingCharacterSession = true;
          this.isReconnecting = false;
          this.reconnectAttempts = this.maxReconnectAttempts;

          if (this.socket && this.isConnectedFlag) {
            this.send({
              type: 'logout'
            }, true, true);
            setTimeout(() => {
              this.close();
            }, 800);
          } else {
            this.close();
          }

          this.clearCharacterId();
        }
        /**
         * @deprecated 语义易与「登录页登出」混淆，请改用 {@link switchCharacterAndReturnToSelect}
         */


        logout() {
          this.switchCharacterAndReturnToSelect();
        }
        /**
         * 完全退出登录（清除所有数据并跳转到登录场景）
         */


        fullLogout() {
          this.isGameRunning = false; // 停止重连

          this.isReconnecting = false;
          this.reconnectAttempts = this.maxReconnectAttempts; // 先发送完全登出消息到服务器（使用full_logout接口）

          if (this.socket && this.isConnectedFlag) {
            // 规范性修复：同理，full_logout 必须立即发送
            this.send({
              type: 'full_logout'
            }, true, true);
            setTimeout(() => {
              this.close();
            }, 800);
          } else {
            this.close();
          } // 完全退出登录时清除所有数据


          this.clearAll();
        }

        setGameRunning(running) {
          this.isGameRunning = running;
        }

        flushMessageQueue() {
          while (this.messageQueue.length > 0) {
            var message = this.messageQueue.shift();

            if (message && this.socket && this.socket.readyState === WebSocket.OPEN) {
              try {
                this.socket.send(JSON.stringify(message));
              } catch (_unused11) {
                this.messageQueue.unshift(message);
                break;
              }
            }
          }
        }

        // 30秒
        startHeartbeat() {
          this.stopHeartbeat();
          this.heartbeatTimer = setInterval(() => {
            if (this.isConnectedFlag && this.socket && this.socket.readyState === WebSocket.OPEN) {
              this.send({
                type: 'pong'
              }, false, true);
            }
          }, this.HEARTBEAT_INTERVAL);
        }

        stopHeartbeat() {
          if (this.heartbeatTimer !== -1) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = -1;
          }
        }

        /**
         * 发送握手请求（参考 Pomelo 设计）
         */
        sendHandshake() {
          this.handshakeCompleted = false; // 获取当前字典版本（如果有）

          var dictVersion = '';
          var routeDict = this.getRouteDict();

          if (routeDict && routeDict.isEnabled()) {
            dictVersion = routeDict.getVersion();
          }

          var handshakeMsg = {
            type: 'handshake',
            sys: {
              type: 'websocket',
              version: '1.0.0',
              // 客户端版本
              dict_version: dictVersion
            }
          }; // 握手无鉴权直发

          this.send(handshakeMsg, false, true); // 设置超时（3秒后如果还没收到握手响应，继续正常流程，向后兼容）

          this.handshakeTimeout = setTimeout(() => {
            if (!this.handshakeCompleted) {
              console.warn('⚠️ [WebSocketManager] 握手超时，继续正常流程（向后兼容）');
              this.onHandshakeCompleteOrTimeout();
            }
          }, 3000);
        }
        /**
         * 握手完成或超时后的处理（发送认证请求并触发连接事件）
         */


        onHandshakeCompleteOrTimeout() {
          if (this.handshakeTimeout !== -1) {
            clearTimeout(this.handshakeTimeout);
            this.handshakeTimeout = -1;
          }

          var token = this.getToken();

          if (token) {
            // 关键修复：如果已有 character_id，在 auth_request 中包含它，让服务器端自动选择角色
            // 测试模式：同时包含 user_id 作为备用验证
            var characterId = this.getCharacterId();
            var userId = this.getUserId();
            var authMsg = {
              type: (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                error: Error()
              }), GameConfig) : GameConfig).MESSAGE_TYPES.AUTH_REQUEST,
              token: token
            };

            if (characterId) {
              authMsg.character_id = characterId;
            }

            if (userId) {
              authMsg.user_id = userId; // 测试模式：提供user_id作为备用验证
            }

            this.send(authMsg, false, true);
          } else {
            this.send({
              type: (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                error: Error()
              }), GameConfig) : GameConfig).MESSAGE_TYPES.CONNECTION_INIT,
              data: 'Client connected'
            }, false, true);
          } // 触发网络连接事件（MMO最佳实践：通知其他组件连接已建立）


          var node = this.node;

          if (node && typeof node.emit === 'function') {
            node.emit('network_connect');
          } // 无 token 时不会有 auth_response，此处刷出离线队列；有 token 时在 auth_response 成功后再 flush


          if (!this.getToken()) {
            this.flushMessageQueue();
          }
        }

        handleMessage(message) {
          try {
            var data = JSON.parse(message); // 服务器可能会批量推送数组消息：逐条拆包处理，避免被当成“无type”导致请求超时。

            if (Array.isArray(data)) {
              if (data.length === 0) {
                return;
              }

              for (var item of data) {
                if (!item || typeof item !== 'object') {
                  continue;
                } // 复用现有单条消息处理逻辑，保持握手/路由解码/事件触发行为一致。


                this.handleMessage(JSON.stringify(item));
              }

              return;
            } // 处理心跳


            if (data && data.type === 'ping') {
              this.send({
                type: 'pong'
              }, false, true);
              return;
            } // 处理握手响应（参考 Pomelo 设计）


            if (data && data.type === 'handshake_ack') {
              console.log('✅ [WebSocketManager] 握手成功');
              this.handshakeCompleted = true; // 清除握手超时定时器

              if (this.handshakeTimeout !== -1) {
                clearTimeout(this.handshakeTimeout);
                this.handshakeTimeout = -1;
              } // 如果服务器返回字典，加载它


              if (data.sys && data.sys.dict) {
                this.getRouteDict().loadDictionary({
                  version: data.sys.dict_version || '',
                  route_to_id: data.sys.dict,
                  id_to_route: data.sys.code_to_route || {}
                });
                this.useRouteDict = data.sys.use_dict === true;
                console.log("\u2705 [WebSocketManager] \u5B57\u5178\u5DF2\u52A0\u8F7D\uFF0C\u542F\u7528\u538B\u7F29: " + this.useRouteDict);
              } // 更新心跳配置（如果服务器返回）


              if (data.sys && data.sys.heartbeat) {
                // 可以更新心跳间隔（当前是固定30秒）
                console.log("\uD83D\uDCE1 [WebSocketManager] \u5FC3\u8DF3\u95F4\u9694: " + data.sys.heartbeat + "\u79D2");
              } // 握手成功后，继续正常流程（发送认证请求等）


              this.onHandshakeCompleteOrTimeout();
              return;
            } // 如果收到数字路由，先解码（支持路由压缩）


            if (data.route_id && !data.type && this.routeDict) {
              var route = this.getRouteDict().decodeRoute(data.route_id);

              if (route) {
                // 假设是响应消息，添加 _response 后缀
                data.type = route + '_response';
              } else {
                console.warn("\u26A0\uFE0F [WebSocketManager] \u65E0\u6CD5\u89E3\u7801 route_id: " + data.route_id);
              }
            } // 检查消息版本（可选，用于兼容性检查）


            if (data.version && data.version !== this.MESSAGE_PROTOCOL_VERSION) {
              console.warn("\u26A0\uFE0F [WebSocketManager] \u6D88\u606F\u7248\u672C\u4E0D\u5339\u914D: \u671F\u671B " + this.MESSAGE_PROTOCOL_VERSION + "\uFF0C\u6536\u5230 " + data.version);
            }

            if (data && data.type) {
              if (data.type === 'auth_response') {
                this.applyAuthResponseToSession(data);

                if (data.success) {
                  this.flushMessageQueue();
                }
              }

              if (data.type === 'login_response' || data.type === 'register_response') {
                var payload = data.data || data;

                var _ok = (payload == null ? void 0 : payload.success) === true || (payload == null ? void 0 : payload.success) === 1 || (payload == null ? void 0 : payload.success) === 'true';

                if (_ok) {
                  // 登录成功也更新“最近一次成功鉴权时间戳”，用于安全阀 TTL。
                  this.markAuthVerifiedNow();
                }
              }

              if (data.type === 'all_characters_response') {
                var resp = data.data || data;

                if (resp != null && resp.success && resp.characters && typeof resp.characters === 'object') {
                  this.lastAllCharactersFingerprint = WebSocketManager.fingerprintAllCharactersPayload(resp.characters);
                }
              } // 添加调试日志，方便排查消息接收问题


              try {
                console.log("\uD83D\uDCE5 [WebSocketManager] \u6536\u5230\u6D88\u606F: type=" + data.type, data);
              } catch (_unused12) {}

              var node = this.node;

              if (node && typeof node.emit === 'function') {
                node.emit(data.type, data);

                try {
                  console.log("\u2705 [WebSocketManager] \u5DF2\u89E6\u53D1\u4E8B\u4EF6: " + data.type);
                } catch (_unused13) {}
              } else {
                console.warn("\u26A0\uFE0F [WebSocketManager] \u65E0\u6CD5\u89E6\u53D1\u4E8B\u4EF6 " + data.type + "\uFF0Cnode\u65E0\u6548");
              }
            } else {
              console.warn('⚠️ [WebSocketManager] 收到无type的消息:', data);
            }
          } catch (error) {
            console.error('❌ [WebSocketManager] 处理消息失败:', error, message);
          }
        }
        /**
         * 根据网络状况调整重连延迟（优化重连机制）
         * 使用指数退避策略，但限制最大延迟
         */


        getReconnectDelay() {
          // 指数退避，但限制最大延迟为 30 秒
          var delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000 // 最大 30 秒
          );
          return Math.max(delay, 1000); // 最小 1 秒
        }

        handleDisconnection() {
          var node = this.node;

          if (node && typeof node.emit === 'function') {
            node.emit('network_disconnect');
          }
        }

        returnToLogin() {
          var _director$getScene;

          this.clearAll();
          this.isGameRunning = false;
          var currentSceneName = (_director$getScene = director.getScene()) == null ? void 0 : _director$getScene.name;

          if (currentSceneName !== (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).SCENE_NAMES.LOGIN) {
            director.loadScene((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).SCENE_NAMES.LOGIN);
          }
        }

        start() {
          if (this === WebSocketManager.instance) {
            this.connect();
          }
        }

        onDestroy() {
          this.stopHeartbeat();
          this.close();
        }

      }, _class2.instance = null, _class2.instanceNode = null, _class2.LS_LAST_TOKEN = 'last_token', _class2.LS_LAST_TOKEN_EXPIRES_AT = 'last_token_expires_at', _class2.LS_LAST_REFRESH_TOKEN = 'last_refresh_token', _class2.LS_LAST_REFRESH_TOKEN_EXPIRES_AT = 'last_refresh_token_expires_at', _class2.LS_LAST_USER_ID = 'last_user_id', _class2.LS_LAST_CHARACTER_ID = 'last_character_id', _class2.LS_LAST_AUTH_VERIFIED_AT = 'last_auth_verified_at', _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=e09b7bfbdbb72f5c7442f04e0ba1df6717835e84.js.map