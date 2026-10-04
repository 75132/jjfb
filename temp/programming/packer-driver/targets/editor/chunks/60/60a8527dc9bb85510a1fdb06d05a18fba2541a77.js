System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, ScrollView, Prefab, instantiate, EditBox, Label, Color, Button, WebSocketManager, FriendItem, FriendItemMode, CharacterProfile, ProfileEntryType, Logger, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _dec14, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _descriptor13, _class3, _crd, ccclass, property, FriendPanel;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfFriendItem(extras) {
    _reporterNs.report("FriendItem", "./FriendItem", _context.meta, extras);
  }

  function _reportPossibleCrUseOfFriendItemMode(extras) {
    _reporterNs.report("FriendItemMode", "./FriendItem", _context.meta, extras);
  }

  function _reportPossibleCrUseOfCharacterProfile(extras) {
    _reporterNs.report("CharacterProfile", "./CharacterProfile", _context.meta, extras);
  }

  function _reportPossibleCrUseOfProfileEntryType(extras) {
    _reporterNs.report("ProfileEntryType", "./CharacterProfile", _context.meta, extras);
  }

  function _reportPossibleCrUseOfLogger(extras) {
    _reporterNs.report("Logger", "../global/Logger", _context.meta, extras);
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
      ScrollView = _cc.ScrollView;
      Prefab = _cc.Prefab;
      instantiate = _cc.instantiate;
      EditBox = _cc.EditBox;
      Label = _cc.Label;
      Color = _cc.Color;
      Button = _cc.Button;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      FriendItem = _unresolved_3.FriendItem;
      FriendItemMode = _unresolved_3.FriendItemMode;
    }, function (_unresolved_4) {
      CharacterProfile = _unresolved_4.CharacterProfile;
      ProfileEntryType = _unresolved_4.ProfileEntryType;
    }, function (_unresolved_5) {
      Logger = _unresolved_5.Logger;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "61bafoWIwFKGI/ZHLZ+hn3G", "FriendPanel", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'ScrollView', 'Prefab', 'instantiate', 'EditBox', 'Label', 'Color', 'Button']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("FriendPanel", FriendPanel = (_dec = ccclass('FriendPanel'), _dec2 = property(Node), _dec3 = property(Node), _dec4 = property(Node), _dec5 = property(Node), _dec6 = property(ScrollView), _dec7 = property(Node), _dec8 = property(Prefab), _dec9 = property(EditBox), _dec10 = property(Node), _dec11 = property(Node), _dec12 = property(Node), _dec13 = property(Node), _dec14 = property(Node), _dec(_class = (_class2 = (_class3 = class FriendPanel extends Component {
        constructor(...args) {
          super(...args);

          // ====== 顶部按钮 & 面板 ======
          _initializerDefineProperty(this, "requestListButton", _descriptor, this);

          // RequestList
          _initializerDefineProperty(this, "friendListButton", _descriptor2, this);

          // FriendList
          _initializerDefineProperty(this, "addFriendButton", _descriptor3, this);

          // AddFriend
          _initializerDefineProperty(this, "addFriendPanel", _descriptor4, this);

          // AddFriendPanel
          // ====== ScrollView（好友/申请通用） ======
          _initializerDefineProperty(this, "scrollView", _descriptor5, this);

          _initializerDefineProperty(this, "content", _descriptor6, this);

          // ScrollView/view/content
          _initializerDefineProperty(this, "friendItemPrefab", _descriptor7, this);

          // FriendItemPrefab
          // ====== AddFriendPanel 内部 ======
          _initializerDefineProperty(this, "addFriendEditBox", _descriptor8, this);

          _initializerDefineProperty(this, "addFriendResultRoot", _descriptor9, this);

          // AddFriendPanel 下用来摆放一个 FriendItemPrefab
          _initializerDefineProperty(this, "addFriendConfirmButton", _descriptor10, this);

          // AddFriendPanel/Confirm（自动绑定点击事件）
          _initializerDefineProperty(this, "addFriendResultLabel", _descriptor11, this);

          // ResultRoot/Result（Label节点，显示"不存在该玩家"的文本）
          // ====== BackControl ======
          _initializerDefineProperty(this, "backControlButton", _descriptor12, this);

          // BackControl/Button
          // ====== CharacterProfile 引用 ======
          _initializerDefineProperty(this, "characterProfileNode", _descriptor13, this);

          // Character 面板节点（必须绑定）
          // ====== 状态 ======
          this.ws = null;
          this.currentTab = 'friend';
          this.currentItems = [];
          this.addFriendResultItem = null;
          this.cacheOwnerId = '';
          this.listCache = {
            friend: null,
            request: null
          };
          this.listCacheAt = {
            friend: 0,
            request: 0
          };
          this.renderedTab = null;
          this.renderedSig = '';
        }

        onLoad() {
          this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance(); // 顶部按钮（使用 Button.EventType.CLICK，兼容有 Button 组件的节点）

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
          } // 添加好友面板 - 确认按钮自动绑定点击事件（避免在编辑器里手动加 ClickEvents）


          if (this.addFriendConfirmButton) {
            const button = this.addFriendConfirmButton.getComponent(Button);

            if (button) {
              button.node.on(Button.EventType.CLICK, this.onConfirmAddFriend, this);
            } else {
              this.addFriendConfirmButton.on(Node.EventType.TOUCH_END, this.onConfirmAddFriend, this);
            }
          } // BackControl 顶层返回按钮：关闭所有 Set 面板和 AddFriendPanel


          if (this.backControlButton) {
            const button = this.backControlButton.getComponent(Button);

            if (button) {
              button.node.on(Button.EventType.CLICK, this.handleBackControl, this);
            } else {
              this.backControlButton.on(Node.EventType.TOUCH_END, this.handleBackControl, this);
            }
          } // 设置 ResultRoot 缩放为 0.96，位置 x 归零


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
        } // ====== Tab 切换 ======


        switchTab(tab) {
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).debug('[FriendPanel] switchTab 被调用:', tab, '当前tab:', this.currentTab);
          this.currentTab = tab;
          this.refreshCurrentList(false);
        }

        refreshCurrentList(force = false) {
          if (!this.ws) this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
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

        ensureCacheOwner() {
          var _this$ws;

          const cid = ((_this$ws = this.ws) == null ? void 0 : _this$ws.getCharacterId()) || '';
          if (cid === this.cacheOwnerId) return;
          this.cacheOwnerId = cid;
          this.listCache.friend = null;
          this.listCache.request = null;
          this.listCacheAt.friend = 0;
          this.listCacheAt.request = 0;
          this.renderedTab = null;
          this.renderedSig = '';
        }

        tryReuseCachedList() {
          const tab = this.currentTab;
          const list = this.listCache[tab];
          if (!list) return false;
          if (Date.now() - this.listCacheAt[tab] >= FriendPanel.LIST_CACHE_TTL_MS) return false;
          const mode = tab === 'friend' ? (_crd && FriendItemMode === void 0 ? (_reportPossibleCrUseOfFriendItemMode({
            error: Error()
          }), FriendItemMode) : FriendItemMode).FRIEND : (_crd && FriendItemMode === void 0 ? (_reportPossibleCrUseOfFriendItemMode({
            error: Error()
          }), FriendItemMode) : FriendItemMode).REQUEST;
          if (this.renderedTab === tab && this.renderedSig === this.listSignature(list)) return true;
          this.syncList(list, mode, false);
          return true;
        }

        listSignature(list) {
          return list.map(f => {
            var _f$Sprite;

            const id = `${f.friend_id || ''}|${f.character_id || ''}`;
            return `${id}:${f.role_name || ''}:${(_f$Sprite = f.Sprite) != null ? _f$Sprite : 0}:${f.online ? 1 : 0}`;
          }).join('\n');
        }

        rememberList(list) {
          this.listCache[this.currentTab] = list;
          this.listCacheAt[this.currentTab] = Date.now();
          this.renderedTab = this.currentTab;
          this.renderedSig = this.listSignature(list);
        }

        clearContent() {
          if (!this.content) return;
          this.currentItems.length = 0;
          this.content.removeAllChildren();
        } // ====== 网络请求：好友列表 ======


        requestFriendList() {
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).debug('[FriendPanel] 发送获取好友列表请求'); // 检查 WebSocket 连接状态

          if (!this.ws || !this.ws.isConnected()) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[FriendPanel] WebSocket 未连接，无法获取好友列表');
            return;
          } // 检查是否有必要的认证信息


          const token = this.ws.getToken();
          const characterId = this.ws.getCharacterId();

          if (!token || !characterId) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[FriendPanel] 缺少认证信息，无法获取好友列表', {
              token: !!token,
              characterId: !!characterId
            });
            return;
          }

          this.ws.request('get_friend_list', {
            character_id: characterId
          }, resp => {
            var _this$node;

            if (!((_this$node = this.node) != null && _this$node.isValid) || this.currentTab !== 'friend') return;
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug('[FriendPanel] 收到好友列表响应:', resp);

            if (!resp || !resp.success) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[FriendPanel] 获取好友列表失败:', (resp == null ? void 0 : resp.message) || '未知错误', resp);
              return;
            }

            if (!resp.data) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[FriendPanel] 响应中没有data字段:', resp);
              return;
            }

            const list = resp.data.list || [];
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug('[FriendPanel] 解析到的好友列表:', list.length, '个好友', list);

            if (list.length === 0) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug('[FriendPanel] 好友列表为空');
            }

            this.syncList(list, (_crd && FriendItemMode === void 0 ? (_reportPossibleCrUseOfFriendItemMode({
              error: Error()
            }), FriendItemMode) : FriendItemMode).FRIEND, true);
          });
        } // ====== 网络请求：好友申请列表 ======


        requestFriendRequestList() {
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).debug('[FriendPanel] 发送获取好友申请列表请求'); // 检查 WebSocket 连接状态

          if (!this.ws || !this.ws.isConnected()) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[FriendPanel] WebSocket 未连接，无法获取好友申请列表');
            return;
          } // 检查是否有必要的认证信息


          const token = this.ws.getToken();
          const characterId = this.ws.getCharacterId();

          if (!token || !characterId) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[FriendPanel] 缺少认证信息，无法获取好友申请列表', {
              token: !!token,
              characterId: !!characterId
            });
            return;
          }

          this.ws.request('get_friend_requests', {
            character_id: characterId
          }, resp => {
            var _this$node2;

            if (!((_this$node2 = this.node) != null && _this$node2.isValid) || this.currentTab !== 'request') return;
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug('[FriendPanel] 收到好友申请列表响应:', resp);

            if (!resp || !resp.success || !resp.data) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[FriendPanel] 获取好友申请列表失败:', resp == null ? void 0 : resp.message);
              return;
            }

            const list = resp.data.list || [];
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug('[FriendPanel] 解析到的好友申请列表:', list.length, '个申请', list);
            this.syncList(list, (_crd && FriendItemMode === void 0 ? (_reportPossibleCrUseOfFriendItemMode({
              error: Error()
            }), FriendItemMode) : FriendItemMode).REQUEST, true);
          });
        } // ====== 构建 ScrollView 列表 ======


        dataKey(f) {
          return `${f.friend_id || ''}|${f.character_id || ''}`;
        }

        itemKey(it) {
          return `${it.friendId || ''}|${it.characterId || ''}`;
        }
        /** 命中相同名单时不拆节点；增删改只动差异行。 */


        syncList(list, mode, fromNetwork) {
          if (!this.friendItemPrefab || !this.content) return;
          const sig = this.listSignature(list);

          if (this.renderedTab === this.currentTab && this.renderedSig === sig && this.currentItems.length === list.length) {
            if (fromNetwork) this.rememberList(list);
            return;
          }

          const existing = new Map();

          for (const it of this.currentItems) {
            const k = this.itemKey(it);
            if (k !== '|' && !existing.has(k)) existing.set(k, it);
          }

          const startX = 240;
          const startY = -30;
          const itemSpacing = 60;
          const next = [];
          const callbacks = {
            onOpenSetPanel: i => this.handleOpenSetPanel(i),
            onLeftAction: i => this.handleLeftAction(i),
            onRightAction: i => this.handleRightAction(i)
          };

          for (let i = 0; i < list.length; i++) {
            var _existing$get, _item, _f$Sprite2, _f$role_name;

            const f = list[i];
            const k = this.dataKey(f);
            let item = k !== '|' ? (_existing$get = existing.get(k)) != null ? _existing$get : null : null;
            if (item) existing.delete(k);

            if (!((_item = item) != null && (_item = _item.node) != null && _item.isValid)) {
              const node = instantiate(this.friendItemPrefab);
              this.content.addChild(node);
              item = node.getComponent(_crd && FriendItem === void 0 ? (_reportPossibleCrUseOfFriendItem({
                error: Error()
              }), FriendItem) : FriendItem);

              if (!item) {
                node.destroy();
                continue;
              }
            } else if (item.node.parent !== this.content) {
              this.content.addChild(item.node);
            }

            item.init({
              characterId: f.character_id,
              friendId: f.friend_id,
              spriteIndex: (_f$Sprite2 = f.Sprite) != null ? _f$Sprite2 : 0,
              roleName: (_f$role_name = f.role_name) != null ? _f$role_name : '',
              isOnline: !!f.online,
              mode
            }, callbacks);
            item.node.setPosition(startX, startY - i * itemSpacing, item.node.position.z);
            item.node.setSiblingIndex(i);
            next.push(item);
          }

          const kept = new Set(next);

          for (const it of this.currentItems) {
            var _it$node;

            if (!kept.has(it) && it != null && (_it$node = it.node) != null && _it$node.isValid) it.node.destroy();
          }

          this.currentItems = next;
          if (fromNetwork) this.rememberList(list);else {
            this.renderedTab = this.currentTab;
            this.renderedSig = sig;
          }
        } // 只允许一个 Set 面板打开，点击 BackControl 全部关闭


        handleOpenSetPanel(item) {
          // 关闭其他所有 Set 面板
          for (const it of this.currentItems) {
            if (it !== item) {
              it.closeSetPanel();
            }
          }

          if (this.addFriendResultItem && this.addFriendResultItem !== item) {
            this.addFriendResultItem.closeSetPanel();
          } // 将当前打开的 FriendItem 节点移到 content 的最后（顶层），确保操作窗口显示在最上层


          if (item.node && item.node.parent === this.content && this.content.children.length > 0) {
            const lastIndex = this.content.children.length - 1;
            item.node.setSiblingIndex(lastIndex);
          }
        } // ====== Set 面板左/右按钮行为 ======


        handleLeftAction(item) {
          switch (item.mode) {
            case (_crd && FriendItemMode === void 0 ? (_reportPossibleCrUseOfFriendItemMode({
              error: Error()
            }), FriendItemMode) : FriendItemMode).FRIEND:
              // 查看好友信息
              this.viewFriendInfo(item);
              break;

            case (_crd && FriendItemMode === void 0 ? (_reportPossibleCrUseOfFriendItemMode({
              error: Error()
            }), FriendItemMode) : FriendItemMode).REQUEST:
              this.approveFriend(item);
              break;

            case (_crd && FriendItemMode === void 0 ? (_reportPossibleCrUseOfFriendItemMode({
              error: Error()
            }), FriendItemMode) : FriendItemMode).SEARCH_RESULT:
              // 查看搜索结果角色信息
              this.viewFriendInfo(item);
              break;
          }
        }
        /**
         * 查看好友信息
         */


        viewFriendInfo(item) {
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).debug('[FriendPanel] viewFriendInfo 被调用:', {
            mode: item.mode,
            characterId: item.characterId,
            friendId: item.friendId,
            roleName: item.roleName
          });

          if (!this.characterProfileNode) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[FriendPanel] CharacterProfileNode 未绑定，无法查看好友信息');
            return;
          }

          const characterProfile = this.characterProfileNode.getComponent(_crd && CharacterProfile === void 0 ? (_reportPossibleCrUseOfCharacterProfile({
            error: Error()
          }), CharacterProfile) : CharacterProfile);

          if (!characterProfile) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[FriendPanel] CharacterProfileNode 上未找到 CharacterProfile 组件');
            return;
          } // 关闭 Set 面板


          item.closeSetPanel(); // 调用 CharacterProfile 显示好友信息
          // 使用新的 show 方法，传入完整的配置

          if (item.mode === (_crd && FriendItemMode === void 0 ? (_reportPossibleCrUseOfFriendItemMode({
            error: Error()
          }), FriendItemMode) : FriendItemMode).FRIEND) {
            // 好友模式：优先传 friendId 用于查询数据库，同时也传 characterId 作为备份
            characterProfile.show({
              entryType: (_crd && ProfileEntryType === void 0 ? (_reportPossibleCrUseOfProfileEntryType({
                error: Error()
              }), ProfileEntryType) : ProfileEntryType).FRIEND_LIST,
              friendId: item.friendId,
              // 优先使用 friend_id 查询
              characterId: item.characterId,
              // 作为备份
              roleName: item.roleName
            });
          } else {
            // 搜索模式或其他：如果有 friendId 则优先使用，否则使用 characterId
            characterProfile.show({
              entryType: item.mode === (_crd && FriendItemMode === void 0 ? (_reportPossibleCrUseOfFriendItemMode({
                error: Error()
              }), FriendItemMode) : FriendItemMode).SEARCH_RESULT ? (_crd && ProfileEntryType === void 0 ? (_reportPossibleCrUseOfProfileEntryType({
                error: Error()
              }), ProfileEntryType) : ProfileEntryType).SEARCH : (_crd && ProfileEntryType === void 0 ? (_reportPossibleCrUseOfProfileEntryType({
                error: Error()
              }), ProfileEntryType) : ProfileEntryType).OTHER,
              friendId: item.friendId || undefined,
              // 优先使用 friend_id（如果有）
              characterId: item.characterId || undefined,
              // 如果没有 friend_id 则使用 character_id
              roleName: item.roleName
            });
          }
        }

        handleRightAction(item) {
          switch (item.mode) {
            case (_crd && FriendItemMode === void 0 ? (_reportPossibleCrUseOfFriendItemMode({
              error: Error()
            }), FriendItemMode) : FriendItemMode).FRIEND:
              this.deleteFriend(item);
              break;

            case (_crd && FriendItemMode === void 0 ? (_reportPossibleCrUseOfFriendItemMode({
              error: Error()
            }), FriendItemMode) : FriendItemMode).REQUEST:
              this.rejectFriend(item);
              break;

            case (_crd && FriendItemMode === void 0 ? (_reportPossibleCrUseOfFriendItemMode({
              error: Error()
            }), FriendItemMode) : FriendItemMode).SEARCH_RESULT:
              this.addFriend(item);
              break;
          }
        } // ====== 好友操作：全部走服务器 ======


        deleteFriend(item) {
          this.ws.request('delete_friend', {
            friend_id: item.friendId,
            character_id: item.characterId
          }, resp => {
            if (!resp || !resp.success) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[FriendPanel] 删除好友失败:', resp == null ? void 0 : resp.message);
              return;
            }

            this.refreshCurrentList(true);
          });
        }

        approveFriend(item) {
          this.ws.request('approve_friend', {
            friend_id: item.friendId,
            character_id: item.characterId
          }, resp => {
            if (!resp || !resp.success) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[FriendPanel] 同意好友失败:', resp == null ? void 0 : resp.message);
              return;
            } // 同意后：从申请列表移除，并让好友列表缓存失效


            this.listCache.friend = null;
            this.listCacheAt.friend = 0;
            this.refreshCurrentList(true);
          });
        }

        rejectFriend(item) {
          this.ws.request('reject_friend', {
            friend_id: item.friendId,
            character_id: item.characterId
          }, resp => {
            if (!resp || !resp.success) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[FriendPanel] 拒绝好友失败:', resp == null ? void 0 : resp.message);
              return;
            }

            this.refreshCurrentList(true);
          });
        }

        addFriend(item) {
          this.ws.request('add_friend', {
            target_friend_id: item.friendId,
            target_character_id: item.characterId
          }, resp => {
            if (!resp || !resp.success) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[FriendPanel] 添加好友失败:', resp == null ? void 0 : resp.message);
              return;
            } // 添加成功后可以自动切到好友列表


            this.addFriendPanel.active = false;
            this.currentTab = 'friend';
            this.refreshCurrentList(true);
          });
        } // ====== AddFriendPanel 逻辑 ======


        onConfirmAddFriend() {
          if (!this.addFriendEditBox) {
            return;
          }

          const text = (this.addFriendEditBox.string || '').trim(); // 输入验证：空输入

          if (!text) {
            this.showSearchError('请输入好友ID');
            return;
          } // 输入验证：非数字


          if (!/^\d+$/.test(text)) {
            this.showSearchError('好友ID只能包含数字');
            return;
          } // 输入验证：位数不够


          if (text.length < 6) {
            this.showSearchError(`好友ID不足6位，当前${text.length}位`);
            return;
          } // 输入验证：位数太多


          if (text.length > 6) {
            this.showSearchError(`好友ID超过6位，当前${text.length}位`);
            return;
          } // 验证通过，执行搜索


          this.searchFriendById(text);
        }
        /**
         * 显示搜索错误提示
         */


        showSearchError(message) {
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).debug('[FriendPanel] 显示错误提示:', message); // 先清空搜索结果（不隐藏标签）

          this.clearAddFriendResult(false); // 然后显示错误文本

          if (this.addFriendResultLabel) {
            const label = this.addFriendResultLabel.getComponent(Label);

            if (label) {
              label.string = message;
              label.color = new Color(255, 0, 0, 255); // 大红色

              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug('[FriendPanel] 已设置错误文本:', message);
            } else {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[FriendPanel] Result节点上没有Label组件！');
            }

            this.addFriendResultLabel.active = true;
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug('[FriendPanel] Result节点已激活');
          } else {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn('[FriendPanel] addFriendResultLabel 未绑定！');
          }
        }

        searchFriendById(friendId) {
          this.ws.request('search_friend', {
            friend_id: friendId
          }, resp => {
            var _f$Sprite3, _f$role_name2;

            this.clearAddFriendResult(true);

            if (!resp || !resp.success || !resp.data || !resp.data.friend) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[FriendPanel] 未找到该好友:', resp == null ? void 0 : resp.message); // 显示"不存在该玩家"文本（大红色）

              if (this.addFriendResultLabel) {
                const label = this.addFriendResultLabel.getComponent(Label);

                if (label) {
                  label.string = '不存在该玩家';
                  label.color = new Color(255, 0, 0, 255); // 大红色
                }

                this.addFriendResultLabel.active = true;
              }

              return;
            } // 搜索成功：隐藏错误文本


            if (this.addFriendResultLabel) {
              this.addFriendResultLabel.active = false;
            }

            const f = resp.data.friend;

            if (!this.friendItemPrefab || !this.addFriendResultRoot) {
              return;
            }

            const node = instantiate(this.friendItemPrefab);
            node.parent = this.addFriendResultRoot; // 设置 FriendItemPrefab 的 x 位置为 0

            node.setPosition(0, node.position.y, node.position.z); // 确保节点在父节点的最后（顶层），这样操作窗口不会被遮挡

            const lastIndex = this.addFriendResultRoot.children.length - 1;

            if (lastIndex >= 0) {
              node.setSiblingIndex(lastIndex);
            }

            const item = node.getComponent(_crd && FriendItem === void 0 ? (_reportPossibleCrUseOfFriendItem({
              error: Error()
            }), FriendItem) : FriendItem);
            if (!item) return;
            item.init({
              characterId: f.character_id,
              friendId: f.friend_id,
              spriteIndex: (_f$Sprite3 = f.Sprite) != null ? _f$Sprite3 : 0,
              roleName: (_f$role_name2 = f.role_name) != null ? _f$role_name2 : '',
              isOnline: !!f.online,
              mode: (_crd && FriendItemMode === void 0 ? (_reportPossibleCrUseOfFriendItemMode({
                error: Error()
              }), FriendItemMode) : FriendItemMode).SEARCH_RESULT
            }, {
              onOpenSetPanel: i => this.handleOpenSetPanel(i),
              onLeftAction: i => this.handleLeftAction(i),
              onRightAction: i => this.handleRightAction(i)
            });
            this.addFriendResultItem = item;
          });
        }
        /**
         * 清空搜索结果
         * @param hideLabel 是否同时隐藏错误文本（默认 true）
         */


        clearAddFriendResult(hideLabel = true) {
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
        } // ====== BackControl：关闭所有浮层，如果没有浮层则关闭好友界面 ======


        handleBackControl() {
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
          } // 检查 AddFriendPanel 是否打开


          const isAddFriendPanelOpen = this.addFriendPanel ? this.addFriendPanel.active : false; // 如果有打开的浮层，先关闭它们

          if (hasOpenSetPanel || isAddFriendPanelOpen) {
            // 关闭所有 Set 面板
            for (const it of this.currentItems) {
              it.closeSetPanel();
            }

            if (this.addFriendResultItem) {
              this.addFriendResultItem.closeSetPanel();
            } // 关闭 AddFriendPanel


            if (this.addFriendPanel) {
              this.addFriendPanel.active = false;
            }
          } else {
            // 没有任何打开的浮层，直接关闭好友界面
            this.node.active = false;
          }
        }

      }, _class3.LIST_CACHE_TTL_MS = 5000, _class3), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "requestListButton", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "friendListButton", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "addFriendButton", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "addFriendPanel", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "scrollView", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "content", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "friendItemPrefab", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "addFriendEditBox", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "addFriendResultRoot", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "addFriendConfirmButton", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "addFriendResultLabel", [_dec12], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "backControlButton", [_dec13], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor13 = _applyDecoratedDescriptor(_class2.prototype, "characterProfileNode", [_dec14], {
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
//# sourceMappingURL=60a8527dc9bb85510a1fdb06d05a18fba2541a77.js.map