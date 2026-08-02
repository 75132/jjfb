System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4", "__unresolved_5"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Input, JsonAsset, KeyCode, Node, input, PlayerGridMove, MapNpcInteract, StoryLocalTaskState, StoryMapModel, StoryUIViewController, _dec, _dec2, _dec3, _dec4, _dec5, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _crd, ccclass, property, StoryWorldInteract;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfPlayerGridMove(extras) {
    _reporterNs.report("PlayerGridMove", "./GameArea/PlayerGridMove", _context.meta, extras);
  }

  function _reportPossibleCrUseOfMapNpcInteract(extras) {
    _reporterNs.report("MapNpcInteract", "./MapNpcInteract", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryLocalTaskState(extras) {
    _reporterNs.report("StoryLocalTaskState", "./StoryLocalTaskState", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryMapModel(extras) {
    _reporterNs.report("StoryMapModel", "./StoryMapModel", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryNpcEvent(extras) {
    _reporterNs.report("StoryNpcEvent", "./StoryMapTypes", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryUIViewController(extras) {
    _reporterNs.report("StoryUIViewController", "./StoryUIViewController", _context.meta, extras);
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
      Input = _cc.Input;
      JsonAsset = _cc.JsonAsset;
      KeyCode = _cc.KeyCode;
      Node = _cc.Node;
      input = _cc.input;
    }, function (_unresolved_2) {
      PlayerGridMove = _unresolved_2.PlayerGridMove;
    }, function (_unresolved_3) {
      MapNpcInteract = _unresolved_3.MapNpcInteract;
    }, function (_unresolved_4) {
      StoryLocalTaskState = _unresolved_4.StoryLocalTaskState;
    }, function (_unresolved_5) {
      StoryMapModel = _unresolved_5.StoryMapModel;
    }, function (_unresolved_6) {
      StoryUIViewController = _unresolved_6.StoryUIViewController;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "b7905pij8eTXsBiwI8OXGR0", "StoryWorldInteract", undefined);

      __checkObsolete__(['_decorator', 'Component', 'EventKeyboard', 'Input', 'JsonAsset', 'KeyCode', 'Node', 'input']);

      ({
        ccclass,
        property
      } = _decorator);
      /**
       * 大世界剧情交互（客户端 MVP）
       *
       * 自动挂载：GameArea 上的 WorldOnlineSync 会在启动后调用 StoryWorldInteract.ensureOn(gameArea)，
       * 为本节点添加本组件、注入 map Json（取首个 MapNpcInteract）、并在 CanvasRoot(UI) 上确保 StoryUIViewController。
       *
       * 手动绑定（若关闭自动逻辑）：将本组件挂在 GameArea，指定 mapConfig、playerNode、Canvas 上的 StoryUIViewController。
       */

      _export("StoryWorldInteract", StoryWorldInteract = (_dec = ccclass('StoryWorldInteract'), _dec2 = property({
        type: JsonAsset,
        tooltip: '默认可留空，ensureOn 会从子节点 MapNpcInteract 拷贝'
      }), _dec3 = property({
        type: Node,
        tooltip: '默认可留空，将尝试 WorldOnlineSync.localPlayerMove 或 WorldRoot 下 PlayerGridMove'
      }), _dec4 = property({
        type: _crd && StoryUIViewController === void 0 ? (_reportPossibleCrUseOfStoryUIViewController({
          error: Error()
        }), StoryUIViewController) : StoryUIViewController,
        tooltip: '默认可留空，自动使用 CanvasRoot(UI) 上组件'
      }), _dec5 = property({
        tooltip: '将任务与已完成事件写入 localStorage（键含 mapCode）'
      }), _dec(_class = (_class2 = class StoryWorldInteract extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "mapConfig", _descriptor, this);

          _initializerDefineProperty(this, "playerNode", _descriptor2, this);

          _initializerDefineProperty(this, "ui", _descriptor3, this);

          _initializerDefineProperty(this, "persistProgress", _descriptor4, this);

          this._model = null;
          this._taskState = null;
          this._nearest = null;
        }

        /**
         * 由 WorldOnlineSync 延迟调用：确保 GameArea 上存在剧情交互与 UI 控制器。
         */
        static ensureOn(gameArea) {
          if (!(gameArea != null && gameArea.isValid)) return null;
          var story = gameArea.getComponent(StoryWorldInteract);
          if (!story) story = gameArea.addComponent(StoryWorldInteract);
          var npc = gameArea.getComponentInChildren(_crd && MapNpcInteract === void 0 ? (_reportPossibleCrUseOfMapNpcInteract({
            error: Error()
          }), MapNpcInteract) : MapNpcInteract);

          if (npc != null && npc.mapConfig && !story.mapConfig) {
            story.mapConfig = npc.mapConfig;
          }

          var canvasRoot = gameArea.getChildByName('CanvasRoot(UI)');

          if (canvasRoot != null && canvasRoot.isValid) {
            var ui = canvasRoot.getComponent(_crd && StoryUIViewController === void 0 ? (_reportPossibleCrUseOfStoryUIViewController({
              error: Error()
            }), StoryUIViewController) : StoryUIViewController);
            if (!ui) ui = canvasRoot.addComponent(_crd && StoryUIViewController === void 0 ? (_reportPossibleCrUseOfStoryUIViewController({
              error: Error()
            }), StoryUIViewController) : StoryUIViewController);
            if (!story.ui) story.ui = ui;
          }

          return story;
        }

        onLoad() {
          this._rebuildModel();
        }

        start() {
          if (!this.mapConfig) {
            var npc = this.node.getComponentInChildren(_crd && MapNpcInteract === void 0 ? (_reportPossibleCrUseOfMapNpcInteract({
              error: Error()
            }), MapNpcInteract) : MapNpcInteract);
            if (npc != null && npc.mapConfig) this.mapConfig = npc.mapConfig;
          }

          this._rebuildModel();
        }

        onEnable() {
          input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        }

        onDisable() {
          input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        }

        update() {
          if (!this._model || !this._taskState || !this.ui) {
            this._rebuildModel();
          }

          var ui = this.ui;
          if (!ui || !this._model || !this._taskState) return;
          ui.ensureRefs();

          if (ui.isBlockingInput()) {
            ui.showInteractPrompt(false);
            this._nearest = null;
            return;
          }

          var player = this._resolvePlayerNode();

          if (!(player != null && player.isValid)) {
            ui.showInteractPrompt(false);
            return;
          }

          var npcs = this.node.getComponentsInChildren(_crd && MapNpcInteract === void 0 ? (_reportPossibleCrUseOfMapNpcInteract({
            error: Error()
          }), MapNpcInteract) : MapNpcInteract);
          var best = null;
          var bestD = this._model.maxInteractDistance + 1;
          var pw = player.worldPosition;

          for (var i = 0; i < npcs.length; i++) {
            var _c$interactAnchor;

            var c = npcs[i];
            if (!(c != null && c.npcUid)) continue;
            var anchor = (_c$interactAnchor = c.interactAnchor) != null && _c$interactAnchor.isValid ? c.interactAnchor : c.node;
            var aw = anchor.worldPosition;
            var dx = pw.x - aw.x;
            var dy = pw.y - aw.y;
            var d = Math.sqrt(dx * dx + dy * dy);

            if (d < bestD && d <= this._model.maxInteractDistance) {
              bestD = d;
              best = c;
            }
          }

          this._nearest = best;
          ui.showInteractPrompt(!!best, '按 E 对话');
        }

        _rebuildModel() {
          var _this$mapConfig, _this$_model$raw$mapC, _this$_model$raw$mapI, _this$ui;

          if (!((_this$mapConfig = this.mapConfig) != null && _this$mapConfig.json)) return;
          this._model = new (_crd && StoryMapModel === void 0 ? (_reportPossibleCrUseOfStoryMapModel({
            error: Error()
          }), StoryMapModel) : StoryMapModel)(this.mapConfig);
          var code = (_this$_model$raw$mapC = this._model.raw.mapCode) != null ? _this$_model$raw$mapC : "map_" + ((_this$_model$raw$mapI = this._model.raw.mapId) != null ? _this$_model$raw$mapI : 0);
          this._taskState = new (_crd && StoryLocalTaskState === void 0 ? (_reportPossibleCrUseOfStoryLocalTaskState({
            error: Error()
          }), StoryLocalTaskState) : StoryLocalTaskState)(code, this.persistProgress);

          if (!((_this$ui = this.ui) != null && _this$ui.isValid)) {
            var _canvasRoot$getCompon;

            var canvasRoot = this.node.getChildByName('CanvasRoot(UI)');
            this.ui = (_canvasRoot$getCompon = canvasRoot == null ? void 0 : canvasRoot.getComponent(_crd && StoryUIViewController === void 0 ? (_reportPossibleCrUseOfStoryUIViewController({
              error: Error()
            }), StoryUIViewController) : StoryUIViewController)) != null ? _canvasRoot$getCompon : null;
          }
        }

        _resolvePlayerNode() {
          var _this$playerNode, _this$node$getChildBy, _pgms$0$node, _pgms$, _this$node$getCompone;

          if ((_this$playerNode = this.playerNode) != null && _this$playerNode.isValid) return this.playerNode;
          var root = (_this$node$getChildBy = this.node.getChildByName('WorldRoot')) != null ? _this$node$getChildBy : this.node;
          var pgms = root.getComponentsInChildren(_crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
            error: Error()
          }), PlayerGridMove) : PlayerGridMove);

          for (var i = 0; i < pgms.length; i++) {
            var _p$node;

            var p = pgms[i];

            if (p != null && p.enabled && (_p$node = p.node) != null && _p$node.isValid) {
              this.playerNode = p.node;
              return p.node;
            }
          }

          var fallback = (_pgms$0$node = (_pgms$ = pgms[0]) == null ? void 0 : _pgms$.node) != null ? _pgms$0$node : (_this$node$getCompone = this.node.getComponentInChildren(_crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
            error: Error()
          }), PlayerGridMove) : PlayerGridMove)) == null ? void 0 : _this$node$getCompone.node;

          if (fallback != null && fallback.isValid) {
            this.playerNode = fallback;
            return fallback;
          }

          return null;
        }

        _onKeyDown(e) {
          var _this$_nearest;

          if (e.keyCode !== KeyCode.KEY_E) return;
          if (!this.ui || !this._model || !this._taskState) return;
          this.ui.ensureRefs();
          if (this.ui.isBlockingInput()) return;
          if (!((_this$_nearest = this._nearest) != null && _this$_nearest.npcUid)) return;

          var ev = this._model.getFirstEligibleEvent(this._nearest.npcUid, this._taskState);

          if (!ev) {
            this.ui.showToast('当前没有可进行的剧情');
            return;
          }

          this._runEvent(ev);
        }

        _runEvent(ev) {
          var ui = this.ui;
          var state = this._taskState;
          var model = this._model;
          var t = ev.eventType;

          if (t === 'dialog') {
            var dlg = model.getDialogue(ev.client.dialogueScriptId);

            if (!dlg) {
              var _ev$client$dialogueSc;

              ui.showToast("\u7F3A\u5C11\u5BF9\u767D\u811A\u672C\uFF1A" + ((_ev$client$dialogueSc = ev.client.dialogueScriptId) != null ? _ev$client$dialogueSc : ''));
              return;
            }

            ui.runDialogue(dlg, cancelled => {
              var _ev$server$effects;

              if (cancelled) return;
              state.applyServerEffects((_ev$server$effects = ev.server.effects) != null ? _ev$server$effects : []);
              state.markEventCompleted(ev.eventId);
            });
            return;
          }

          if (t === 'task') {
            var _ev$client$taskUiHint, _ev$server$effects2;

            var hint = (_ev$client$taskUiHint = ev.client.taskUiHint) != null ? _ev$client$taskUiHint : '';
            state.applyServerEffects((_ev$server$effects2 = ev.server.effects) != null ? _ev$server$effects2 : []);
            state.markEventCompleted(ev.eventId);
            if (hint.length > 0) ui.showToast(hint, 2.8);
            return;
          }

          if (t === 'battle' || t === 'teleport') {
            var cid = ev.client.choiceScriptId;
            var choice = model.getChoice(cid);

            if (!choice) {
              ui.showToast("\u7F3A\u5C11\u9009\u9879\u811A\u672C\uFF1A" + (cid != null ? cid : ''));
              return;
            }

            ui.runChoice(choice, opt => {
              var _opt$systemTip;

              var lines = [];
              if ((_opt$systemTip = opt.systemTip) != null && _opt$systemTip.trim()) lines.push(opt.systemTip.trim());
              if (opt.forcedResult) lines.push('（剧情分支：后续将对接战斗/强制结果）');

              if (t === 'battle') {
                var _ev$server$battleRef, _ev$server$effects3;

                lines.push("\u6218\u6597\u5165\u53E3\u5F85\u5BF9\u63A5\uFF08" + ((_ev$server$battleRef = ev.server.battleRef) != null ? _ev$server$battleRef : '无 battleRef') + "\uFF09");
                state.applyServerEffects((_ev$server$effects3 = ev.server.effects) != null ? _ev$server$effects3 : []);
              } else {
                lines.push('传送入口待对接（MVP）');
              }

              if (lines.length > 0) ui.showToast(lines.join('\n'), 3.6);
              state.markEventCompleted(ev.eventId);
            });
            return;
          }

          ui.showToast("\u672A\u652F\u6301\u7684\u4E8B\u4EF6\u7C7B\u578B\uFF1A" + t);
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "mapConfig", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "playerNode", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "ui", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "persistProgress", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=6e8f316bba3a7d89638570a437b148b0ae08d734.js.map