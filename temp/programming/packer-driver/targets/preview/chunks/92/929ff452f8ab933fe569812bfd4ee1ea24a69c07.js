System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Label, Sprite, Color, Button, SpriteFrame, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _crd, ccclass, property, FriendItemMode, FriendItem;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      Node = _cc.Node;
      Label = _cc.Label;
      Sprite = _cc.Sprite;
      Color = _cc.Color;
      Button = _cc.Button;
      SpriteFrame = _cc.SpriteFrame;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "0af5anVUQVDCbwIUXk8OlHj", "FriendItem", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Label', 'Sprite', 'Color', 'Button', 'SpriteFrame']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("FriendItemMode", FriendItemMode = /*#__PURE__*/function (FriendItemMode) {
        FriendItemMode[FriendItemMode["FRIEND"] = 0] = "FRIEND";
        FriendItemMode[FriendItemMode["REQUEST"] = 1] = "REQUEST";
        FriendItemMode[FriendItemMode["SEARCH_RESULT"] = 2] = "SEARCH_RESULT";
        return FriendItemMode;
      }({}));

      _export("FriendItem", FriendItem = (_dec = ccclass('FriendItem'), _dec2 = property(Sprite), _dec3 = property([SpriteFrame]), _dec4 = property(Label), _dec5 = property(Label), _dec6 = property(Node), _dec7 = property(Node), _dec8 = property(Label), _dec9 = property(Label), _dec10 = property(Button), _dec11 = property(Button), _dec(_class = (_class2 = class FriendItem extends Component {
        constructor() {
          super(...arguments);

          // ====== 基础 UI 引用 ======
          _initializerDefineProperty(this, "avatarSprite", _descriptor, this);

          _initializerDefineProperty(this, "avatarFrames", _descriptor2, this);

          _initializerDefineProperty(this, "nameLabel", _descriptor3, this);

          _initializerDefineProperty(this, "statusLabel", _descriptor4, this);

          _initializerDefineProperty(this, "setButton", _descriptor5, this);

          // `Set` 按钮本体
          _initializerDefineProperty(this, "setPanelBG", _descriptor6, this);

          // `Set/BG` 面板（包含两个按钮）
          _initializerDefineProperty(this, "leftActionLabel", _descriptor7, this);

          // `Character` / `同意` / `查看`
          _initializerDefineProperty(this, "rightActionLabel", _descriptor8, this);

          // `Delete` / `拒绝` / `添加好友`
          _initializerDefineProperty(this, "leftActionButton", _descriptor9, this);

          _initializerDefineProperty(this, "rightActionButton", _descriptor10, this);

          // ====== 颜色配置 ======

          /** 离线颜色 A5A5A5 */
          this.offlineColor = new Color(0xA5, 0xA5, 0xA5, 0xFF);

          /** 在线颜色 50FFD5 */
          this.onlineColor = new Color(0x50, 0xFF, 0xD5, 0xFF);
          // ====== 数据 ======
          this.characterId = '';
          // 服务器角色ID
          this.friendId = '';
          // 好友六位ID
          this.spriteIndex = 0;
          // Sprite 数值（服务器返回从 1 开始：1、2、3...）
          this.roleName = '';
          // 角色名
          this.isOnline = false;
          this.mode = FriendItemMode.FRIEND;
          // 由 FriendPanel 在实例化后注入的回调（保持客户端只做显示 / 发送请求）
          this.onOpenSetPanel = null;
          this.onLeftAction = null;
          this.onRightAction = null;
        }

        onLoad() {
          if (this.setButton) {
            this.setButton.on(Node.EventType.TOUCH_END, this.handleSetClick, this);
          }

          if (this.leftActionButton) {
            this.leftActionButton.node.on(Node.EventType.TOUCH_END, this.handleLeftActionClick, this);
          }

          if (this.rightActionButton) {
            this.rightActionButton.node.on(Node.EventType.TOUCH_END, this.handleRightActionClick, this);
          }

          if (this.setPanelBG) {
            this.setPanelBG.active = false;
          }
        }

        init(opts, callbacks) {
          if (callbacks === void 0) {
            callbacks = {};
          }

          this.characterId = opts.characterId;
          this.friendId = opts.friendId;
          this.spriteIndex = opts.spriteIndex;
          this.roleName = opts.roleName;
          this.isOnline = opts.isOnline;
          this.mode = opts.mode;
          this.onOpenSetPanel = callbacks.onOpenSetPanel || null;
          this.onLeftAction = callbacks.onLeftAction || null;
          this.onRightAction = callbacks.onRightAction || null;
          this.refreshView();
        }
        /** 根据当前数据刷新 UI（头像 / 名字 / 状态 / 按钮文字） */


        refreshView() {
          if (this.nameLabel) {
            this.nameLabel.string = this.roleName || '';
          }

          if (this.statusLabel) {
            this.statusLabel.string = this.isOnline ? '在线' : '离线';
            this.statusLabel.color = this.isOnline ? this.onlineColor : this.offlineColor;
          }

          this.refreshAvatar();
          this.refreshButtons();
        }
        /** 根据 Sprite 数值设置头像（服务器返回的 Sprite 值从 1 开始，需要减 1 转换为数组索引） */


        refreshAvatar() {
          if (!this.avatarSprite || !this.avatarFrames.length) {
            return;
          } // 服务器返回的 Sprite 值从 1 开始（1, 2, 3...），数组索引从 0 开始（0, 1, 2...），需要减 1


          var idx = Math.max(0, Math.min(this.spriteIndex - 1, this.avatarFrames.length - 1));

          if (idx >= 0 && idx < this.avatarFrames.length && this.avatarFrames[idx]) {
            this.avatarSprite.spriteFrame = this.avatarFrames[idx];
          }
        }
        /** 刷新 Set 面板两个按钮的文案（根据不同模式切换） */


        refreshButtons() {
          if (!this.leftActionLabel || !this.rightActionLabel) {
            return;
          }

          switch (this.mode) {
            case FriendItemMode.FRIEND:
              this.leftActionLabel.string = '角色';
              this.rightActionLabel.string = '删除';
              break;

            case FriendItemMode.REQUEST:
              this.leftActionLabel.string = '同意';
              this.rightActionLabel.string = '拒绝';
              break;

            case FriendItemMode.SEARCH_RESULT:
              this.leftActionLabel.string = '查看';
              this.rightActionLabel.string = '添加好友';
              break;
          }
        }

        handleSetClick() {
          if (this.setPanelBG) {
            this.setPanelBG.active = true;
          }

          if (this.onOpenSetPanel) {
            this.onOpenSetPanel(this);
          }
        }

        handleLeftActionClick() {
          if (this.onLeftAction) {
            this.onLeftAction(this);
          }
        }

        handleRightActionClick() {
          if (this.onRightAction) {
            this.onRightAction(this);
          }
        }
        /** 关闭 Set 面板（由 FriendPanel 和 BackControl 调用） */


        closeSetPanel() {
          if (this.setPanelBG) {
            this.setPanelBG.active = false;
          }
        }
        /** 检查 Set 面板是否打开 */


        isSetPanelOpen() {
          return this.setPanelBG ? this.setPanelBG.active : false;
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "avatarSprite", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "avatarFrames", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "nameLabel", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "statusLabel", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "setButton", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "setPanelBG", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "leftActionLabel", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "rightActionLabel", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "leftActionButton", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "rightActionButton", [_dec11], {
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
//# sourceMappingURL=929ff452f8ab933fe569812bfd4ee1ea24a69c07.js.map