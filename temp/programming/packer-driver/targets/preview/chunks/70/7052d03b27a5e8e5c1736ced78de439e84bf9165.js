System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Prefab, instantiate, Label, ScrollView, UITransform, Layout, WebSocketManager, GameConfig, _dec, _dec2, _dec3, _dec4, _class, _class2, _descriptor, _descriptor2, _descriptor3, _crd, ccclass, property, AnnouncementPanel;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

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
      Node = _cc.Node;
      Prefab = _cc.Prefab;
      instantiate = _cc.instantiate;
      Label = _cc.Label;
      ScrollView = _cc.ScrollView;
      UITransform = _cc.UITransform;
      Layout = _cc.Layout;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      GameConfig = _unresolved_3.GameConfig;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "bd1f0IN2SVH+KmAu/85BOMK", "AnnouncementPanel", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Prefab', 'instantiate', 'Label', 'ScrollView', 'UITransform', 'Layout']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("AnnouncementPanel", AnnouncementPanel = (_dec = ccclass('AnnouncementPanel'), _dec2 = property({
        type: Node
      }), _dec3 = property({
        type: ScrollView
      }), _dec4 = property({
        type: Prefab
      }), _dec(_class = (_class2 = class AnnouncementPanel extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "content", _descriptor, this);

          _initializerDefineProperty(this, "scrollView", _descriptor2, this);

          _initializerDefineProperty(this, "msgLabelPrefab", _descriptor3, this);

          this.wsManager = null;
          this.maxItems = 15;
          this.historyLoaded = false;
          this.annList = [];
          this.chatList = [];
          this.annLoaded = false;
          this.chatLoaded = false;
          this.hasRequestedHistory = false;

          /**
           * 网络连接成功回调（MMO最佳实践：连接成功后再加载数据）
           */
          this.onNetworkConnect = () => {
            console.log('🔄 [AnnouncementPanel] 网络连接成功，尝试加载聊天记录');
            this.tryLoadHistory();
          };

          /**
           * 数据变化回调（MMO最佳实践：登录成功后加载数据）
           */
          this.onDataChanged = data => {
            // 当 token 或 characterId 被设置时，尝试加载聊天记录
            if (data && (data.token || data.characterId)) {
              console.log('🔄 [AnnouncementPanel] 检测到登录数据变化，尝试加载聊天记录');
              this.tryLoadHistory();
            }
          };
        }

        // 标记是否已请求过历史记录
        start() {
          this.wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          this.ensureLayout();
          this.historyLoaded = false;
          this.annLoaded = false;
          this.chatLoaded = false;
          this.annList = [];
          this.chatList = [];
          this.hasRequestedHistory = false; // 注册消息监听

          this.wsManager.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.ANNOUNCEMENT, this.onAnnouncement, this);
          this.wsManager.on('chat_message', this.onChatMessage, this);
          this.wsManager.on('chat_history', this.onChatHistory, this);
          this.wsManager.on('announcement_list', this.onAnnouncementList, this); // 监听网络连接事件（MMO最佳实践：连接成功后再加载数据）

          var wsNode = this.wsManager.node;

          if (wsNode) {
            wsNode.on('network_connect', this.onNetworkConnect, this);
            wsNode.on('data_changed', this.onDataChanged, this);
          } // 如果已经连接，立即加载；否则等待连接成功


          this.tryLoadHistory();
        }

        /**
         * 尝试加载聊天记录（检查连接状态）
         */
        tryLoadHistory() {
          var _this$wsManager$getTo, _this$wsManager;

          // 如果已经请求过，不再重复请求
          if (this.hasRequestedHistory) {
            return;
          } // 检查连接状态


          if (!this.wsManager || !this.wsManager.isConnected()) {
            console.log('⏳ [AnnouncementPanel] WebSocket未连接，等待连接...');
            return;
          } // 检查是否有必要的凭证（登录后才有）


          var token = (_this$wsManager$getTo = (_this$wsManager = this.wsManager).getToken) == null ? void 0 : _this$wsManager$getTo.call(_this$wsManager);

          if (!token) {
            console.log('⏳ [AnnouncementPanel] 未登录，等待登录...');
            return;
          } // 连接成功且已登录，加载聊天记录


          console.log('📥 [AnnouncementPanel] 开始加载聊天记录');
          this.hasRequestedHistory = true; // 优化：使用request方法，自动生成request_id并匹配响应

          this.wsManager.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.GET_CHAT_HISTORY, {
            limit: 8
          }, response => {
            // 通过request_id匹配的响应回调
            this.onChatHistory(response);
          }, true, // 需要认证
          10000 // 10秒超时
          );
          this.wsManager.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.GET_ANNOUNCEMENTS_HISTORY, {
            limit: 8
          }, response => {
            // 通过request_id匹配的响应回调
            this.onAnnouncementList(response);
          }, true, // 需要认证
          10000 // 10秒超时
          );
        }
        /**
         * 当节点启用时调用（面板显示时）
         * MMO最佳实践：确保每次显示时都有最新数据
         */


        onEnable() {
          // 重置加载状态，允许重新加载
          this.historyLoaded = false;
          this.annLoaded = false;
          this.chatLoaded = false;
          this.annList = [];
          this.chatList = []; // 尝试加载历史记录（如果连接已建立）

          this.hasRequestedHistory = false; // 重置标记，允许重新请求

          this.tryLoadHistory();
        }

        onAnnouncement(data) {
          if (!data) {
            return;
          }

          var text = String(data.text || '');

          if (!text) {
            return;
          } // 统一格式：与大窗口一致，使用 [世]系统：前缀


          this.addMessage("[\u4E16]\u7CFB\u7EDF\uFF1A" + text);
        }

        onChatHistory(data) {
          console.log('📥 [AnnouncementPanel] 收到chat_history响应:', data); // 兼容服务器返回的格式：可能是 data.messages 或 data.list 或 data.data.messages

          var list = [];

          if (data && data.data && Array.isArray(data.data.messages)) {
            list = data.data.messages;
          } else if (data && Array.isArray(data.messages)) {
            list = data.messages;
          } else if (data && Array.isArray(data.list)) {
            list = data.list;
          }

          this.chatList = list;
          this.chatLoaded = true;
          console.log("\u2705 [AnnouncementPanel] \u804A\u5929\u5386\u53F2\u5DF2\u52A0\u8F7D\uFF0C\u5171 " + list.length + " \u6761");
          this.renderCombinedHistory();
        }

        onAnnouncementList(data) {
          console.log('📥 [AnnouncementPanel] 收到announcement_list响应:', data); // 兼容服务器返回的格式：可能是 data.announcements 或 data.list 或 data.data.announcements

          var list = [];

          if (data && data.data && Array.isArray(data.data.announcements)) {
            list = data.data.announcements;
          } else if (data && Array.isArray(data.announcements)) {
            list = data.announcements;
          } else if (data && Array.isArray(data.list)) {
            list = data.list;
          }

          this.annList = list;
          this.annLoaded = true;
          console.log("\u2705 [AnnouncementPanel] \u516C\u544A\u5217\u8868\u5DF2\u52A0\u8F7D\uFF0C\u5171 " + list.length + " \u6761");
          this.renderCombinedHistory();
        }

        renderCombinedHistory() {
          if (this.historyLoaded) {
            return;
          }

          if (!(this.annLoaded && this.chatLoaded)) {
            return;
          } // 统一格式：与大窗口一致


          var ann = this.annList.map(m => ({
            created_at: m && m.created_at ? Date.parse(m.created_at) : 0,
            line: "[\u4E16]\u7CFB\u7EDF\uFF1A" + String(m && m.text || '')
          }));
          var chat = this.chatList.map(m => ({
            created_at: m && m.created_at ? Date.parse(m.created_at) : 0,
            // 玩家消息格式：[世]名：消息（与大窗口一致）
            line: "[\u4E16]" + String(m && m.sender || '') + "\uFF1A" + String(m && m.text || '')
          }));
          var merged = ann.concat(chat).filter(x => x.line.trim().length > 0);

          if (merged.length === 0) {
            return;
          }

          merged.sort((a, b) => b.created_at - a.created_at);

          if (this.content) {
            this.content.removeAllChildren();
          }

          for (var i = merged.length - 1; i >= 0; i--) {
            this.addMessage(merged[i].line);
          }

          this.historyLoaded = true;
        }

        onChatMessage(data) {
          if (!data) {
            return;
          }

          var sender = String(data.sender || '');
          var text = String(data.text || ''); // 统一格式：与大窗口一致，使用 [世]名：消息 格式

          var line = sender ? "[\u4E16]" + sender + "\uFF1A" + text : "[\u4E16]\u7CFB\u7EDF\uFF1A" + text;

          if (line) {
            this.addMessage(line);
          }
        }

        addMessage(text) {
          if (!this.content || !this.msgLabelPrefab) {
            return;
          }

          var node = instantiate(this.msgLabelPrefab);
          var label = node.getComponent(Label);

          if (label) {
            label.string = text;
            label.overflow = Label.Overflow.RESIZE_HEIGHT;
            label.enableWrapText = true;
            label.verticalAlign = Label.VerticalAlign.TOP;
          }

          var contentUT = this.content.getComponent(UITransform);
          var nodeUT = node.getComponent(UITransform);

          if (contentUT && nodeUT) {
            nodeUT.width = contentUT.width;
          }

          this.content.insertChild(node, 0);
          var layout = this.content.getComponent(Layout);

          if (layout) {
            layout.updateLayout();
          }

          var children = this.content.children;

          if (children.length > this.maxItems) {
            var last = children[children.length - 1];

            try {
              if (last && last.isValid && !last.__scheduledDestroy) {
                last.removeFromParent();
                last.__scheduledDestroy = true;
                last.destroy();
              }
            } catch (_unused) {}
          }

          if (this.scrollView) {
            this.scrollView.scrollToTop(0.2, true);
          }
        }

        onDestroy() {
          var _this$wsManager2;

          if (this.wsManager) {
            this.wsManager.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.ANNOUNCEMENT, this.onAnnouncement, this);
            this.wsManager.off('chat_message', this.onChatMessage, this);
            this.wsManager.off('chat_history', this.onChatHistory, this);
            this.wsManager.off('announcement_list', this.onAnnouncementList, this);
          } // 移除网络连接和数据变化事件监听


          var wsNode = (_this$wsManager2 = this.wsManager) == null ? void 0 : _this$wsManager2.node;

          if (wsNode) {
            wsNode.off('network_connect', this.onNetworkConnect, this);
            wsNode.off('data_changed', this.onDataChanged, this);
          }
        }

        ensureLayout() {
          if (!this.content) {
            return;
          }

          var contentUT = this.content.getComponent(UITransform);

          if (contentUT) {
            contentUT.anchorY = 1;
          }

          var layout = this.content.getComponent(Layout);

          if (!layout) {
            layout = this.content.addComponent(Layout);
          }

          layout.type = Layout.Type.VERTICAL;
          layout.resizeMode = Layout.ResizeMode.CONTAINER;
          layout.verticalDirection = Layout.VerticalDirection.TOP_TO_BOTTOM;
          layout.spacingY = 6;
          layout.paddingTop = 4;
          layout.paddingBottom = 4;
          layout.updateLayout();
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "content", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "scrollView", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "msgLabelPrefab", [_dec4], {
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
//# sourceMappingURL=7052d03b27a5e8e5c1736ced78de439e84bf9165.js.map