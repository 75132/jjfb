System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, instantiate, Label, ScrollView, UITransform, Layout, EditBox, Button, Sprite, Color, WebSocketManager, GameConfig, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _class3, _crd, ccclass, property, ChatRoomFull;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "../../global/GameConfig", _context.meta, extras);
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
      instantiate = _cc.instantiate;
      Label = _cc.Label;
      ScrollView = _cc.ScrollView;
      UITransform = _cc.UITransform;
      Layout = _cc.Layout;
      EditBox = _cc.EditBox;
      Button = _cc.Button;
      Sprite = _cc.Sprite;
      Color = _cc.Color;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      GameConfig = _unresolved_3.GameConfig;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "c87850S6QxIb7mVrvSb1OYG", "ChatRoomFull", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'instantiate', 'Label', 'ScrollView', 'UITransform', 'Layout', 'EditBox', 'Button', 'Sprite', 'Color']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("ChatRoomFull", ChatRoomFull = (_dec = ccclass('ChatRoomFull'), _dec2 = property({
        type: Node
      }), _dec3 = property({
        type: ScrollView
      }), _dec4 = property({
        type: Node,
        tooltip: "Message 模板节点，请手动绑定 content 下的 Message 节点"
      }), _dec5 = property({
        type: Node
      }), _dec6 = property({
        type: Node
      }), _dec7 = property({
        type: EditBox
      }), _dec8 = property({
        type: Node,
        tooltip: "字符数显示节点（Lenth），需要包含Label组件"
      }), _dec9 = property({
        type: Node
      }), _dec10 = property({
        type: Node
      }), _dec(_class = (_class2 = (_class3 = class ChatRoomFull extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "content", _descriptor, this);

          _initializerDefineProperty(this, "scrollView", _descriptor2, this);

          _initializerDefineProperty(this, "messageTemplate", _descriptor3, this);

          _initializerDefineProperty(this, "sendPanel", _descriptor4, this);

          _initializerDefineProperty(this, "sendButton", _descriptor5, this);

          _initializerDefineProperty(this, "inputBox", _descriptor6, this);

          _initializerDefineProperty(this, "lenthNode", _descriptor7, this);

          _initializerDefineProperty(this, "backButton", _descriptor8, this);

          _initializerDefineProperty(this, "speakButton", _descriptor9, this);

          this.ws = null;
          this.maxItems = 15;
          this.historyLoaded = false;
          this.annList = [];
          this.chatList = [];
          this.annLoaded = false;
          this.chatLoaded = false;
          this.lastSendAt = 0;
          this.selectedMessageNode = null;

          /**
           * 认证响应回调（关键修复：认证成功后再请求数据）
           */
          this.onAuthResponse = data => {
            if (data && data.success) {
              console.log('✅ [ChatRoomFull] 认证成功，准备请求聊天历史'); // 认证成功后，延迟一小段时间确保服务器端current_user_id已设置

              this.scheduleOnce(() => {
                if (!this.historyLoaded && this.node && this.node.active) {
                  this.requestHistory();
                }
              }, 0.1);
            }
          };
        }

        // 当前选中的消息节点
        onLoad() {
          this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          this.ensureLayout();
          this.initMessageTemplate();
          this.initInputBox();
          this.ws.on('chat_message', this.onChatMessage, this);
          this.ws.on('chat_history', this.onChatHistory, this);
          this.ws.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.ANNOUNCEMENT, this.onAnnouncement, this);
          this.ws.on('announcement_list', this.onAnnouncementList, this); // 监听认证响应，认证成功后再请求数据（关键修复）

          this.ws.on('auth_response', this.onAuthResponse, this);

          if (this.backButton) {
            this.backButton.on(Node.EventType.TOUCH_END, this.onBack, this);
          }

          if (this.speakButton) {
            this.speakButton.on(Node.EventType.TOUCH_END, this.onSpeak, this);
          }

          if (this.sendButton) {
            this.sendButton.on(Node.EventType.TOUCH_END, this.onClickSend, this);
          }

          if (this.sendPanel && this.sendPanel.active) {
            this.sendPanel.active = false;
          }

          this.updateSendButtonState();
        }

        initInputBox() {
          // 设置输入框最大长度为100
          if (this.inputBox) {
            this.inputBox.maxLength = ChatRoomFull.MAX_INPUT_LENGTH; // 监听文本变化事件，更新字符数显示

            this.inputBox.node.on(EditBox.EventType.TEXT_CHANGED, this.onInputTextChanged, this);
          } // 初始化字符数显示


          this.updateLengthDisplay();
        }
        /**
         * 递归设置节点的所有子节点为激活/非激活状态
         */


        setChildrenActive(node, active) {
          node.active = active;
          const children = node.children;

          for (let i = 0; i < children.length; i++) {
            this.setChildrenActive(children[i], active);
          }
        }

        initMessageTemplate() {
          // 如果已经手动绑定了模板节点，直接使用
          if (this.messageTemplate) {
            // 隐藏模板节点，避免在场景中显示（但保留用于克隆）
            this.messageTemplate.active = false;
            console.log('[ChatRoomFull] 使用手动绑定的 Message 模板节点');
            return;
          } // 如果没有手动绑定，尝试自动查找（兼容旧代码）


          if (!this.content) {
            console.warn('[ChatRoomFull] content 节点不存在');
            return;
          }

          const children = this.content.children;

          for (let i = 0; i < children.length; i++) {
            if (children[i].name === 'Message') {
              this.messageTemplate = children[i];

              if (this.messageTemplate) {
                this.messageTemplate.active = false;
                console.log('[ChatRoomFull] 自动找到 Message 模板节点');
              }

              break;
            }
          }

          if (!this.messageTemplate) {
            console.error('[ChatRoomFull] 未找到 Message 模板节点，请在编辑器中手动绑定 messageTemplate 属性');
          }
        }

        onDestroy() {
          if (this.ws) {
            this.ws.off('chat_message', this.onChatMessage, this);
            this.ws.off('chat_history', this.onChatHistory, this);
            this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.ANNOUNCEMENT, this.onAnnouncement, this);
            this.ws.off('announcement_list', this.onAnnouncementList, this);
            this.ws.off('auth_response', this.onAuthResponse, this);
          }

          if (this.inputBox) {
            try {
              this.inputBox.node.off(EditBox.EventType.TEXT_CHANGED, this.onInputTextChanged, this);
            } catch {}
          }

          try {
            if (this.backButton && this.backButton._eventProcessor) {
              this.backButton.off(Node.EventType.TOUCH_END, this.onBack, this);
            }
          } catch {}

          try {
            if (this.speakButton && this.speakButton._eventProcessor) {
              this.speakButton.off(Node.EventType.TOUCH_END, this.onSpeak, this);
            }
          } catch {}

          try {
            if (this.sendButton && this.sendButton._eventProcessor) {
              this.sendButton.off(Node.EventType.TOUCH_END, this.onClickSend, this);
            }
          } catch {}
        }

        onEnable() {
          // 确保模板节点被初始化
          if (!this.messageTemplate) {
            this.initMessageTemplate();
          }

          this.historyLoaded = false;
          this.annList = [];
          this.chatList = [];
          this.annLoaded = false;
          this.chatLoaded = false; // 检查是否已认证，如果已认证则立即请求；否则等待认证成功（通过onAuthResponse）
          // 这里先检查连接状态，如果已连接且已认证，立即请求

          if (this.ws.isConnected()) {
            // 延迟一小段，确保认证已完成
            this.scheduleOnce(() => {
              if (!this.historyLoaded) {
                this.requestHistory();
              }
            }, 0.2);
          }
        }

        onDisable() {
          this.historyLoaded = false;
        }

        ensureLayout() {
          if (!this.content) {
            return;
          }

          const ut = this.content.getComponent(UITransform);

          if (ut) {
            ut.anchorY = 1;
          }

          let layout = this.content.getComponent(Layout);

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

        onChatMessage(data) {
          if (!data) {
            return;
          }

          const sender = String(data.sender || '');
          const text = String(data.text || ''); // 玩家消息格式：[世]名：消息

          const line = sender ? `[世]${sender}：${text}` : `[世]系统：${text}`;
          this.addMessage(line, true);
        }

        onAnnouncement(data) {
          if (!data) {
            return;
          }

          const text = String(data.text || ''); // 系统消息格式：[世]系统：消息

          const line = `[世]系统：${text}`;
          this.addMessage(line, true);
        }

        onChatHistory(data) {
          console.log('📥 [ChatRoomFull] 收到chat_history响应:', data); // 兼容服务器返回的格式：可能是 data.messages 或 data.list 或 data.data.messages

          let list = [];

          if (data && data.data && Array.isArray(data.data.messages)) {
            list = data.data.messages;
          } else if (data && Array.isArray(data.messages)) {
            list = data.messages;
          } else if (data && Array.isArray(data.list)) {
            list = data.list;
          }

          this.chatList = list;
          this.chatLoaded = true;
          console.log(`✅ [ChatRoomFull] 聊天历史已加载，共 ${list.length} 条`);
          this.renderCombinedHistory();
        }

        onAnnouncementList(data) {
          console.log('📥 [ChatRoomFull] 收到announcement_list响应:', data); // 兼容服务器返回的格式：可能是 data.announcements 或 data.list 或 data.data.announcements

          let list = [];

          if (data && data.data && Array.isArray(data.data.announcements)) {
            list = data.data.announcements;
          } else if (data && Array.isArray(data.announcements)) {
            list = data.announcements;
          } else if (data && Array.isArray(data.list)) {
            list = data.list;
          }

          this.annList = list;
          this.annLoaded = true;
          console.log(`✅ [ChatRoomFull] 公告列表已加载，共 ${list.length} 条`);
          this.renderCombinedHistory();
        }

        /**
         * 请求历史记录（优化：使用request方法，自动生成request_id并匹配响应）
         */
        requestHistory() {
          console.log('📤 [ChatRoomFull] 发送请求: get_chat_history, get_announcements_history'); // 优化：使用request方法，自动生成request_id并匹配响应

          this.ws.request('get_chat_history', {
            limit: 8
          }, response => {
            // 通过request_id匹配的响应回调
            this.onChatHistory(response);
          }, true, // 需要认证
          10000 // 10秒超时
          );
          this.ws.request('get_announcements_history', {
            limit: 8
          }, response => {
            // 通过request_id匹配的响应回调
            this.onAnnouncementList(response);
          }, true, // 需要认证
          10000 // 10秒超时
          );
        }

        renderCombinedHistory() {
          if (this.historyLoaded) {
            return;
          }

          if (!(this.annLoaded && this.chatLoaded)) {
            return;
          }

          const ann = this.annList.map(m => ({
            created_at: m && m.created_at ? Date.parse(m.created_at) : 0,
            line: `[世]系统：${String(m && m.text || '')}`
          }));
          const chat = this.chatList.map(m => ({
            created_at: m && m.created_at ? Date.parse(m.created_at) : 0,
            // 玩家消息格式：[世]名：消息
            line: `[世]${String(m && m.sender || '')}：${String(m && m.text || '')}`
          }));
          const merged = ann.concat(chat).filter(x => x.line.trim().length > 0);

          if (merged.length === 0) {
            return;
          }

          merged.sort((a, b) => b.created_at - a.created_at);

          if (this.content) {
            // 删除所有子节点，但保留模板节点
            const children = this.content.children.slice();

            for (let i = 0; i < children.length; i++) {
              if (children[i] !== this.messageTemplate) {
                children[i].removeFromParent();
                children[i].destroy();
              }
            }
          } // 重置选中状态


          this.selectedMessageNode = null;

          for (let i = merged.length - 1; i >= 0; i--) {
            this.addMessage(merged[i].line, false);
          }

          this.historyLoaded = true;
        }

        canSend() {
          var _this$ws$getToken, _this$ws, _this$ws$hasGameIds, _this$ws2;

          if (!this.ws) {
            return false;
          }

          if (!this.ws.isConnected()) {
            return false;
          }

          const token = (_this$ws$getToken = (_this$ws = this.ws).getToken) == null ? void 0 : _this$ws$getToken.call(_this$ws);

          if (!token) {
            return false;
          }

          if (!((_this$ws$hasGameIds = (_this$ws2 = this.ws).hasGameIds) != null && _this$ws$hasGameIds.call(_this$ws2))) {
            return false;
          }

          return true;
        }

        updateSendButtonState() {
          if (!this.sendButton) {
            return;
          }

          const btn = this.sendButton.getComponent(Button);

          if (btn) {
            btn.interactable = this.canSend();
          }
        }

        addMessage(text, scrollTop) {
          if (!this.content || !this.messageTemplate) {
            console.warn('[ChatRoomFull] addMessage: content 或 messageTemplate 不存在', {
              hasContent: !!this.content,
              hasTemplate: !!this.messageTemplate
            });
            return;
          } // 临时激活模板节点以确保能正确克隆（Cocos Creator 要求源节点激活才能克隆）


          const wasActive = this.messageTemplate.active;

          if (!wasActive) {
            this.messageTemplate.active = true;
          } // 关键修复：在模板激活状态下获取 Text 节点的原始属性（位置、锚点、尺寸）


          let templateTextNode = this.messageTemplate.getChildByName('Text') || this.messageTemplate.getChildByName('text') || this.messageTemplate.getChildByName('T Text');

          if (!templateTextNode) {
            const children = this.messageTemplate.children;

            for (let i = 0; i < children.length; i++) {
              if (children[i].getComponent(Label)) {
                templateTextNode = children[i];
                break;
              }
            }
          }

          if (!templateTextNode) {
            console.error('[ChatRoomFull] 模板中未找到 Text 子节点');

            if (!wasActive) {
              this.messageTemplate.active = false;
            }

            return;
          } // 在模板激活状态下获取原始属性（关键：此时获取的位置是准确的）


          const templateTextUT = templateTextNode.getComponent(UITransform);

          if (!templateTextUT) {
            console.error('[ChatRoomFull] Text 节点没有 UITransform 组件');

            if (!wasActive) {
              this.messageTemplate.active = false;
            }

            return;
          } // 保存模板 Text 节点的所有原始属性


          const originalTextAnchorX = templateTextUT.anchorX;
          const originalTextAnchorY = templateTextUT.anchorY;
          const originalTextPos = templateTextNode.position.clone();
          const originalTextWidth = templateTextUT.width;
          const originalTextHeight = templateTextUT.height; // 克隆 Message 节点

          const messageNode = instantiate(this.messageTemplate); // 恢复模板节点的原始状态（在克隆后立即恢复）

          if (!wasActive) {
            this.messageTemplate.active = false;
          }

          if (!messageNode) {
            console.error('[ChatRoomFull] 克隆 Message 模板失败');
            return;
          } // 确保克隆的节点及其所有子节点都是激活的（先激活父节点，再递归激活子节点）


          this.setChildrenActive(messageNode, true); // 查找克隆后的 Text 节点

          let textNode = messageNode.getChildByName('Text') || messageNode.getChildByName('text') || messageNode.getChildByName('T Text'); // 如果还没找到，尝试查找所有子节点中带有 Label 组件的节点

          if (!textNode) {
            const children = messageNode.children;

            for (let i = 0; i < children.length; i++) {
              if (children[i].getComponent(Label)) {
                textNode = children[i];
                console.log(`[ChatRoomFull] 通过搜索找到 Text 节点: ${textNode.name}`);
                break;
              }
            }
          }

          if (!textNode) {
            console.error('[ChatRoomFull] 未找到 Text 子节点，Message 节点下必须有带 Label 组件的 Text 子节点');
            console.error('[ChatRoomFull] Message 节点的子节点:', messageNode.children.map(c => c.name));
            messageNode.destroy();
            return;
          }

          console.log(`[ChatRoomFull] 找到 Text 节点: ${textNode.name}`); // Text 节点本身就有 Label 组件

          const label = textNode.getComponent(Label);

          if (!label) {
            console.error('[ChatRoomFull] Text 节点没有 Label 组件');
            messageNode.destroy();
            return;
          } // 关键修复：在插入到 content 之前，完全恢复模板的原始属性


          const textUT = textNode.getComponent(UITransform);
          const contentUT = this.content.getComponent(UITransform);

          if (textUT) {
            // 1. 先恢复锚点（锚点会影响位置计算）
            textUT.anchorX = originalTextAnchorX;
            textUT.anchorY = originalTextAnchorY; // 2. 固定Y位置为-14（用户要求）

            textNode.setPosition(originalTextPos.x, -14, originalTextPos.z); // 3. 设置文本宽度以适应 content（只改变宽度，不改变位置）

            if (contentUT) {
              textUT.width = contentUT.width - 20; // 留一些边距
            } // 4. 确保高度也正确（如果模板有固定高度）


            if (originalTextHeight > 0) {
              textUT.height = originalTextHeight;
            }
          } // messageNode 和子节点已经在上面通过 setChildrenActive 设置为激活了
          // 判断是否是系统消息（格式：[世]系统：消息）


          const isSystemMessage = text.startsWith('[世]系统：'); // 设置文本颜色：系统消息红色，玩家消息白色

          if (isSystemMessage) {
            label.color = new Color(255, 0, 0, 255); // 红色
          } else {
            label.color = new Color(255, 255, 255, 255); // 白色
          } // 设置文本内容


          label.string = text;
          label.overflow = Label.Overflow.RESIZE_HEIGHT;
          label.enableWrapText = true;
          label.verticalAlign = Label.VerticalAlign.TOP;
          console.log(`[ChatRoomFull] 准备添加消息: ${text.substring(0, 20)}...`); // 关键修复：根据最佳实践，在插入到 content 之前暂时禁用 Layout 组件
          // 这样可以防止 Layout 在插入节点时自动调整子节点位置

          const layout = this.content.getComponent(Layout);
          const layoutWasEnabled = layout ? layout.enabled : false;

          if (layout) {
            layout.enabled = false; // 暂时禁用 Layout
          } // 插入到 content 的第一个位置（排除模板节点）


          this.content.insertChild(messageNode, 0);
          console.log(`[ChatRoomFull] 消息节点已插入，content 子节点数: ${this.content.children.length}`); // 初始化消息项的图片显示状态：默认隐藏图片（未选中状态）

          this.setMessageImageVisible(messageNode, false); // 为消息项添加点击事件，实现选中功能

          this.setupMessageClickHandler(messageNode); // 关键修复：在 Layout 禁用状态下，确保 Text 节点的位置完全正确
          // 固定Y位置为-14（用户要求）

          if (textUT) {
            // 完全恢复模板的原始属性（位置、锚点、尺寸）
            textUT.anchorX = originalTextAnchorX;
            textUT.anchorY = originalTextAnchorY;
            textNode.setPosition(originalTextPos.x, -14, originalTextPos.z); // 确保 Message 节点的锚点不会影响子节点位置

            const messageUT = messageNode.getComponent(UITransform);

            if (messageUT) {
              // Message 节点的锚点应该与模板一致
              const templateMessageUT = this.messageTemplate.getComponent(UITransform);

              if (templateMessageUT) {
                messageUT.anchorX = templateMessageUT.anchorX;
                messageUT.anchorY = templateMessageUT.anchorY;
              }
            }
          } // 恢复 Layout 组件并更新布局（Layout 只影响 Message 节点的位置，不影响内部子节点）


          if (layout && layoutWasEnabled) {
            layout.enabled = true;
            layout.updateLayout();
          } // 关键修复：Layout 更新后，再次确保 Text 节点的位置正确
          // 固定Y位置为-14（用户要求）


          if (textUT) {
            textNode.setPosition(originalTextPos.x, -14, originalTextPos.z);
            textUT.anchorX = originalTextAnchorX;
            textUT.anchorY = originalTextAnchorY;
          } // 等待一帧让 Label 渲染完成，然后调整 Message 节点高度


          this.scheduleOnce(() => {
            if (!label.isValid || !messageNode.isValid || !textNode.isValid) {
              console.warn('[ChatRoomFull] 节点已失效，跳过高度调整');
              return;
            }

            const labelUT = textNode.getComponent(UITransform);
            const messageUT = messageNode.getComponent(UITransform);

            if (labelUT && messageUT) {
              // 关键修复：根据最佳实践，在调整高度前暂时禁用 Layout
              const layoutWasEnabled = layout ? layout.enabled : false;

              if (layout) {
                layout.enabled = false;
              } // 保存 Text 节点的原始属性（使用模板的原始值，确保完全一致）


              const textLocalPos = originalTextPos.clone();
              const textAnchorX = originalTextAnchorX;
              const textAnchorY = originalTextAnchorY; // 获取文本的实际高度

              const textHeight = labelUT.height; // Message 高度 = Text 高度 

              const messageHeight = textHeight; // 调整Message高度（这可能会影响子节点的位置计算）

              messageUT.height = messageHeight; // 关键修复：完全恢复 Text 节点的原始属性（位置、锚点）
              // 固定Y位置为-14（用户要求）

              labelUT.anchorX = textAnchorX;
              labelUT.anchorY = textAnchorY;
              textNode.setPosition(textLocalPos.x, -14, textLocalPos.z);
              console.log(`[ChatRoomFull] 调整 Message 高度: 文本高度=${textHeight}, Message高度=${messageHeight}, Text位置=(${textLocalPos.x}, -14)`); // 恢复 Layout 并更新布局

              if (layout && layoutWasEnabled) {
                layout.enabled = true;
                layout.updateLayout();
              } // 关键修复：Layout 更新后，最后一次确保 Text 节点位置正确
              // 固定Y位置为-14（用户要求）


              textNode.setPosition(textLocalPos.x, -14, textLocalPos.z);
              labelUT.anchorX = textAnchorX;
              labelUT.anchorY = textAnchorY;
            } // 滚动到顶部


            if (this.scrollView && scrollTop) {
              this.scrollView.scrollToTop(0.2, true);
            }
          }, 0); // 限制消息数量（排除模板节点）

          const allChildren = this.content.children;
          let messageCount = 0;

          for (let i = 0; i < allChildren.length; i++) {
            if (allChildren[i] !== this.messageTemplate) {
              messageCount++;
            }
          }

          if (messageCount > this.maxItems) {
            // 找到最后一个非模板节点
            for (let i = allChildren.length - 1; i >= 0; i--) {
              const child = allChildren[i];

              if (child !== this.messageTemplate) {
                try {
                  if (child && child.isValid && !child.__scheduledDestroy) {
                    child.removeFromParent();
                    child.__scheduledDestroy = true;
                    child.destroy();
                  }
                } catch {}

                break;
              }
            }
          }
        }

        onBack() {
          if (this.sendPanel && this.sendPanel.active) {
            this.sendPanel.active = false;
            return;
          }

          this.node.active = false;
        }

        onSpeak() {
          if (this.sendPanel) {
            if (this.sendPanel.active) {
              return;
            }

            this.sendPanel.active = true;
          }
        }

        onInputTextChanged() {
          this.updateLengthDisplay();
        }

        updateLengthDisplay() {
          if (!this.lenthNode) {
            return;
          } // 获取当前输入文本的长度


          const currentLength = this.inputBox ? this.inputBox.string.length : 0; // 查找Lenth节点下的Label组件

          let label = this.lenthNode.getComponent(Label);

          if (!label) {
            // 如果没有直接挂载Label，尝试查找子节点
            const textNode = this.lenthNode.getChildByName('Text') || this.lenthNode.getChildByName('text');
            label = textNode ? textNode.getComponent(Label) : null;
          }

          if (label) {
            label.string = `${currentLength}/${ChatRoomFull.MAX_INPUT_LENGTH}`;
          }
        }

        onClickSend() {
          var _this$ws$getCharacter, _this$ws3;

          if (!this.canSend()) {
            return;
          }

          const now = Date.now();

          if (now - this.lastSendAt < ChatRoomFull.SEND_INTERVAL_MS) {
            return;
          }

          const text = this.inputBox ? String(this.inputBox.string || '').trim() : '';

          if (!text) {
            return;
          }

          const cid = ((_this$ws$getCharacter = (_this$ws3 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter.call(_this$ws3)) || undefined; // 优化：使用request方法，自动生成request_id并匹配响应

          this.ws.request('post_chat', {
            text: text,
            character_id: cid
          }, response => {
            // 通过request_id匹配的响应回调
            if (!response || !response.success) {
              const errorMsg = (response == null ? void 0 : response.error) || (response == null ? void 0 : response.message) || '发送失败';
              console.error(`❌ [ChatRoomFull] 发送聊天消息失败: ${errorMsg}`);
            } else {
              console.log('✅ [ChatRoomFull] 聊天消息发送成功');
            }
          }, true, // 需要认证
          10000 // 10秒超时
          );
          this.lastSendAt = now;

          if (this.inputBox) {
            this.inputBox.string = '';
          }

          this.updateLengthDisplay(); // 发送后更新字符数显示

          if (this.sendPanel) {
            this.sendPanel.active = false;
          }
        }
        /**
         * 设置消息项的图片显示/隐藏
         * @param messageNode 消息节点
         * @param visible 是否显示图片
         */


        setMessageImageVisible(messageNode, visible) {
          if (!messageNode || !messageNode.isValid) {
            return;
          } // 查找消息节点上的 Sprite 组件（Message 节点本身应该有 Sprite 组件）


          const sprite = messageNode.getComponent(Sprite);

          if (sprite) {
            sprite.enabled = visible;
          }
        }
        /**
         * 为消息项设置点击事件处理
         * @param messageNode 消息节点
         */


        setupMessageClickHandler(messageNode) {
          if (!messageNode || !messageNode.isValid) {
            return;
          } // 使用 Button 组件来处理点击事件（Message 节点应该有 Button 组件）


          const button = messageNode.getComponent(Button);

          if (button) {
            button.node.on(Button.EventType.CLICK, () => {
              this.onMessageClick(messageNode);
            }, this);
          } else {
            // 如果没有 Button 组件，使用触摸事件
            messageNode.on(Node.EventType.TOUCH_END, () => {
              this.onMessageClick(messageNode);
            }, this);
          }
        }
        /**
         * 处理消息项点击事件
         * @param clickedNode 被点击的消息节点
         */


        onMessageClick(clickedNode) {
          if (!this.content || !clickedNode || !clickedNode.isValid) {
            return;
          } // 如果点击的是当前选中的节点，取消选中


          if (this.selectedMessageNode === clickedNode) {
            this.setMessageImageVisible(clickedNode, false);
            this.selectedMessageNode = null;
            return;
          } // 隐藏所有消息项的图片


          const children = this.content.children;

          for (let i = 0; i < children.length; i++) {
            const child = children[i]; // 排除模板节点

            if (child !== this.messageTemplate && child.isValid) {
              this.setMessageImageVisible(child, false);
            }
          } // 显示当前选中消息项的图片


          this.setMessageImageVisible(clickedNode, true);
          this.selectedMessageNode = clickedNode;
        }

      }, _class3.SEND_INTERVAL_MS = 800, _class3.MAX_INPUT_LENGTH = 100, _class3), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "content", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "scrollView", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "messageTemplate", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "sendPanel", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "sendButton", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "inputBox", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "lenthNode", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "backButton", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "speakButton", [_dec10], {
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
//# sourceMappingURL=5e40ff67f1612e89f29dd9d1a7eec42ede258401.js.map