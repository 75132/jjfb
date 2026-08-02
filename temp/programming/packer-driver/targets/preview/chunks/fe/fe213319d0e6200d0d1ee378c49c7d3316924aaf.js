System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Button, Component, Label, StoryUIViewRefs, _dec, _dec2, _class, _class2, _descriptor, _crd, ccclass, property, StoryUIViewController;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function childByPath(root, segments) {
    var cur = root;

    for (var i = 0; i < segments.length; i++) {
      if (!cur) return null;
      cur = cur.getChildByName(segments[i]);
    }

    return cur;
  }
  /**
   * 驱动 Story UI：对白、选项、Toast、交互提示。
   * 建议挂在 CanvasRoot(UI)，与 StoryUIViewRefs 同节点；节点路径与 StoryUIAutoBuilder 一致。
   *
   * 编辑器绑定（可选）：StoryUIViewRefs 拖引用；留空则在运行时按层级名解析。
   */


  function _reportPossibleCrUseOfStoryChoiceOption(extras) {
    _reporterNs.report("StoryChoiceOption", "./StoryMapTypes", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryChoiceScript(extras) {
    _reporterNs.report("StoryChoiceScript", "./StoryMapTypes", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryDialogueScript(extras) {
    _reporterNs.report("StoryDialogueScript", "./StoryMapTypes", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryUIViewRefs(extras) {
    _reporterNs.report("StoryUIViewRefs", "./StoryUIViewRefs", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Button = _cc.Button;
      Component = _cc.Component;
      Label = _cc.Label;
    }, function (_unresolved_2) {
      StoryUIViewRefs = _unresolved_2.StoryUIViewRefs;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "c8a049RfraCTb9Rv36dS1Nj", "StoryUIViewController", undefined);

      __checkObsolete__(['_decorator', 'Button', 'Component', 'Label', 'Node']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("StoryUIViewController", StoryUIViewController = (_dec = ccclass('StoryUIViewController'), _dec2 = property({
        type: _crd && StoryUIViewRefs === void 0 ? (_reportPossibleCrUseOfStoryUIViewRefs({
          error: Error()
        }), StoryUIViewRefs) : StoryUIViewRefs,
        tooltip: '留空则从本节点 getComponent'
      }), _dec(_class = (_class2 = class StoryUIViewController extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "viewRefs", _descriptor, this);

          this._refsResolved = false;
          this._storyLayer = null;
          this._dialoguePanel = null;
          this._speakerLabel = null;
          this._bodyLabel = null;
          this._nextBtn = null;
          this._closeBtn = null;
          this._choiceModal = null;
          this._choiceTitle = null;
          this._choiceBtnNodes = [];
          this._choiceButtons = [];
          this._choiceLabels = [];
          this._subReplyArea = null;
          this._subReplyLabel = null;
          this._toastRoot = null;
          this._toastLabel = null;
          this._interactPrompt = null;
          this._interactPromptLabel = null;
          this._dlgLines = [];
          this._dlgIdx = 0;
          this._onDialogueEnd = null;
          this._runningChoice = null;
          this._choiceDone = null;
          this._choiceClosing = false;

          this._hideToast = () => {
            var _this$_toastRoot;

            if ((_this$_toastRoot = this._toastRoot) != null && _this$_toastRoot.isValid) this._toastRoot.active = false;
          };
        }

        start() {
          this.scheduleOnce(() => this.ensureRefs(), 0);
        }

        ensureRefs() {
          var _this$viewRefs, _vr$dialoguePanel, _vr$dialogueSpeakerLa, _vr$dialogueTextLabel, _spkNode$getComponent, _bodyNode$getComponen, _vr$nextButton, _nextNd$getComponent, _closeNd$getComponent, _vr$choiceModal, _vr$choiceTitleLabel, _titleNd$getComponent, _vr$choiceButtons, _replyTextNd$getCompo, _vr$toastItem, _vr$toastTextLabel, _toastTextNd$getCompo, _vr$interactPrompt, _vr$interactPromptTex, _promptTextNd$getComp;

          if (this._refsResolved) return;
          var vr = (_this$viewRefs = this.viewRefs) != null ? _this$viewRefs : this.getComponent(_crd && StoryUIViewRefs === void 0 ? (_reportPossibleCrUseOfStoryUIViewRefs({
            error: Error()
          }), StoryUIViewRefs) : StoryUIViewRefs);
          this.viewRefs = vr;
          var root = this.node;
          this._storyLayer = childByPath(root, ['StoryLayer']);
          this._dialoguePanel = (_vr$dialoguePanel = vr == null ? void 0 : vr.dialoguePanel) != null ? _vr$dialoguePanel : childByPath(this._storyLayer, ['DialoguePanel']);
          var dlg = this._dialoguePanel;
          var spkNode = (_vr$dialogueSpeakerLa = vr == null ? void 0 : vr.dialogueSpeakerLabel) != null ? _vr$dialogueSpeakerLa : childByPath(dlg, ['SpeakerNameLabel']);
          var bodyNode = (_vr$dialogueTextLabel = vr == null ? void 0 : vr.dialogueTextLabel) != null ? _vr$dialogueTextLabel : childByPath(dlg, ['LinesContainer', 'Text']);
          this._speakerLabel = (_spkNode$getComponent = spkNode == null ? void 0 : spkNode.getComponent(Label)) != null ? _spkNode$getComponent : null;
          this._bodyLabel = (_bodyNode$getComponen = bodyNode == null ? void 0 : bodyNode.getComponent(Label)) != null ? _bodyNode$getComponen : null;
          var nextNd = (_vr$nextButton = vr == null ? void 0 : vr.nextButton) != null ? _vr$nextButton : childByPath(dlg, ['NextBtn']);
          this._nextBtn = (_nextNd$getComponent = nextNd == null ? void 0 : nextNd.getComponent(Button)) != null ? _nextNd$getComponent : null;
          var closeNd = childByPath(dlg, ['CloseBtn']);
          this._closeBtn = (_closeNd$getComponent = closeNd == null ? void 0 : closeNd.getComponent(Button)) != null ? _closeNd$getComponent : null;
          this._choiceModal = (_vr$choiceModal = vr == null ? void 0 : vr.choiceModal) != null ? _vr$choiceModal : childByPath(this._storyLayer, ['ChoiceModal']);
          var cm = this._choiceModal;
          var titleNd = (_vr$choiceTitleLabel = vr == null ? void 0 : vr.choiceTitleLabel) != null ? _vr$choiceTitleLabel : childByPath(cm, ['TitleLabel']);
          this._choiceTitle = (_titleNd$getComponent = titleNd == null ? void 0 : titleNd.getComponent(Label)) != null ? _titleNd$getComponent : null;
          var optRoot = childByPath(cm, ['OptionsContainer']);
          this._choiceBtnNodes = [];
          this._choiceButtons = [];
          this._choiceLabels = [];

          if (optRoot) {
            var _optRoot$children;

            var ch = (_optRoot$children = optRoot.children) != null ? _optRoot$children : [];
            var opts = ch.filter(n => n.name.startsWith('OptionButton'));
            opts.sort((a, b) => a.name.localeCompare(b.name));

            for (var i = 0; i < opts.length; i++) {
              var _bn$getComponent, _ref, _tn$getComponent;

              var bn = opts[i];

              this._choiceBtnNodes.push(bn);

              this._choiceButtons.push((_bn$getComponent = bn.getComponent(Button)) != null ? _bn$getComponent : bn.addComponent(Button));

              var tn = bn.getChildByName('Text');

              this._choiceLabels.push((_ref = (_tn$getComponent = tn == null ? void 0 : tn.getComponent(Label)) != null ? _tn$getComponent : bn.getComponent(Label)) != null ? _ref : bn.addComponent(Label));
            }
          }

          if (vr != null && (_vr$choiceButtons = vr.choiceButtons) != null && _vr$choiceButtons.length) {
            for (var _i = 0; _i < vr.choiceButtons.length; _i++) {
              var _bn$getComponent2, _ref2, _tn$getComponent2;

              var _bn = vr.choiceButtons[_i];
              if (!_bn || this._choiceBtnNodes.includes(_bn)) continue;

              this._choiceBtnNodes.push(_bn);

              this._choiceButtons.push((_bn$getComponent2 = _bn.getComponent(Button)) != null ? _bn$getComponent2 : _bn.addComponent(Button));

              var _tn = _bn.getChildByName('Text');

              this._choiceLabels.push((_ref2 = (_tn$getComponent2 = _tn == null ? void 0 : _tn.getComponent(Label)) != null ? _tn$getComponent2 : _bn.getComponent(Label)) != null ? _ref2 : _bn.addComponent(Label));
            }
          }

          this._subReplyArea = childByPath(cm, ['SubReplyArea']);
          var replyTextNd = childByPath(this._subReplyArea, ['Text']);
          this._subReplyLabel = (_replyTextNd$getCompo = replyTextNd == null ? void 0 : replyTextNd.getComponent(Label)) != null ? _replyTextNd$getCompo : null;
          var toastNd = (_vr$toastItem = vr == null ? void 0 : vr.toastItem) != null ? _vr$toastItem : childByPath(this._storyLayer, ['SystemTipLayer', 'ToastItem']);
          this._toastRoot = toastNd;
          var toastTextNd = (_vr$toastTextLabel = vr == null ? void 0 : vr.toastTextLabel) != null ? _vr$toastTextLabel : childByPath(toastNd, ['Text']);
          this._toastLabel = (_toastTextNd$getCompo = toastTextNd == null ? void 0 : toastTextNd.getComponent(Label)) != null ? _toastTextNd$getCompo : null;
          var promptNd = (_vr$interactPrompt = vr == null ? void 0 : vr.interactPrompt) != null ? _vr$interactPrompt : childByPath(root, ['HUDLayer', 'InteractPrompt']);
          this._interactPrompt = promptNd;
          var promptTextNd = (_vr$interactPromptTex = vr == null ? void 0 : vr.interactPromptText) != null ? _vr$interactPromptTex : childByPath(promptNd, ['PromptText']);
          this._interactPromptLabel = (_promptTextNd$getComp = promptTextNd == null ? void 0 : promptTextNd.getComponent(Label)) != null ? _promptTextNd$getComp : null;

          this._wireButtons();

          this._refsResolved = true;
        }

        _wireButtons() {
          var _this$_nextBtn,
              _this$_nextBtn2,
              _this$_closeBtn,
              _this$_closeBtn2,
              _this = this;

          (_this$_nextBtn = this._nextBtn) == null || (_this$_nextBtn = _this$_nextBtn.node) == null || _this$_nextBtn.off(Button.EventType.CLICK);
          (_this$_nextBtn2 = this._nextBtn) == null || (_this$_nextBtn2 = _this$_nextBtn2.node) == null || _this$_nextBtn2.on(Button.EventType.CLICK, this._onNextDialogue, this);
          (_this$_closeBtn = this._closeBtn) == null || (_this$_closeBtn = _this$_closeBtn.node) == null || _this$_closeBtn.off(Button.EventType.CLICK);
          (_this$_closeBtn2 = this._closeBtn) == null || (_this$_closeBtn2 = _this$_closeBtn2.node) == null || _this$_closeBtn2.on(Button.EventType.CLICK, this._onCloseDialogue, this);

          var _loop = function _loop() {
            var idx = i;
            var b = _this._choiceButtons[i];
            b.node.off(Button.EventType.CLICK);
            b.node.on(Button.EventType.CLICK, () => _this._onPickChoice(idx), _this);
          };

          for (var i = 0; i < this._choiceButtons.length; i++) {
            _loop();
          }
        }

        onDestroy() {
          var _this$_nextBtn3, _this$_closeBtn3;

          this.unscheduleAllCallbacks();
          (_this$_nextBtn3 = this._nextBtn) == null || (_this$_nextBtn3 = _this$_nextBtn3.node) == null || _this$_nextBtn3.off(Button.EventType.CLICK, this._onNextDialogue, this);
          (_this$_closeBtn3 = this._closeBtn) == null || (_this$_closeBtn3 = _this$_closeBtn3.node) == null || _this$_closeBtn3.off(Button.EventType.CLICK, this._onCloseDialogue, this);

          for (var i = 0; i < this._choiceButtons.length; i++) {
            this._choiceButtons[i].node.targetOff(this);
          }
        }

        isBlockingInput() {
          var _this$_dialoguePanel, _this$_choiceModal;

          if (!this._refsResolved) return false;
          if ((_this$_dialoguePanel = this._dialoguePanel) != null && _this$_dialoguePanel.active) return true;
          if ((_this$_choiceModal = this._choiceModal) != null && _this$_choiceModal.active) return true;
          return false;
        }

        showInteractPrompt(visible, text) {
          if (text === void 0) {
            text = '按 E 对话';
          }

          this.ensureRefs();
          if (this._interactPrompt) this._interactPrompt.active = visible;
          if (this._interactPromptLabel) this._interactPromptLabel.string = text;
        }

        showToast(message, durationSec) {
          if (durationSec === void 0) {
            durationSec = 2.2;
          }

          this.ensureRefs();

          if (!this._toastRoot || !this._toastLabel) {
            console.warn('[StoryUIViewController] Toast 节点未就绪:', message);
            return;
          }

          this.unschedule(this._hideToast);
          this._toastLabel.string = message;
          this._toastRoot.active = true;
          this.scheduleOnce(this._hideToast, durationSec);
        }

        runDialogue(script, onEnd) {
          var _script$lines, _this$_closeBtn4, _script$speaker;

          this.ensureRefs();
          this._onDialogueEnd = onEnd;
          this._dlgLines = (_script$lines = script.lines) != null ? _script$lines : [];
          this._dlgIdx = 0;
          if ((_this$_closeBtn4 = this._closeBtn) != null && _this$_closeBtn4.node) this._closeBtn.node.active = true;
          if (this._dialoguePanel) this._dialoguePanel.active = true;
          if (this._speakerLabel) this._speakerLabel.string = (_script$speaker = script.speaker) != null ? _script$speaker : '';

          this._refreshDialogueLine();
        }

        _refreshDialogueLine() {
          var _this$_dlgLines$this$;

          var line = (_this$_dlgLines$this$ = this._dlgLines[this._dlgIdx]) != null ? _this$_dlgLines$this$ : '';
          if (this._bodyLabel) this._bodyLabel.string = line;
        }

        _onNextDialogue() {
          if (this._dlgIdx + 1 < this._dlgLines.length) {
            this._dlgIdx++;

            this._refreshDialogueLine();

            return;
          }

          this._finishDialogue(false);
        }

        _onCloseDialogue() {
          this._finishDialogue(true);
        }

        _finishDialogue(cancelled) {
          var _this$_dialoguePanel2;

          if ((_this$_dialoguePanel2 = this._dialoguePanel) != null && _this$_dialoguePanel2.isValid) this._dialoguePanel.active = false;
          var cb = this._onDialogueEnd;
          this._onDialogueEnd = null;
          if (cb) cb(cancelled);
        }

        runChoice(script, onPick) {
          var _script$options, _script$title;

          this.ensureRefs();
          this._runningChoice = script;
          this._choiceDone = onPick;
          this._choiceClosing = false;
          var opts = (_script$options = script.options) != null ? _script$options : [];

          if (!this._choiceModal) {
            if (opts[0]) onPick(opts[0]);else onPick({
              id: '_empty',
              text: ''
            });
            this._runningChoice = null;
            return;
          }

          if (this._choiceTitle) this._choiceTitle.string = (_script$title = script.title) != null ? _script$title : '';

          for (var i = 0; i < this._choiceBtnNodes.length; i++) {
            var _opts$i$text;

            var show = i < opts.length;
            this._choiceBtnNodes[i].active = show;
            if (show && this._choiceLabels[i]) this._choiceLabels[i].string = (_opts$i$text = opts[i].text) != null ? _opts$i$text : '';
          }

          if (this._subReplyArea) this._subReplyArea.active = false;
          this._choiceModal.active = true;
        }

        _closeChoiceModal() {
          var _this$_choiceModal2;

          if ((_this$_choiceModal2 = this._choiceModal) != null && _this$_choiceModal2.isValid) this._choiceModal.active = false;
          this._runningChoice = null;
          this._choiceDone = null;
          this._choiceClosing = false;
        }

        _onPickChoice(btnIndex) {
          var _this$_choiceModal3, _this$_choiceBtnNodes, _script$options2, _picked$npcReply$trim, _picked$npcReply;

          if (this._choiceClosing) return;
          var cb = this._choiceDone;
          var script = this._runningChoice;
          if (!cb || !script || !((_this$_choiceModal3 = this._choiceModal) != null && _this$_choiceModal3.active)) return;
          if (!((_this$_choiceBtnNodes = this._choiceBtnNodes[btnIndex]) != null && _this$_choiceBtnNodes.active)) return;
          var opts = (_script$options2 = script.options) != null ? _script$options2 : [];
          var picked = opts[btnIndex];
          if (!picked) return;
          this._choiceClosing = true;

          for (var i = 0; i < this._choiceButtons.length; i++) {
            this._choiceButtons[i].interactable = false;
          }

          var finish = () => {
            for (var _i2 = 0; _i2 < this._choiceButtons.length; _i2++) {
              this._choiceButtons[_i2].interactable = true;
            }

            var fn = cb;

            this._closeChoiceModal();

            fn(picked);
          };

          var reply = (_picked$npcReply$trim = (_picked$npcReply = picked.npcReply) == null ? void 0 : _picked$npcReply.trim()) != null ? _picked$npcReply$trim : '';

          if (reply.length > 0 && this._subReplyArea && this._subReplyLabel) {
            this._subReplyLabel.string = reply;
            this._subReplyArea.active = true;

            for (var _i3 = 0; _i3 < this._choiceBtnNodes.length; _i3++) {
              this._choiceBtnNodes[_i3].active = false;
            }

            this.scheduleOnce(() => finish(), 2.0);
          } else {
            finish();
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "viewRefs", [_dec2], {
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
//# sourceMappingURL=fe213319d0e6200d0d1ee378c49c7d3316924aaf.js.map