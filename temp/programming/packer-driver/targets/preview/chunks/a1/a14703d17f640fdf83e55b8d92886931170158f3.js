System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Label, Button, Sprite, UITransform, Layout, Vec3, v2, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _crd, ccclass, property, executeInEditMode, StoryUIAutoBuilder;

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
      Button = _cc.Button;
      Sprite = _cc.Sprite;
      UITransform = _cc.UITransform;
      Layout = _cc.Layout;
      Vec3 = _cc.Vec3;
      v2 = _cc.v2;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "5265bFa5mBKeL7qqwlMYh33", "StoryUIAutoBuilder", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Label', 'Button', 'Sprite', 'UITransform', 'Layout', 'Vec3', 'v2']);

      ({
        ccclass,
        property,
        executeInEditMode
      } = _decorator);

      _export("StoryUIAutoBuilder", StoryUIAutoBuilder = (_dec = ccclass('StoryUIAutoBuilder'), _dec2 = executeInEditMode(true), _dec3 = property({
        tooltip: '编辑器/运行时自动创建与重排 UI'
      }), _dec4 = property({
        tooltip: '重建 StoryLayer/HUDLayer/OverlayLayer（会清空这三层）'
      }), _dec5 = property({
        tooltip: 'GameArea 视口宽度'
      }), _dec6 = property({
        tooltip: 'GameArea 视口高度'
      }), _dec(_class = _dec2(_class = (_class2 = class StoryUIAutoBuilder extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "autoBuildOnStart", _descriptor, this);

          _initializerDefineProperty(this, "rebuildIfExists", _descriptor2, this);

          _initializerDefineProperty(this, "viewWidth", _descriptor3, this);

          _initializerDefineProperty(this, "viewHeight", _descriptor4, this);

          this._built = false;
        }

        start() {
          if (this._built || !this.autoBuildOnStart) return;
          this._built = true;
          this.build();
        }

        build() {
          var root = this.node;
          this.ensureUITransform(root, this.viewWidth, this.viewHeight, 0.5, 0.5);

          if (this.rebuildIfExists) {
            ['StoryLayer', 'HUDLayer', 'OverlayLayer'].forEach(n => {
              var old = root.getChildByName(n);
              if (old) old.destroy();
            });
          }

          var storyLayer = this.getOrCreateChild(root, 'StoryLayer');
          var hudLayer = this.getOrCreateChild(root, 'HUDLayer');
          var overlayLayer = this.getOrCreateChild(root, 'OverlayLayer');
          this.ensureUITransform(storyLayer, this.viewWidth, this.viewHeight, 0.5, 0.5);
          this.ensureUITransform(hudLayer, this.viewWidth, this.viewHeight, 0.5, 0.5);
          this.ensureUITransform(overlayLayer, this.viewWidth, this.viewHeight, 0.5, 0.5);
          this.layoutStoryLayer(storyLayer);
          this.layoutHUDLayer(hudLayer);
          this.layoutOverlayLayer(overlayLayer);
        }

        layoutStoryLayer(storyLayer) {
          var _options$getComponent;

          var halfW = this.viewWidth / 2;
          var halfH = this.viewHeight / 2;
          var dialogue = this.getOrCreateChild(storyLayer, 'DialoguePanel');
          this.ensureUITransform(dialogue, this.viewWidth - 16, 188, 0.5, 0.5);
          dialogue.setPosition(new Vec3(0, -halfH + 100, 0));
          dialogue.active = false;
          var speaker = this.getOrCreateChild(dialogue, 'SpeakerNameLabel');
          this.ensureUITransform(speaker, 170, 34, 0, 1);
          speaker.setPosition(new Vec3(-halfW + 14, 82, 0));
          this.ensureLabel(speaker, 24, Label.HorizontalAlign.LEFT, Label.VerticalAlign.CENTER, '说话人');
          var portrait = this.getOrCreateChild(dialogue, 'PortraitSlot');
          this.ensureUITransform(portrait, 92, 92, 0, 0.5);
          portrait.setPosition(new Vec3(-halfW + 16, -4, 0));
          this.ensureSprite(portrait);
          portrait.active = false;
          var linesContainer = this.getOrCreateChild(dialogue, 'LinesContainer');
          this.ensureUITransform(linesContainer, this.viewWidth - 148, 110, 0, 0.5);
          linesContainer.setPosition(new Vec3(-halfW + 118, 0, 0));
          var lineTextNode = this.getOrCreateChild(linesContainer, 'Text');
          this.ensureUITransform(lineTextNode, this.viewWidth - 160, 110, 0, 1);
          lineTextNode.setPosition(new Vec3(0, 52, 0));
          var linesLabel = this.ensureLabel(lineTextNode, 22, Label.HorizontalAlign.LEFT, Label.VerticalAlign.TOP, '');
          linesLabel.overflow = Label.Overflow.CLAMP;
          var nextBtn = this.getOrCreateChild(dialogue, 'NextBtn');
          this.ensureUITransform(nextBtn, 138, 42, 1, 0);
          nextBtn.setPosition(new Vec3(halfW - 12, -halfH + 18, 0));
          this.ensureButton(nextBtn);
          var nextText = this.getOrCreateChild(nextBtn, 'Text');
          this.ensureUITransform(nextText, 138, 42, 0.5, 0.5);
          nextText.setPosition(new Vec3(0, 0, 0));
          this.ensureLabel(nextText, 20, Label.HorizontalAlign.CENTER, Label.VerticalAlign.CENTER, '下一句');
          var closeBtn = this.getOrCreateChild(dialogue, 'CloseBtn');
          this.ensureUITransform(closeBtn, 110, 40, 0, 0);
          closeBtn.setPosition(new Vec3(-halfW + 12, -halfH + 18, 0));
          this.ensureButton(closeBtn);
          var closeText = this.getOrCreateChild(closeBtn, 'Text');
          this.ensureUITransform(closeText, 110, 40, 0.5, 0.5);
          closeText.setPosition(new Vec3(0, 0, 0));
          this.ensureLabel(closeText, 20, Label.HorizontalAlign.CENTER, Label.VerticalAlign.CENTER, '关闭');
          closeBtn.active = false;
          var choice = this.getOrCreateChild(storyLayer, 'ChoiceModal');
          this.ensureUITransform(choice, this.viewWidth - 30, 290, 0.5, 0.5);
          choice.setPosition(new Vec3(0, 10, 0));
          choice.active = false;
          var title = this.getOrCreateChild(choice, 'TitleLabel');
          this.ensureUITransform(title, this.viewWidth - 60, 36, 0.5, 1);
          title.setPosition(new Vec3(0, 132, 0));
          this.ensureLabel(title, 26, Label.HorizontalAlign.CENTER, Label.VerticalAlign.CENTER, '请选择');
          var options = this.getOrCreateChild(choice, 'OptionsContainer');
          this.ensureUITransform(options, this.viewWidth - 80, 158, 0.5, 0.5);
          options.setPosition(new Vec3(0, 18, 0));
          var layout = (_options$getComponent = options.getComponent(Layout)) != null ? _options$getComponent : options.addComponent(Layout);
          layout.type = Layout.Type.VERTICAL;
          layout.verticalDirection = Layout.VerticalDirection.TOP_TO_BOTTOM;
          layout.resizeMode = Layout.ResizeMode.CONTAINER;
          layout.spacingY = 12;
          layout.paddingTop = 2;
          layout.paddingBottom = 2;
          this.layoutOption(options, 'OptionButton_0', '选项A');
          this.layoutOption(options, 'OptionButton_1', '选项B');
          var replyArea = this.getOrCreateChild(choice, 'SubReplyArea');
          this.ensureUITransform(replyArea, this.viewWidth - 80, 62, 0.5, 0);
          replyArea.setPosition(new Vec3(0, -136, 0));
          replyArea.active = false;
          var replyText = this.getOrCreateChild(replyArea, 'Text');
          this.ensureUITransform(replyText, this.viewWidth - 80, 62, 0, 1);
          replyText.setPosition(new Vec3(-(this.viewWidth - 80) / 2, 30, 0));
          this.ensureLabel(replyText, 20, Label.HorizontalAlign.LEFT, Label.VerticalAlign.TOP, '');
          var tipLayer = this.getOrCreateChild(storyLayer, 'SystemTipLayer');
          this.ensureUITransform(tipLayer, this.viewWidth, this.viewHeight, 0.5, 0.5);
          var toast = this.getOrCreateChild(tipLayer, 'ToastItem');
          this.ensureUITransform(toast, this.viewWidth - 60, 46, 0.5, 0);
          toast.setPosition(new Vec3(0, -halfH + 12, 0));
          this.ensureSprite(toast);
          var toastText = this.getOrCreateChild(toast, 'Text');
          this.ensureUITransform(toastText, this.viewWidth - 70, 40, 0.5, 0.5);
          toastText.setPosition(new Vec3(0, 23, 0));
          this.ensureLabel(toastText, 20, Label.HorizontalAlign.CENTER, Label.VerticalAlign.CENTER, '');
          toast.active = false;
          var taskBar = this.getOrCreateChild(storyLayer, 'TaskHintBar');
          this.ensureUITransform(taskBar, this.viewWidth - 24, 34, 0.5, 1);
          taskBar.setPosition(new Vec3(0, halfH - 10, 0));
          var taskText = this.getOrCreateChild(taskBar, 'TaskHintText');
          this.ensureUITransform(taskText, this.viewWidth - 36, 30, 0, 0.5);
          taskText.setPosition(new Vec3(-(this.viewWidth - 36) / 2, 0, 0));
          this.ensureLabel(taskText, 19, Label.HorizontalAlign.LEFT, Label.VerticalAlign.CENTER, '');
        }

        layoutHUDLayer(hudLayer) {
          var prompt = this.getOrCreateChild(hudLayer, 'InteractPrompt');
          this.ensureUITransform(prompt, this.viewWidth - 80, 38, 0.5, 0);
          prompt.setPosition(new Vec3(0, -this.viewHeight / 2 + 64, 0));
          var promptText = this.getOrCreateChild(prompt, 'PromptText');
          this.ensureUITransform(promptText, this.viewWidth - 96, 34, 0.5, 0.5);
          promptText.setPosition(new Vec3(0, 19, 0));
          this.ensureLabel(promptText, 19, Label.HorizontalAlign.CENTER, Label.VerticalAlign.CENTER, '按 E 对话');
          prompt.active = false;
        }

        layoutOverlayLayer(overlayLayer) {
          var loading = this.getOrCreateChild(overlayLayer, 'LoadingOverlay');
          this.ensureUITransform(loading, this.viewWidth, this.viewHeight, 0.5, 0.5);
          loading.setPosition(new Vec3(0, 0, 0));
          this.ensureSprite(loading);
          var text = this.getOrCreateChild(loading, 'Text');
          this.ensureUITransform(text, this.viewWidth, 36, 0.5, 0.5);
          text.setPosition(new Vec3(0, 0, 0));
          this.ensureLabel(text, 26, Label.HorizontalAlign.CENTER, Label.VerticalAlign.CENTER, '加载中...');
          loading.active = false;
        }

        layoutOption(parent, name, title) {
          var btnNode = this.getOrCreateChild(parent, name);
          this.ensureUITransform(btnNode, this.viewWidth - 80, 48, 0.5, 0.5);
          this.ensureButton(btnNode);
          var textNode = this.getOrCreateChild(btnNode, 'Text');
          this.ensureUITransform(textNode, this.viewWidth - 96, 42, 0.5, 0.5);
          textNode.setPosition(new Vec3(0, 0, 0));
          this.ensureLabel(textNode, 21, Label.HorizontalAlign.CENTER, Label.VerticalAlign.CENTER, title);
        }

        getOrCreateChild(parent, name) {
          var existed = parent.getChildByName(name);
          if (existed) return existed;
          var node = new Node(name);
          parent.addChild(node);
          return node;
        }

        ensureUITransform(node, width, height, ax, ay) {
          var _node$getComponent;

          var ut = (_node$getComponent = node.getComponent(UITransform)) != null ? _node$getComponent : node.addComponent(UITransform);
          ut.setContentSize(width, height);
          ut.setAnchorPoint(v2(ax, ay));
          return ut;
        }

        ensureLabel(node, fontSize, hAlign, vAlign, text) {
          var _node$getComponent2;

          var label = (_node$getComponent2 = node.getComponent(Label)) != null ? _node$getComponent2 : node.addComponent(Label);
          label.fontSize = fontSize;
          label.horizontalAlign = hAlign;
          label.verticalAlign = vAlign;
          label.string = text;
          return label;
        }

        ensureButton(node) {
          var _node$getComponent3;

          return (_node$getComponent3 = node.getComponent(Button)) != null ? _node$getComponent3 : node.addComponent(Button);
        }

        ensureSprite(node) {
          var _node$getComponent4;

          return (_node$getComponent4 = node.getComponent(Sprite)) != null ? _node$getComponent4 : node.addComponent(Sprite);
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "autoBuildOnStart", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "rebuildIfExists", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return false;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "viewWidth", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 480;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "viewHeight", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 540;
        }
      })), _class2)) || _class) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=a14703d17f640fdf83e55b8d92886931170158f3.js.map