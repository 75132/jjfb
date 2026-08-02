System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, director, GameConfig, WebSocketManager, MiniGame1, _dec, _dec2, _dec3, _dec4, _dec5, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _class3, _crd, ccclass, property, LEVEL_TOTAL_EXP, GameCommonData;

  function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "../global/GameConfig", _context.meta, extras);
  }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfMiniGame(extras) {
    _reporterNs.report("MiniGame1", "./MiniGame1", _context.meta, extras);
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
      director = _cc.director;
    }, function (_unresolved_2) {
      GameConfig = _unresolved_2.GameConfig;
    }, function (_unresolved_3) {
      WebSocketManager = _unresolved_3.WebSocketManager;
    }, function (_unresolved_4) {
      MiniGame1 = _unresolved_4.MiniGame1;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "a9482VRSrlMMYKWG6K3OGgq", "GameCommonData", undefined);

      __checkObsolete__(['_decorator', 'Component', 'director']);

      ({
        ccclass,
        property
      } = _decorator);
      /**
       * GameCommonData - 本场景通用数据中心（客户端只做"展示缓存"）
       *
       * 当前职责（仅针对"角色人物"）：
       * - **作为数据中心**：监听服务器消息，统一管理角色等级 / 经验值
       * - 内置 1~60 级经验表（60 级封顶），只用于 UI 展示进度（例如：距离下一级还差多少经验）
       * - 不在本地做任何"加经验 / 升级"逻辑，战斗结算等必须由服务器计算
       * - 数据更新时触发事件，供其他组件（如 TopRole）订阅并更新 UI
       *
       * 说明：
       * - 经验表使用"累计总经验"模式：到达某一级时，角色的总经验值应 >= 该级配置值。
       *   例如：到 5 级需要总经验 770，到 6 级需要总经验 983。
       * - 如果你更习惯"每级所需经验"，可以在下方 `LEVEL_TOTAL_EXP` 的基础上自行换算。
       *
       * 使用方式：
       * - 在场景中新建一个空节点，将本脚本挂载上去即可。
       * - 通过 `GameCommonData.instance` 在任意脚本中访问当前角色的等级与经验（只读）。
       * - 其他组件可以监听 `data_updated` 事件来响应数据变化。
       * 
       * 数据刷新接口：
       * - `refreshPlayerInfo()`: 刷新玩家信息（支持 Promise 和回调）
       * - `refreshData(type)`: 刷新指定类型的数据
       * - `forceRefresh()`: 强制刷新所有数据
       * 
       * 示例：
       * ```typescript
       * // 方式1：使用 Promise
       * GameCommonData.instance?.refreshPlayerInfo().then(data => {
       *     console.log('数据已刷新:', data);
       * });
       * 
       * // 方式2：使用回调
       * GameCommonData.instance?.refreshPlayerInfo((data) => {
       *     console.log('数据已刷新:', data);
       * });
       * 
       * // 方式3：监听事件（推荐，自动响应所有数据更新）
       * GameCommonData.instance?.node.on('data_updated', (data) => {
       *     console.log('数据已更新:', data);
       * });
       * ```
       */
      // 1~60 级累计总经验表（索引从 0 开始，对应等级 = index + 1）

      LEVEL_TOTAL_EXP = [290, // 1
      370, // 2
      472, // 3
      603, // 4
      770, // 5
      983, // 6
      1256, // 7
      1604, // 8
      2048, // 9
      2614, // 10
      3338, // 11
      4262, // 12
      5442, // 13
      6948, // 14
      8872, // 15
      11328, // 16
      14463, // 17
      18466, // 18
      23577, // 19
      30103, // 20
      38436, // 21
      49074, // 22
      62657, // 23
      80000, // 24
      89608, // 25
      100371, // 26
      112427, // 27
      125931, // 28
      141057, // 29
      158000, // 30
      182364, // 31
      210485, // 32
      242942, // 33
      280404, // 34
      323644, // 35
      373550, // 36
      431153, // 37
      497638, // 38
      574375, // 39
      662945, // 40
      765174, // 41
      883165, // 42
      1019352, // 43
      1176539, // 44
      1357965, // 45
      1567367, // 46
      1809059, // 47
      2088021, // 48
      2410000, // 49
      2580000, // 50
      4696700, // 51
      8550000, // 52
      12220000, // 53
      15890000, // 54
      19560000, // 55
      19877424, // 56
      20200000, // 57
      20448471, // 58
      20700000, // 59
      20950000 // 60
      ];

      _export("GameCommonData", GameCommonData = (_dec = ccclass('GameCommonData'), _dec2 = property({
        tooltip: '角色当前等级（1~60）'
      }), _dec3 = property({
        tooltip: '角色当前累计总经验（由服务器数据同步）'
      }), _dec4 = property({
        tooltip: '角色名称（由服务器数据同步）'
      }), _dec5 = property({
        tooltip: '角色最高等级（默认 60 级）'
      }), _dec(_class = (_class2 = (_class3 = class GameCommonData extends Component {
        constructor() {
          super(...arguments);

          /** 角色当前等级（1~60） */
          _initializerDefineProperty(this, "_level", _descriptor, this);

          /** 角色当前累计总经验（不做负数校验，调用时注意） */
          _initializerDefineProperty(this, "_totalExp", _descriptor2, this);

          /** 角色名称 */
          _initializerDefineProperty(this, "_roleName", _descriptor3, this);

          /** 最高等级（默认 60 级封顶） */
          _initializerDefineProperty(this, "maxLevel", _descriptor4, this);

          this.wsManager = null;

          /**
           * 认证响应回调（关键修复：认证成功后再请求数据）
           */
          this.onAuthResponse = data => {
            if (data && data.success) {
              console.log('✅ [GameCommonData] 认证成功，准备请求玩家信息'); // 认证成功后，延迟一小段时间确保服务器端current_user_id已设置

              this.scheduleOnce(() => {
                if (this.validateDataIntegrity()) {
                  this.requestPlayerInfo();
                }
              }, 0.1);
            } else {
              console.warn('⚠️ [GameCommonData] 认证失败，无法请求玩家信息');
            }
          };

          /**
           * 网络连接成功回调（如果已经认证，立即请求；否则等待认证）
           */
          this.onNetworkConnect = () => {
            console.log('📡 [GameCommonData] 网络连接成功'); // 如果已经连接且有完整凭证，检查是否已认证
            // 注意：auth_request是自动发送的，我们等待auth_response后再请求数据
            // 这里只做备用检查
          };

          /**
           * 处理服务器返回的玩家信息
           * 关键修复：只处理 is_self=true 的响应，避免被好友信息污染
           */
          this.onPlayerInfo = data => {
            console.log('📥 [GameCommonData] 收到player_info响应（原始数据）:', data); // ✅ 关键修复：支持标准响应格式（数据在 data.data 中）

            var responseData = data;

            if (data && data.success && data.data && typeof data.data === 'object') {
              // 标准格式：合并根级别字段和 data 字段
              responseData = _extends({}, data, data.data);
              console.log('📥 [GameCommonData] 检测到标准响应格式，合并数据字段');
            }

            if (!responseData || !responseData.success) {
              var _responseData;

              console.warn('⚠️ [GameCommonData] 收到无效的玩家信息响应:', responseData);
              var code = Number(((_responseData = responseData) == null ? void 0 : _responseData.code) || 0); // 角色被删/会话失效时，直接强制退出到登录，避免停留在空壳 Game 场景。

              if (code === 401 || code === 404) {
                console.error("\uD83D\uDEA8 [GameCommonData] get_player \u5931\u8D25(code=" + code + ")\uFF0C\u5F3A\u5236\u56DE\u767B\u5F55");

                try {
                  this.wsManager.clearAll();
                } catch (_unused) {}

                this.node.emit('data_integrity_failed', {
                  reason: 'player_not_found_or_unauthorized',
                  code
                });
                this.scheduleOnce(() => {
                  director.loadScene((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                    error: Error()
                  }), GameConfig) : GameConfig).SCENE_NAMES.LOGIN);
                }, 0.05);
              }

              return;
            } // 关键修复：只处理查看自己的响应（is_self=true），忽略查看好友的响应
            // 这样可以避免 GameCommonData 被好友信息污染


            if (responseData.is_self !== true) {
              console.log('📥 [GameCommonData] 忽略非自己的 player_info 响应（is_self=false），避免数据污染:', {
                is_self: responseData.is_self,
                role_name: responseData.role_name,
                request_id: responseData.request_id
              });
              return; // 忽略查看好友的响应
            } // 如果有 request_id，检查是否是自己请求的（可选，额外验证）
            // GameCommonData 的请求通常不包含 request_id，所以这里只做日志记录


            if (responseData.request_id !== undefined) {
              console.log('📥 [GameCommonData] 收到带 request_id 的响应:', responseData.request_id);
            }

            var level = Number(responseData.level || 1);
            var totalExp = Number(responseData.total_exp !== undefined ? responseData.total_exp : responseData.exp || 0);
            var roleName = String(responseData.role_name || ''); // 更新数据

            var oldLevel = this._level;
            this._level = this.clampLevel(level);
            this._totalExp = Math.max(0, totalExp);
            this._roleName = roleName;
            console.log("\u2705 [GameCommonData] \u73A9\u5BB6\u4FE1\u606F\u5DF2\u66F4\u65B0\uFF08\u786E\u8BA4\u662F\u81EA\u5DF1\u7684\u6570\u636E\uFF09 - \u7B49\u7EA7: " + this._level + ", \u7ECF\u9A8C: " + this._totalExp + ", \u540D\u79F0: " + this._roleName); // 触发数据更新事件，通知其他组件（如 TopRole）

            var updateData = {
              level: this._level,
              totalExp: this._totalExp,
              roleName: this._roleName,
              levelChanged: oldLevel !== this._level
            };
            this.node.emit('data_updated', updateData);
          };

          /**
           * 处理服务器返回的增加经验响应
           */
          this.onAddExpResponse = data => {
            if (!data || !data.success) {
              console.warn('⚠️ [GameCommonData] 收到无效的增加经验响应');
              return;
            }

            var oldLevel = this._level;
            var level = Number(data.level || this._level);
            var totalExp = Number(data.total_exp || this._totalExp);
            var levelUpCount = data.level_up_count || 0; // 更新数据

            this._level = this.clampLevel(level);
            this._totalExp = Math.max(0, totalExp);
            console.log("\u2705 [GameCommonData] \u7ECF\u9A8C\u5DF2\u66F4\u65B0 - \u7B49\u7EA7: " + this._level + " (" + (levelUpCount > 0 ? "\u5347\u7EA7\u4E86 " + levelUpCount + " \u7EA7" : '未升级') + "), \u7ECF\u9A8C: " + this._totalExp); // 触发数据更新事件

            this.node.emit('data_updated', {
              level: this._level,
              totalExp: this._totalExp,
              roleName: this._roleName,
              levelUpCount: levelUpCount,
              levelChanged: oldLevel !== this._level
            });
          };

          /**
           * 处理角色选择响应（切换角色时重新拉取数据）
           */
          this.onCharacterSelected = data => {
            if (data && data.success) {
              // 切换角色后重新请求玩家信息
              this.requestPlayerInfo();
            }
          };

          /**
           * 处理角色切换事件（清除内部状态）
           */
          this.onCharacterChanged = data => {
            if (data && data.reason === 'character_id_cleared') {
              console.log('🗑️ [GameCommonData] 检测到角色切换，清除内部状态'); // 清除所有内部状态

              this._level = 1;
              this._totalExp = 0;
              this._roleName = ''; // 触发数据更新事件，通知其他组件

              this.node.emit('data_updated', {
                level: this._level,
                totalExp: this._totalExp,
                roleName: this._roleName
              });
            }
          };
        }

        onLoad() {
          // 简单单例：同场景只保留一个
          if (GameCommonData.instance && GameCommonData.instance !== this) {
            console.warn('[GameCommonData] 场景内已存在实例，自动销毁多余的一个。');
            this.destroy();
            return;
          }

          GameCommonData.instance = this; // 初始化 WebSocket 监听

          this.wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance(); // ✅ 修复：服务器使用 send_success_response 发送的是 'player_info_response' 事件

          this.wsManager.on('player_info', this.onPlayerInfo, this); // 兼容旧格式

          this.wsManager.on('player_info_response', this.onPlayerInfo, this); // 新格式

          this.wsManager.on('add_exp_response', this.onAddExpResponse, this);
          this.wsManager.on('select_character_response', this.onCharacterSelected, this); // 监听认证响应，认证成功后再请求数据（关键修复）

          this.wsManager.on('auth_response', this.onAuthResponse, this); // 关键修复：监听角色切换事件，清除内部状态

          this.wsManager.on('data_changed', this.onCharacterChanged, this); // 监听网络连接事件，连接成功后再请求数据

          var wsNode = this.wsManager.node;

          if (wsNode && typeof wsNode.on === 'function') {
            wsNode.on('network_connect', this.onNetworkConnect, this);
          }
        }

        start() {
          (_crd && MiniGame1 === void 0 ? (_reportPossibleCrUseOfMiniGame({
            error: Error()
          }), MiniGame1) : MiniGame1).mountFromSceneRoot(this.node); // 延迟请求玩家信息，避免阻塞场景加载
          // 如果WebSocket已连接，立即尝试请求；否则等待network_connect事件

          this.scheduleOnce(() => {
            // 如果已经连接且有完整凭证，立即请求
            if (this.wsManager.isConnected() && this.validateDataIntegrity()) {
              console.log('✅ [GameCommonData] WebSocket已连接且数据完整，立即请求玩家信息');
              this.requestPlayerInfo();
            } else {
              console.log('⏳ [GameCommonData] 等待WebSocket连接和凭证准备完成...'); // 如果还没准备好，等待network_connect事件触发请求（已在onNetworkConnect中处理）
            }
          }, 0.3); // 延迟300ms，确保AutoLoginUser已经应用凭证
        }

        onDestroy() {
          // 取消 WebSocket 监听
          if (this.wsManager) {
            this.wsManager.off('player_info', this.onPlayerInfo, this);
            this.wsManager.off('player_info_response', this.onPlayerInfo, this); // 新格式

            this.wsManager.off('add_exp_response', this.onAddExpResponse, this);
            this.wsManager.off('select_character_response', this.onCharacterSelected, this);
            this.wsManager.off('auth_response', this.onAuthResponse, this); // 关键修复：取消角色切换事件监听

            this.wsManager.off('data_changed', this.onCharacterChanged, this);
          }

          var wsNode = this.wsManager.node;

          if (wsNode && typeof wsNode.off === 'function') {
            wsNode.off('network_connect', this.onNetworkConnect, this);
          }

          if (GameCommonData.instance === this) {
            GameCommonData.instance = null;
          }
        }

        // —— 数据完整性验证（安全核心）—— //

        /**
         * 验证数据完整性（发送任何请求前必须调用）
         * @returns 如果数据完整返回true，否则返回false并触发Loading
         */
        validateDataIntegrity() {
          var wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance(); // 检查WebSocket连接

          if (!wsManager.isConnected()) {
            console.error('❌ [GameCommonData] WebSocket未连接');
            this.triggerLoadingOnDataMissing('WebSocket未连接');
            return false;
          } // 检查Token


          var token = wsManager.getToken();

          if (!token || token.length === 0) {
            console.error('❌ [GameCommonData] Token不存在');
            this.triggerLoadingOnDataMissing('Token不存在');
            return false;
          } // 检查用户ID


          var userId = wsManager.getUserId();

          if (!userId || userId.length === 0) {
            console.error('❌ [GameCommonData] 用户ID不存在');
            this.triggerLoadingOnDataMissing('用户ID不存在');
            return false;
          } // 检查角色ID


          var characterId = wsManager.getCharacterId();

          if (!characterId || characterId.length === 0) {
            console.error('❌ [GameCommonData] 角色ID不存在');
            this.triggerLoadingOnDataMissing('角色ID不存在');
            return false;
          }

          return true;
        }
        /**
         * 触发Loading面板（当检测到数据缺失时）
         */


        triggerLoadingOnDataMissing(reason) {
          var _this$node$scene;

          console.error("\uD83D\uDEA8 [GameCommonData] \u6570\u636E\u7F3A\u5931\uFF1A" + reason + "\uFF0C\u89E6\u53D1Loading\u9762\u677F"); // 通过事件通知GameControl显示Loading

          this.node.emit('data_integrity_failed', {
            reason
          }); // 尝试直接调用GameControl（如果存在）

          var gameControl = (_this$node$scene = this.node.scene) == null || (_this$node$scene = _this$node$scene.getChildByName('Game')) == null ? void 0 : _this$node$scene.getComponent('GameControl');

          if (gameControl && typeof gameControl.handleDataIntegrityFailed === 'function') {
            gameControl.handleDataIntegrityFailed(reason);
          }
        } // —— 对外只读属性 —— //

        /** 当前等级（外部读写建议通过专门方法） */


        get level() {
          return this._level;
        }
        /** 当前总经验值 */


        get totalExp() {
          return this._totalExp;
        }
        /** 角色名称 */


        get roleName() {
          return this._roleName;
        }
        /** 当前是否已经达到最高等级 */


        get isMaxLevel() {
          return this._level >= this.maxLevel;
        }
        /** 升到下一等级所需的“额外经验”（如果已满级则为 0） */


        get needExpForNextLevel() {
          if (this.isMaxLevel) {
            return 0;
          }

          var nextLevelTotal = this.getTotalExpForLevel(this._level + 1);
          return Math.max(0, nextLevelTotal - this._totalExp);
        } // —— 数据刷新系统（对外公开接口）—— //

        /**
         * 刷新玩家信息（公开接口，供其他模块调用）
         * @param callback 可选的回调函数，数据刷新完成后调用
         * @returns Promise，数据刷新完成后 resolve
         */


        refreshPlayerInfo(callback) {
          return new Promise((resolve, reject) => {
            // 设置一次性监听器
            var onDataUpdated = data => {
              if (this.node && this.node.isValid) {
                this.node.off('data_updated', onDataUpdated);
              }

              if (callback) callback(data);
              resolve(data);
            };

            this.node.once('data_updated', onDataUpdated); // 发送请求

            this.requestPlayerInfo(); // 设置超时（5秒）

            setTimeout(() => {
              if (this.node && this.node.isValid) {
                this.node.off('data_updated', onDataUpdated);
              }

              reject(new Error('刷新玩家信息超时'));
            }, 5000);
          });
        }
        /**
         * 刷新指定类型的数据（统一入口）
         * @param dataType 数据类型：'player' | 'exp' | 'all'
         * @param callback 可选的回调函数
         */


        refreshData(dataType, callback) {
          if (dataType === void 0) {
            dataType = 'all';
          }

          switch (dataType) {
            case 'player':
            case 'all':
              this.refreshPlayerInfo(callback).catch(err => {
                console.error('❌ 刷新玩家信息失败:', err);
              });
              break;

            case 'exp':
              // 如果只需要经验，也刷新完整玩家信息（因为服务器返回的是完整数据）
              this.refreshPlayerInfo(callback).catch(err => {
                console.error('❌ 刷新经验信息失败:', err);
              });
              break;

            default:
              console.warn("\u26A0\uFE0F \u672A\u77E5\u7684\u6570\u636E\u7C7B\u578B: " + dataType);
          }
        }
        /**
         * 强制刷新所有数据（供其他模块在需要时调用）
         */


        forceRefresh() {
          console.log('🔄 [GameCommonData] 强制刷新所有数据');
          this.refreshData('all');
        } // —— 网络消息处理（数据中心核心逻辑）—— //

        /**
         * 请求玩家信息（主动拉取，内部方法）
         * 优化：使用request方法，自动生成request_id并匹配响应
         */


        requestPlayerInfo() {
          var _this$wsManager$getCh, _this$wsManager;

          // 验证数据完整性
          if (!this.validateDataIntegrity()) {
            console.error('❌ [GameCommonData] 数据不完整，无法请求玩家信息');
            return;
          }

          var cid = ((_this$wsManager$getCh = (_this$wsManager = this.wsManager).getCharacterId) == null ? void 0 : _this$wsManager$getCh.call(_this$wsManager)) || undefined;

          if (!cid) {
            console.warn('⚠️ [GameCommonData] 未选择角色，无法请求玩家信息');
            this.triggerLoadingOnDataMissing('角色ID不存在');
            return;
          } // 构建请求数据


          var requestData = {
            character_id: cid
          }; // 测试模式：包含 user_id 作为备用验证

          var userId = this.wsManager.getUserId();

          if (userId) {
            requestData.user_id = userId; // 测试模式：提供user_id作为备用验证
          }

          console.log('📤 [GameCommonData] 发送请求玩家信息:', requestData); // 使用request方法，自动生成request_id并匹配响应

          this.wsManager.request('get_player', requestData, response => {
            // 通过request_id匹配的响应回调（组件销毁后直接忽略，避免跨场景回调噪音）
            if (!this || !this.isValid) {
              return;
            }

            if (typeof this.onPlayerInfo === 'function') {
              this.onPlayerInfo(response);
            } else {
              console.error('❌ [GameCommonData] onPlayerInfo 回调不存在，忽略本次响应');
            }
          }, true, // 需要认证
          10000 // 10秒超时
          );
          console.log('📤 [GameCommonData] 请求已发送（使用request方法）');
        }

        // —— 同步接口（仅供内部使用，外部组件应通过事件监听）—— //

        /**
         * 从服务器同步完整信息（内部使用，外部不应直接调用）
         * @param level  服务器计算后的等级
         * @param totalExp 服务器计算后的累计经验
         * @param maxLevel （可选）如果服务器也下发最大等级，可以一并带上
         */
        syncFromServer(level, totalExp, maxLevel) {
          if (typeof maxLevel === 'number' && maxLevel > 0) {
            this.maxLevel = maxLevel;
          }

          this._level = this.clampLevel(level);
          this._totalExp = Math.max(0, totalExp);
        }
        /**
         * 仅更新等级（例如服务器只返回新等级，不返回经验时）
         */


        setLevelFromServer(level) {
          this._level = this.clampLevel(level);
        }
        /**
         * 仅更新经验（例如某些接口只返回当前经验）
         */


        setTotalExpFromServer(totalExp) {
          this._totalExp = Math.max(0, totalExp);
        } // —— 内部工具函数 —— //

        /** 获取指定等级的累计总经验（level 从 1 开始） */


        getTotalExpForLevel(level) {
          var clampedLevel = this.clampLevel(level);
          var index = clampedLevel - 1;

          if (index < 0) {
            return 0;
          }

          if (index >= LEVEL_TOTAL_EXP.length) {
            // 超出表格范围时，使用最后一级的经验值
            return LEVEL_TOTAL_EXP[LEVEL_TOTAL_EXP.length - 1];
          }

          return LEVEL_TOTAL_EXP[index];
        }
        /** 将等级限制在 [1, maxLevel] 之间 */


        clampLevel(level) {
          var maxL = Math.max(1, Math.min(this.maxLevel, level));
          return Math.max(1, Math.min(maxL, level));
        }

      }, _class3.instance = null, _class3), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "_level", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 1;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "_totalExp", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "_roleName", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return '';
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "maxLevel", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 60;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=2704f429abefd6f2a7de7ce5a9e2febc62ee75ea.js.map