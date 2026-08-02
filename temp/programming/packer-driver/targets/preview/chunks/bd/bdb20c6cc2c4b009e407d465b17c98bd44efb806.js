System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Label, Sprite, SpriteFrame, UITransform, Size, Button, WebSocketManager, getEnergyBlocksFromPayload, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _dec14, _dec15, _dec16, _dec17, _dec18, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _descriptor13, _descriptor14, _descriptor15, _descriptor16, _descriptor17, _crd, ccclass, property, ProfileEntryType, CharacterProfile;

  function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfgetEnergyBlocksFromPayload(extras) {
    _reporterNs.report("getEnergyBlocksFromPayload", "../global/MessageTypes", _context.meta, extras);
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
      Label = _cc.Label;
      Sprite = _cc.Sprite;
      SpriteFrame = _cc.SpriteFrame;
      UITransform = _cc.UITransform;
      Size = _cc.Size;
      Button = _cc.Button;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      getEnergyBlocksFromPayload = _unresolved_3.getEnergyBlocksFromPayload;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "4bb9fBoOVtPEp0gAyxPPc+S", "CharacterProfile", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Label', 'Sprite', 'SpriteFrame', 'UITransform', 'Size', 'Button']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("ProfileEntryType", ProfileEntryType = /*#__PURE__*/function (ProfileEntryType) {
        ProfileEntryType["SELF"] = "self";
        ProfileEntryType["FRIEND_LIST"] = "friend";
        ProfileEntryType["CHAT"] = "chat";
        ProfileEntryType["SEARCH"] = "search";
        ProfileEntryType["OTHER"] = "other";
        return ProfileEntryType;
      }({}));

      _export("CharacterProfile", CharacterProfile = (_dec = ccclass('CharacterProfile'), _dec2 = property(Node), _dec3 = property(Node), _dec4 = property(Node), _dec5 = property(Node), _dec6 = property(Node), _dec7 = property(Node), _dec8 = property(Node), _dec9 = property(Label), _dec10 = property(Node), _dec11 = property(Sprite), _dec12 = property([SpriteFrame]), _dec13 = property(Button), _dec14 = property(Label), _dec15 = property(Node), _dec16 = property(Button), _dec17 = property(Button), _dec18 = property(Button), _dec(_class = (_class2 = class CharacterProfile extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "nameNode", _descriptor, this);

          _initializerDefineProperty(this, "levelNode", _descriptor2, this);

          _initializerDefineProperty(this, "idNode", _descriptor3, this);

          _initializerDefineProperty(this, "classNode", _descriptor4, this);

          _initializerDefineProperty(this, "coinsNode", _descriptor5, this);

          _initializerDefineProperty(this, "energyBlocksNode", _descriptor6, this);

          // 能量块（第二货币），可选绑定
          _initializerDefineProperty(this, "robotCountNode", _descriptor7, this);

          // 机甲数量节点
          _initializerDefineProperty(this, "expLabel", _descriptor8, this);

          _initializerDefineProperty(this, "expPoint", _descriptor9, this);

          _initializerDefineProperty(this, "spriteComp", _descriptor10, this);

          _initializerDefineProperty(this, "spriteFrames", _descriptor11, this);

          _initializerDefineProperty(this, "backButton", _descriptor12, this);

          _initializerDefineProperty(this, "onlineStatusLabel", _descriptor13, this);

          // 在线状态Label（可选，如果UI中有则绑定，直接使用Label显示）
          // ====== 操作按钮相关（可选，如果UI中没有则可以为null） ======
          _initializerDefineProperty(this, "actionButtonsNode", _descriptor14, this);

          // 操作按钮容器节点
          _initializerDefineProperty(this, "addFriendButton", _descriptor15, this);

          // 添加好友按钮
          _initializerDefineProperty(this, "deleteFriendButton", _descriptor16, this);

          // 删除好友按钮
          _initializerDefineProperty(this, "sendMessageButton", _descriptor17, this);

          // 发送消息按钮
          this.ws = null;
          this.barMax = 338;
          this.viewMode = 'self';
          // 查看模式：自己或好友
          // ====== 状态管理 ======
          this.currentConfig = null;
          // 当前配置
          this.isRequesting = false;
          // 是否正在请求数据
          this.isFriend = false;
          // 当前查看的角色是否是好友
          this.targetFriendId = '';
          // 目标好友ID（用于添加/删除好友操作）
          this.currentRequestId = 0;
          // 当前请求ID，用于验证响应是否属于自己
          this.isShowMethodCalled = false;

          this.onPlayerInfo = data => {
            var _responseData$friend_, _responseData$role_na, _responseData$level, _responseData$friend_2, _responseData$class, _responseData$gold, _responseData$robotco, _responseData$Sprite, _responseData$current, _responseData$next_le, _responseData$allianc, _responseData$record, _responseData$rank;

            console.log('[CharacterProfile] 收到 player_info 响应（原始数据）:', JSON.stringify(data, null, 2)); // ✅ 关键修复：支持标准响应格式（数据在 data.data 中）和直接发送格式（数据在根级别）
            // 统一提取响应数据

            var responseData = data; // 如果是标准响应格式（使用 send_success_response），数据在 data.data 中

            if (data && data.success && data.data && typeof data.data === 'object') {
              // 标准格式：{type: 'player_info_response', success: true, data: {...}}
              // ✅ 关键修复：data.data 中的字段优先级更高，覆盖根级别的同名字段
              // 但保留根级别的元数据字段（type, success, code, timestamp, request_id）
              responseData = _extends({}, data, data.data);
              console.log('[CharacterProfile] ✅ 检测到标准响应格式，合并数据字段');
              console.log('[CharacterProfile] 原始 data.data:', JSON.stringify(data.data, null, 2));
              console.log('[CharacterProfile] 合并后的 responseData:', JSON.stringify(responseData, null, 2));
            } else {
              console.log('[CharacterProfile] 使用直接发送格式（数据在根级别）');
              console.log('[CharacterProfile] 直接格式数据:', JSON.stringify(data, null, 2));
            } // 关键修复：验证响应是否属于当前请求
            // 策略：优先使用 request_id 匹配，如果没有 request_id 则通过 is_self 和 isRequesting 判断


            if (!responseData || !responseData.success) {
              // 无效响应，继续处理以便显示错误
              console.warn('[CharacterProfile] 收到无效响应或失败响应');
            } else if (responseData.request_id !== undefined && responseData.request_id !== null) {
              // 有 request_id 的响应：必须匹配才处理
              if (responseData.request_id !== this.currentRequestId) {
                console.log('[CharacterProfile] ⏭️ 忽略 request_id 不匹配的响应:', {
                  received: responseData.request_id,
                  expected: this.currentRequestId,
                  role_name: responseData.role_name,
                  is_self: responseData.is_self
                });
                return;
              }

              console.log('[CharacterProfile] ✅ request_id 匹配，处理响应，role_name:', responseData.role_name);
            } else {
              // 没有 request_id 的响应（可能是 GameCommonData 或其他组件请求的）
              // 只有在以下情况才处理：
              // 1. 正在请求中（isRequesting === true）
              // 2. 当前配置是查看自己（SELF）
              // 3. 响应是 is_self=true（确保是自己的数据）
              if (!this.isRequesting) {
                console.log('[CharacterProfile] ⏭️ 忽略没有 request_id 且不在请求状态的响应，isRequesting:', this.isRequesting);
                return;
              }

              if (!this.currentConfig) {
                console.log('[CharacterProfile] ⏭️ 忽略没有 request_id 且配置为空的响应');
                return;
              }

              if (this.currentConfig.entryType !== ProfileEntryType.SELF) {
                console.log('[CharacterProfile] ⏭️ 忽略没有 request_id 且不是查看自己的响应，entryType:', this.currentConfig.entryType);
                return;
              }

              if (responseData.is_self !== true) {
                console.log('[CharacterProfile] ⏭️ 忽略没有 request_id 且 is_self 不为 true 的响应，is_self:', responseData.is_self);
                return;
              }

              console.log('[CharacterProfile] ✅ 处理没有 request_id 但符合条件的响应（查看自己），role_name:', responseData.role_name);
            }

            this.isRequesting = false; // 请求结束

            if (!responseData || !responseData.success) {
              console.warn('[CharacterProfile] 收到无效的 player_info 响应:', responseData); // 显示错误信息在名称栏，提示用户加载失败

              this.setNumericalValue(this.nameNode, '加载失败');
              this.updateButtonsState(false);
              return;
            }

            console.log('[CharacterProfile] 收到有效的 player_info 响应（request_id匹配）:', {
              request_id: responseData.request_id,
              is_self: responseData.is_self,
              is_friend: responseData.is_friend,
              role_name: responseData.role_name,
              level: responseData.level,
              friend_id: responseData.friend_id,
              robotcount: responseData.robotcount
            }); // 根据 is_self 字段更新查看模式

            if (responseData.is_self !== undefined) {
              this.viewMode = responseData.is_self ? 'self' : 'friend';
              console.log('[CharacterProfile] 更新 viewMode:', this.viewMode);
            } // 保存好友关系状态和好友ID（用于后续操作）


            this.isFriend = responseData.is_friend === true;
            this.targetFriendId = (_responseData$friend_ = responseData.friend_id) != null ? _responseData$friend_ : ''; // ✅ 提取所有字段，添加详细日志
            // 注意：字段名必须与服务器返回的完全一致（区分大小写）

            var name = (_responseData$role_na = responseData.role_name) != null ? _responseData$role_na : '';
            var level = Number((_responseData$level = responseData.level) != null ? _responseData$level : 0);
            var fid = (_responseData$friend_2 = responseData.friend_id) != null ? _responseData$friend_2 : '';
            var cls = Number((_responseData$class = responseData.class) != null ? _responseData$class : 0);
            var gold = Number((_responseData$gold = responseData.gold) != null ? _responseData$gold : 0);
            var energyBlocks = (_crd && getEnergyBlocksFromPayload === void 0 ? (_reportPossibleCrUseOfgetEnergyBlocksFromPayload({
              error: Error()
            }), getEnergyBlocksFromPayload) : getEnergyBlocksFromPayload)(responseData);
            var robotCount = Number((_responseData$robotco = responseData.robotcount) != null ? _responseData$robotco : 0);
            var spriteIndex = Number((_responseData$Sprite = responseData.Sprite) != null ? _responseData$Sprite : 0);
            var cur = Number((_responseData$current = responseData.current_level_exp) != null ? _responseData$current : 0);
            var need = Number((_responseData$next_le = responseData.next_level_need_exp) != null ? _responseData$next_le : 0); // ✅ 提取其他字段

            var alliance = (_responseData$allianc = responseData.alliance) != null ? _responseData$allianc : '';
            var record = (_responseData$record = responseData.record) != null ? _responseData$record : '';
            var rank = (_responseData$rank = responseData.rank) != null ? _responseData$rank : '';
            console.log('[CharacterProfile] 🔍 提取的字段值（调试）:', {
              'responseData.role_name': responseData.role_name,
              'responseData.level': responseData.level,
              'responseData.friend_id': responseData.friend_id,
              'responseData.class': responseData.class,
              'responseData.gold': responseData.gold,
              'responseData.robotcount': responseData.robotcount,
              '提取后的值': {
                name: name || '(空)',
                level: level || '(空)',
                fid: fid || '(空)',
                cls: cls || '(空)',
                gold: gold || '(空)',
                robotCount: robotCount || '(空)',
                spriteIndex: spriteIndex || '(空)',
                cur: cur || '(空)',
                need: need || '(空)',
                energy_blocks: energyBlocks || '(空)',
                alliance: alliance || '(空)',
                record: record || '(空)',
                rank: rank || '(空)'
              },
              is_self: responseData.is_self,
              is_friend: this.isFriend
            }); // ✅ 验证关键字段是否存在

            if (!name && !fid && level === 0) {
              console.error('[CharacterProfile] ❌ 警告：关键字段都为空，可能是数据解析失败！');
              console.error('[CharacterProfile] responseData 完整内容:', JSON.stringify(responseData, null, 2));
            } // 关键修复：确保只更新一次，避免重复更新
            // 在更新前再次验证当前配置是否匹配（防止在处理响应时配置已变更）


            if (!this.currentConfig) {
              console.warn('[CharacterProfile] 收到响应但当前配置已清空，忽略响应');
              return;
            }

            console.log('[CharacterProfile] 开始更新显示数据，当前配置:', this.currentConfig, 'viewMode:', this.viewMode); // 更新显示数据
            // ✅ 确保所有字段都有值，空值显示为 '--'

            this.setNumericalValue(this.nameNode, name || '--');
            this.setNumericalValue(this.levelNode, level > 0 ? String(level) : '--');
            this.setNumericalValue(this.idNode, fid || '--');
            this.setNumericalValue(this.classNode, cls > 0 ? this.getClassName(cls) : '--'); // 始终显示所有数据（包括金币）

            this.setNumericalValue(this.coinsNode, gold > 0 ? String(gold) : '--');

            if (this.energyBlocksNode) {
              this.setNumericalValue(this.energyBlocksNode, energyBlocks > 0 ? String(energyBlocks) : '--');
            }

            this.setNumericalValue(this.robotCountNode, robotCount > 0 ? String(robotCount) : '--');
            console.log('[CharacterProfile] ✅ 显示数据更新完成，已设置的值:', {
              name: name || '(空)',
              level: level || '(空)',
              fid: fid || '(空)',
              cls: cls || '(空)',
              gold: gold || '(空)',
              robotCount: robotCount || '(空)'
            }); // 更新经验条
            // cur: 当前等级内的经验
            // need: 升到下一级所需的总经验
            // 百分比应该是 cur / need，而不是 cur / (cur + need)

            var pct = need > 0 ? Math.max(0, Math.min(1, cur / need)) : 0;
            var w = Math.round(this.barMax * pct);

            if (this.expLabel) {
              // 格式化经验值：超过1万显示为"X万"（四舍五入），不超过显示阿拉伯数字
              var formattedCur = this.formatExpValue(cur);
              var formattedNeed = this.formatExpValue(need);
              this.expLabel.string = formattedCur + "/" + formattedNeed;
            }

            if (this.expPoint) {
              var ut = this.expPoint.getComponent(UITransform);
              if (ut) ut.setContentSize(new Size(w, ut.contentSize.height));
            } // 更新立绘


            if (this.spriteComp) {
              var idx = spriteIndex - 1;

              if (idx >= 0 && idx < this.spriteFrames.length && this.spriteFrames[idx]) {
                this.spriteComp.spriteFrame = this.spriteFrames[idx];
              }
            } // 更新在线状态显示：查看自己时不显示，查看他人时显示
            // 使用状态机状态（responseData.status）或兼容旧的 online 字段


            var playerStatus = responseData.status || (responseData.online ? 'online' : 'offline');
            var isOnline = playerStatus !== 'offline';
            this.updateOnlineStatus(isOnline, playerStatus); // 更新按钮状态（根据服务器返回的 is_self 和 is_friend）

            this.updateButtonsState(true);
          };
        }

        // 标记是否是通过 show() 方法打开的（用于区分直接激活）
        onLoad() {
          this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance(); // ✅ 修复：服务器使用 send_success_response 发送的是 'player_info_response' 事件

          this.ws.on('player_info', this.onPlayerInfo, this); // 兼容旧格式

          this.ws.on('player_info_response', this.onPlayerInfo, this); // 新格式
          // 绑定返回按钮

          if (this.backButton && this.backButton.node) {
            this.backButton.node.on(Button.EventType.CLICK, () => {
              this.node.active = false;
            }, this);
          } // 绑定操作按钮


          if (this.addFriendButton && this.addFriendButton.node) {
            this.addFriendButton.node.on(Button.EventType.CLICK, this.onAddFriend, this);
          }

          if (this.deleteFriendButton && this.deleteFriendButton.node) {
            this.deleteFriendButton.node.on(Button.EventType.CLICK, this.onDeleteFriend, this);
          }

          if (this.sendMessageButton && this.sendMessageButton.node) {
            this.sendMessageButton.node.on(Button.EventType.CLICK, this.onSendMessage, this);
          } // 初始化默认配置（查看自己）


          this.currentConfig = {
            entryType: ProfileEntryType.SELF
          };
        }

        onEnable() {
          // 确保显示在最上层
          if (this.node.parent) {
            this.node.setSiblingIndex(this.node.parent.children.length - 1);
            console.log('[CharacterProfile] onEnable: 已置顶显示');
          } // 关键修复：区分是通过 show() 方法打开还是直接激活
          // 如果 isShowMethodCalled 为 true，说明是通过 show() 打开的，不应该重置


          if (this.isShowMethodCalled) {
            console.log('[CharacterProfile] onEnable: 检测到是通过 show() 方法打开的，跳过自动加载（由 show() 方法处理）');
            this.isShowMethodCalled = false; // 清除标记，避免下次误判

            return;
          } // 如果正在请求中，也不应该重置（可能是之前的请求）


          if (this.isRequesting) {
            console.log('[CharacterProfile] onEnable: 正在请求中，跳过自动加载');
            return;
          } // 如果是直接激活（如 GameMenu 直接设置 active=true），强制重置为查看自己


          console.log('[CharacterProfile] onEnable: 检测到直接激活（非 show() 方法），强制重置为查看自己'); // 清除之前的状态

          this.clearState(); // 重置配置为查看自己

          this.currentConfig = {
            entryType: ProfileEntryType.SELF
          }; // 重置显示

          this.resetDisplay();
          this.updateTitle('个人信息');
          this.updateButtonsState(false); // 发起新的请求

          this.requestData();
        }
        /**
         * 统一的显示方法（替代旧的 showFriendInfo/showSelfInfo）
         * @param config 配置对象
         */


        show(config) {
          console.log('[CharacterProfile] 🔄 show 被调用，配置:', config); // 关键修复：清除之前的状态，避免数据污染

          this.clearState();
          console.log('[CharacterProfile] ✅ 状态已清除');
          this.currentConfig = config;
          this.isShowMethodCalled = true; // 标记是通过 show() 方法打开的

          this.isRequesting = false; // 先设为 false，requestData 会设为 true

          this.currentRequestId = 0; // 先清零，requestData 会生成新的

          this.node.active = true; // 重置显示（显示加载中状态）

          this.resetDisplay();
          console.log('[CharacterProfile] ✅ 显示已重置为加载状态'); // 设置标题

          this.updateTitle(config.roleName || '加载中...'); // 根据入口类型更新按钮状态
          // 注意：此时还没拿到详细数据（如 is_self），先根据入口类型做初步判断
          // 等收到服务器数据后会再次更新

          this.updateButtonsState(false); // 发起数据请求（这会设置 isRequesting=true 并生成新的 request_id）

          this.requestData();
        }
        /**
         * 清除状态（切换查看对象时调用，避免数据污染）
         */


        clearState() {
          console.log('[CharacterProfile] 🧹 清除状态，之前的状态:', {
            viewMode: this.viewMode,
            isFriend: this.isFriend,
            targetFriendId: this.targetFriendId,
            isRequesting: this.isRequesting,
            currentRequestId: this.currentRequestId,
            isShowMethodCalled: this.isShowMethodCalled,
            currentConfig: this.currentConfig ? JSON.stringify(this.currentConfig) : null
          });
          this.viewMode = 'self';
          this.isFriend = false;
          this.targetFriendId = '';
          this.isRequesting = false;
          this.currentRequestId = 0; // 清除请求ID

          this.isShowMethodCalled = false; // 清除标记
          // 注意：不在这里清除 currentConfig，因为 show() 会设置新配置，onEnable() 也会设置

          console.log('[CharacterProfile] 🧹 状态已清除完成');
        }
        /**
         * 兼容旧代码：显示好友信息
         * @deprecated 请使用 show()
         */


        showFriendInfo(characterId, friendId) {
          this.show({
            entryType: ProfileEntryType.FRIEND_LIST,
            // 默认假设来自好友列表，或者是搜索结果
            characterId,
            friendId
          });
        }
        /**
         * 兼容旧代码：显示自己的信息
         * @deprecated 请使用 show()
         */


        showSelfInfo() {
          this.show({
            entryType: ProfileEntryType.SELF
          });
        }

        requestData() {
          if (!this.currentConfig) {
            console.error('[CharacterProfile] requestData: currentConfig 为空，无法发送请求');
            return;
          } // 标记正在请求中，防止重复请求


          this.isRequesting = true; // 生成唯一的请求ID（使用时间戳+随机数确保唯一性）

          this.currentRequestId = Date.now() + Math.random();
          console.log('[CharacterProfile] 🔄 开始新的数据请求，request_id:', this.currentRequestId, 'config:', this.currentConfig); // 构建请求数据
          // 注意：根据 server/router.py，路由名称是 'get_player'
          // server/handlers/player_handler.py 会处理这个请求并返回 type: 'player_info' 的响应

          var req = {
            type: 'get_player',
            request_id: this.currentRequestId // 添加请求ID用于验证响应

          };
          console.log('[CharacterProfile] 发送请求，request_id:', this.currentRequestId, 'config:', this.currentConfig);

          if (this.currentConfig.entryType === ProfileEntryType.SELF) {
            // 查看自己：使用当前登录角色的 character_id
            // 不传任何ID参数，让服务器使用当前登录角色的ID
            var currentCharacterId = this.ws.getCharacterId();

            if (currentCharacterId) {
              req.character_id = currentCharacterId;
              console.log('[CharacterProfile] 请求查看自己的信息 (character_id):', currentCharacterId);
            } else {
              console.error('[CharacterProfile] 无法查看自己：缺少当前角色ID');
              this.setNumericalValue(this.nameNode, '未登录');
              this.isRequesting = false;
              return;
            }
          } else if (this.currentConfig.entryType === ProfileEntryType.FRIEND_LIST) {
            // 查看好友：优先使用 friend_id 查询数据库（性能优化）
            if (this.currentConfig.friendId) {
              req.friend_id = this.currentConfig.friendId;
              console.log('[CharacterProfile] 请求查看好友信息 (friend_id):', this.currentConfig.friendId);
            } else if (this.currentConfig.characterId) {
              // 如果没有 friend_id，回退到使用 character_id
              req.character_id = this.currentConfig.characterId;
              console.log('[CharacterProfile] 请求查看好友信息 (character_id，回退方案):', this.currentConfig.characterId);
            } else {
              console.error('[CharacterProfile] 好友模式但没有 friendId 或 characterId', this.currentConfig);
              this.setNumericalValue(this.nameNode, '数据错误');
              this.isRequesting = false;
              return;
            }
          } else if (this.currentConfig.entryType === ProfileEntryType.SEARCH || this.currentConfig.entryType === ProfileEntryType.OTHER) {
            // 搜索或其他：优先使用 friend_id，如果没有则使用 character_id
            if (this.currentConfig.friendId) {
              req.friend_id = this.currentConfig.friendId;
              console.log('[CharacterProfile] 请求查看角色信息 (friend_id):', this.currentConfig.friendId);
            } else if (this.currentConfig.characterId) {
              req.character_id = this.currentConfig.characterId;
              console.log('[CharacterProfile] 请求查看角色信息 (character_id):', this.currentConfig.characterId);
            }
          }

          console.log('[CharacterProfile] 发送 get_player 请求:', req, '当前配置:', this.currentConfig); // 优化：使用request方法，自动生成request_id并匹配响应
          // 注意：req中已经包含了request_id，request方法会使用它

          var requestData = {};
          if (req.character_id) requestData.character_id = req.character_id;
          if (req.friend_id) requestData.friend_id = req.friend_id;
          if (req.request_id) requestData.request_id = req.request_id;
          this.ws.request('get_player', requestData, response => {
            // 通过request_id匹配的响应回调
            // request方法已经验证了request_id，这里直接处理响应
            console.log('[CharacterProfile] ✅ 收到request方法回调的响应，request_id:', response.request_id);

            if (typeof this.onPlayerInfo === 'function') {
              this.onPlayerInfo(response);
            } else {
              console.error('[CharacterProfile] ❌ onPlayerInfo 回调不存在，忽略本次响应');
            }
          }, true, // 需要认证
          10000 // 10秒超时
          );
        }

        onDestroy() {
          if (this.ws) {
            this.ws.off('player_info', this.onPlayerInfo, this);
            this.ws.off('player_info_response', this.onPlayerInfo, this); // 新格式
          }
        }

        updateTitle(title) {
          this.setNumericalValue(this.nameNode, title);
        }
        /**
         * 格式化经验值显示
         * 超过1万显示为"X万"（四舍五入），不超过显示阿拉伯数字
         */


        formatExpValue(value) {
          if (value >= 10000) {
            // 超过1万，转换为"万"单位，四舍五入
            var wanValue = Math.round(value / 10000);
            return wanValue + "\u4E07";
          } else {
            // 不超过1万，显示阿拉伯数字
            return String(value);
          }
        }
        /**
         * 更新在线状态显示
         * 查看自己时不显示，查看他人时显示并更新Label文本（使用状态机）
         */


        updateOnlineStatus(isOnline, status) {
          if (!this.onlineStatusLabel) {
            // 如果未绑定在线状态Label，直接返回（允许UI中没有此节点）
            return;
          } // 查看自己时不显示在线状态


          if (this.viewMode === 'self') {
            this.onlineStatusLabel.node.active = false;
            console.log('[CharacterProfile] 查看自己，隐藏在线状态');
          } else {
            // 查看他人时显示在线状态并更新文本
            this.onlineStatusLabel.node.active = true; // 根据状态机状态显示文本

            var statusText = '离线';

            if (status === 'online') {
              statusText = '在线';
            } else if (status === 'in_battle') {
              statusText = '战斗中';
            } else if (status === 'offline') {
              statusText = '离线';
            } else {
              // 兼容旧逻辑
              statusText = isOnline ? '在线' : '离线';
            }

            this.onlineStatusLabel.string = statusText;
            console.log('[CharacterProfile] 查看他人，显示状态:', statusText, '状态机状态:', status);
          }
        }

        updateButtonsState(visible) {
          // 如果 actionButtonsNode 未绑定，直接返回（允许UI中没有操作按钮）
          if (!this.actionButtonsNode) {
            console.log('[CharacterProfile] actionButtonsNode 未绑定，跳过按钮状态更新');
            return;
          }

          this.actionButtonsNode.active = visible;

          if (!visible) {
            console.log('[CharacterProfile] 隐藏所有操作按钮');
            return;
          }

          var isSelf = this.viewMode === 'self';
          console.log('[CharacterProfile] 更新按钮状态:', {
            isSelf,
            isFriend: this.isFriend,
            targetFriendId: this.targetFriendId
          }); // 先隐藏所有按钮

          if (this.addFriendButton) this.addFriendButton.node.active = false;
          if (this.deleteFriendButton) this.deleteFriendButton.node.active = false;
          if (this.sendMessageButton) this.sendMessageButton.node.active = false;

          if (isSelf) {
            // 查看自己时，不显示好友操作按钮
            console.log('[CharacterProfile] 查看自己，隐藏所有操作按钮');
          } else {
            // 查看他人时
            if (this.isFriend) {
              // 是好友：显示删除好友、发送消息
              console.log('[CharacterProfile] 是好友，显示删除好友和发送消息按钮');
              if (this.deleteFriendButton) this.deleteFriendButton.node.active = true;
              if (this.sendMessageButton) this.sendMessageButton.node.active = true;
            } else {
              // 不是好友：显示添加好友
              console.log('[CharacterProfile] 不是好友，显示添加好友按钮');
              if (this.addFriendButton) this.addFriendButton.node.active = true;
            }
          }
        }

        onAddFriend() {
          var _this$currentConfig;

          if (!this.targetFriendId) {
            console.warn('[CharacterProfile] 无法添加好友：缺少目标好友ID');
            return;
          }

          var cid = this.ws.getCharacterId();

          if (!cid) {
            console.warn('[CharacterProfile] 无法添加好友：缺少当前角色ID');
            return;
          }

          console.log('[CharacterProfile] 请求添加好友:', {
            character_id: cid,
            target_friend_id: this.targetFriendId
          }); // 使用新的接口参数格式：target_friend_id 和 target_character_id
          // 根据 server/handlers/friend_handler.py，需要传入 target_friend_id 和 target_character_id

          var targetCharacterId = (_this$currentConfig = this.currentConfig) == null ? void 0 : _this$currentConfig.characterId;
          this.ws.request('add_friend', {
            target_friend_id: this.targetFriendId,
            target_character_id: targetCharacterId || undefined
          }, resp => {
            if (resp && resp.success) {
              console.log('[CharacterProfile] 好友申请发送成功'); // 更新按钮状态（变成已发送申请的状态，但当前实现中暂不处理）
            } else {
              console.warn('[CharacterProfile] 添加好友失败:', resp == null ? void 0 : resp.message);
            }
          });
        }

        onDeleteFriend() {
          if (!this.targetFriendId) {
            console.warn('[CharacterProfile] 无法删除好友：缺少目标好友ID');
            return;
          }

          var cid = this.ws.getCharacterId();

          if (!cid) {
            console.warn('[CharacterProfile] 无法删除好友：缺少当前角色ID');
            return;
          }

          console.log('[CharacterProfile] 请求删除好友:', {
            character_id: cid,
            friend_id: this.targetFriendId
          });
          this.ws.request('delete_friend', {
            character_id: cid,
            friend_id: this.targetFriendId
          }, resp => {
            if (resp && resp.success) {
              console.log('[CharacterProfile] 删除好友成功');
              this.isFriend = false;
              this.updateButtonsState(true); // 更新按钮状态为"添加好友"
              // 注意：这里不关闭面板，让用户继续查看该角色信息
            } else {
              console.warn('[CharacterProfile] 删除好友失败:', resp == null ? void 0 : resp.message);
            }
          });
        }

        onSendMessage() {
          // TODO: 实现跳转到聊天窗口
          console.log('[CharacterProfile] 点击发送消息'); // 可以通过事件总线通知聊天模块打开与该好友的会话
        }

        setNumericalValue(root, text) {
          if (!root) return;
          var child = root.getChildByName('NumericalValue');
          if (!child) return;
          var label = child.getComponent(Label);
          if (!label) return;
          label.string = text;
        }

        getClassName(cls) {
          switch (cls) {
            case 1:
              return '格斗家';

            case 2:
              return '枪械师';

            case 3:
              return '全能师';

            default:
              return String(cls);
          }
        }

        resetDisplay() {
          this.setNumericalValue(this.nameNode, '加载中...');
          this.setNumericalValue(this.levelNode, '--');
          this.setNumericalValue(this.idNode, '--');
          this.setNumericalValue(this.classNode, '--');
          this.setNumericalValue(this.coinsNode, '--');

          if (this.energyBlocksNode) {
            this.setNumericalValue(this.energyBlocksNode, '--');
          }

          this.setNumericalValue(this.robotCountNode, '--');
          if (this.expLabel) this.expLabel.string = '0/0';

          if (this.expPoint) {
            var ut = this.expPoint.getComponent(UITransform);
            if (ut) ut.setContentSize(new Size(0, ut.contentSize.height));
          } // 重置在线状态：默认隐藏，等收到数据后再根据模式显示


          if (this.onlineStatusLabel) {
            this.onlineStatusLabel.node.active = false;
          } // 可以根据需要重置立绘等

        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "nameNode", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "levelNode", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "idNode", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "classNode", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "coinsNode", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "energyBlocksNode", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "robotCountNode", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "expLabel", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "expPoint", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "spriteComp", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "spriteFrames", [_dec12], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "backButton", [_dec13], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor13 = _applyDecoratedDescriptor(_class2.prototype, "onlineStatusLabel", [_dec14], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor14 = _applyDecoratedDescriptor(_class2.prototype, "actionButtonsNode", [_dec15], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor15 = _applyDecoratedDescriptor(_class2.prototype, "addFriendButton", [_dec16], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor16 = _applyDecoratedDescriptor(_class2.prototype, "deleteFriendButton", [_dec17], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor17 = _applyDecoratedDescriptor(_class2.prototype, "sendMessageButton", [_dec18], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=bdb20c6cc2c4b009e407d465b17c98bd44efb806.js.map