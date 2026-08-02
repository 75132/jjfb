System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Button, Component, input, Input, KeyCode, Label, Node, StoryUIViewRefs, storyLog, storyLogVerboseMsg, _dec, _class, _class2, _crd, ccclass, StoryDialoguePlayer;

  /** 将 JSON / 弱类型数据规范为对白结构，避免 lines 非数组导致首点即关 */
  function normalizeDialogueScript(raw) {
    var _o$speaker;

    const o = raw != null ? raw : {};
    const speaker = String((_o$speaker = o.speaker) != null ? _o$speaker : '');
    let lines = [];

    if (Array.isArray(o.lines)) {
      lines = o.lines.map(x => String(x != null ? x : ''));
    } else if (typeof o.line === 'string' && o.line.length) {
      lines = [o.line];
    } else if (typeof o.text === 'string' && o.text.length) {
      lines = [o.text];
    }

    return {
      speaker,
      lines
    };
  }
  /**
   * 运行时驱动 StoryUIViewRefs：对白翻页、选项、Toast。
   * 与 StoryUIViewRefs 挂在同一节点（如 CanvasRoot(UI)）即可。
   */


  function _reportPossibleCrUseOfStoryUIViewRefs(extras) {
    _reporterNs.report("StoryUIViewRefs", "./StoryUIViewRefs", _context.meta, extras);
  }

  function _reportPossibleCrUseOfstoryLog(extras) {
    _reporterNs.report("storyLog", "./storyLogger", _context.meta, extras);
  }

  function _reportPossibleCrUseOfstoryLogVerboseMsg(extras) {
    _reporterNs.report("storyLogVerboseMsg", "./storyLogger", _context.meta, extras);
  }

  _export("normalizeDialogueScript", normalizeDialogueScript);

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
      input = _cc.input;
      Input = _cc.Input;
      KeyCode = _cc.KeyCode;
      Label = _cc.Label;
      Node = _cc.Node;
    }, function (_unresolved_2) {
      StoryUIViewRefs = _unresolved_2.StoryUIViewRefs;
    }, function (_unresolved_3) {
      storyLog = _unresolved_3.storyLog;
      storyLogVerboseMsg = _unresolved_3.storyLogVerboseMsg;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "f1a2bPEXW5/iaCxwtPk9QYH", "StoryDialoguePlayer", undefined);

      __checkObsolete__(['_decorator', 'Button', 'Component', 'EventTouch', 'input', 'Input', 'KeyCode', 'Label', 'Node', 'EventKeyboard']);

      ({
        ccclass
      } = _decorator);

      _export("StoryDialoguePlayer", StoryDialoguePlayer = (_dec = ccclass('StoryDialoguePlayer'), _dec(_class = (_class2 = class StoryDialoguePlayer extends Component {
        constructor(...args) {
          super(...args);
          this._refs = null;
          this._lineIndex = 0;
          this._script = null;
          this._onDialogueEnd = null;
          this._nextBound = false;
          this._choiceHandlers = [];

          /** Next：CLICK + TOUCH 防抖，避免同一次点击触发两次 _advanceLine */
          this._lastAdvanceWallMs = 0;

          this._hideToast = () => {
            var _this$_refs;

            if ((_this$_refs = this._refs) != null && _this$_refs.toastItem) this._refs.toastItem.active = false;
          };

          this._onNextClickBound = () => {
            this._advanceFromUi('click');
          };

          this._onNextTouchBound = e => {
            e.propagationStopped = true;

            this._advanceFromUi('touch');
          };

          this._onKeyDown = e => {
            var _this$_refs2;

            if (!((_this$_refs2 = this._refs) != null && (_this$_refs2 = _this$_refs2.dialoguePanel) != null && _this$_refs2.active)) return;

            if (e.keyCode === KeyCode.KEY_E || e.keyCode === KeyCode.ENTER) {
              this._advanceFromUi('key');
            }
          };
        }

        onLoad() {
          this._resolveRefs();

          input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        }

        start() {
          this._resolveRefs();
        }

        _resolveRefs() {
          var _ref, _this$getComponent, _this$node;

          this._refs = (_ref = (_this$getComponent = this.getComponent(_crd && StoryUIViewRefs === void 0 ? (_reportPossibleCrUseOfStoryUIViewRefs({
            error: Error()
          }), StoryUIViewRefs) : StoryUIViewRefs)) != null ? _this$getComponent : (_this$node = this.node) == null ? void 0 : _this$node.getComponentInChildren(_crd && StoryUIViewRefs === void 0 ? (_reportPossibleCrUseOfStoryUIViewRefs({
            error: Error()
          }), StoryUIViewRefs) : StoryUIViewRefs)) != null ? _ref : null;

          if (!this._refs) {
            var _this$node2;

            (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
              error: Error()
            }), storyLog) : storyLog)('error', 'StoryDialoguePlayer: 未找到 StoryUIViewRefs（请挂在同一节点或子节点）', {
              host: (_this$node2 = this.node) == null ? void 0 : _this$node2.name
            });
          }
        }

        onDestroy() {
          input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);

          this._unbindNext();

          this._clearChoiceHandlers();

          this.unschedule(this._hideToast);
        }
        /** 对白或选项面板是否占用输入（供外部防重复触发） */


        get isBlocking() {
          var _this$_refs$dialogueP, _this$_refs3, _this$_refs$choiceMod, _this$_refs4;

          const d = (_this$_refs$dialogueP = (_this$_refs3 = this._refs) == null || (_this$_refs3 = _this$_refs3.dialoguePanel) == null ? void 0 : _this$_refs3.active) != null ? _this$_refs$dialogueP : false;
          const c = (_this$_refs$choiceMod = (_this$_refs4 = this._refs) == null || (_this$_refs4 = _this$_refs4.choiceModal) == null ? void 0 : _this$_refs4.active) != null ? _this$_refs$choiceMod : false;
          return d || c;
        }

        closeAll() {
          var _this$_refs5, _this$_refs6, _this$_refs7;

          this._unbindNext();

          this._clearChoiceHandlers();

          this._script = null;
          this._onDialogueEnd = null;
          if ((_this$_refs5 = this._refs) != null && _this$_refs5.dialoguePanel) this._refs.dialoguePanel.active = false;
          if ((_this$_refs6 = this._refs) != null && _this$_refs6.choiceModal) this._refs.choiceModal.active = false;
          if ((_this$_refs7 = this._refs) != null && _this$_refs7.toastItem) this._refs.toastItem.active = false;
          this.unschedule(this._hideToast);
        }

        startDialogue(script, onComplete) {
          this._resolveRefs();

          if (!this._refs) return;
          const norm = normalizeDialogueScript(script);
          const rawKeys = script && typeof script === 'object' ? Object.keys(script) : [];
          (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
            error: Error()
          }), storyLog) : storyLog)('info', 'StoryDialoguePlayer.startDialogue', {
            speaker: norm.speaker,
            linesLen: norm.lines.length,
            rawKeys
          });

          if (norm.lines.length === 0) {
            (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
              error: Error()
            }), storyLog) : storyLog)('warn', 'StoryDialoguePlayer.startDialogue: lines 为空，已取消打开对白', {
              rawKeys
            });
            this.closeAll();
            this.showToast('对白数据无效（无 lines）', 4000);
            return;
          }

          this.closeAll();
          this._script = norm;
          this._lineIndex = 0;
          this._onDialogueEnd = onComplete != null ? onComplete : null;
          if (this._refs.dialoguePanel) this._refs.dialoguePanel.active = true;

          this._applyLine();

          this._bindNext();
        }

        startChoice(choice, onPick, onClose) {
          var _this$_refs8, _this$_refs$dialogueP2, _choice$title, _this$_refs$choiceBut, _this$_refs$nextButto;

          this._resolveRefs();

          if (!((_this$_refs8 = this._refs) != null && _this$_refs8.choiceModal)) return;

          this._clearChoiceHandlers();

          if ((_this$_refs$dialogueP2 = this._refs.dialoguePanel) != null && _this$_refs$dialogueP2.active) {
            this._refs.dialoguePanel.active = false;
          }

          this._refs.choiceModal.active = true;

          const titleLab = this._label(this._refs.choiceTitleLabel);

          if (titleLab) titleLab.string = (_choice$title = choice.title) != null ? _choice$title : '';
          const btns = (_this$_refs$choiceBut = this._refs.choiceButtons) != null ? _this$_refs$choiceBut : [];

          for (let i = 0; i < btns.length; i++) {
            const btnNode = btns[i];
            if (!btnNode) continue;
            const opt = choice.options[i];

            if (!opt) {
              btnNode.active = false;
              continue;
            }

            btnNode.active = true;
            const lab = btnNode.getComponentInChildren(Label);
            if (lab) lab.string = opt.text;

            const fn = () => {
              this._refs.choiceModal.active = false;

              this._clearChoiceHandlers();

              onPick == null || onPick(opt);
              if (opt.npcReply) this.showToast(opt.npcReply, 3500);
              if (opt.systemTip) this.showToast(opt.systemTip, 3500);
              onClose == null || onClose();
            };

            btnNode.on(Node.EventType.TOUCH_END, fn, this);

            this._choiceHandlers.push(() => btnNode.off(Node.EventType.TOUCH_END, fn, this));
          }

          const btnComp = (_this$_refs$nextButto = this._refs.nextButton) == null ? void 0 : _this$_refs$nextButto.getComponent(Button);
          if (btnComp) btnComp.interactable = false;
        }

        showToast(text, durationMs = 2500) {
          var _this$_refs9;

          this._resolveRefs();

          if (!((_this$_refs9 = this._refs) != null && _this$_refs9.toastItem) || !this._refs.toastTextLabel) return;

          const lab = this._label(this._refs.toastTextLabel);

          if (lab) lab.string = text;
          this._refs.toastItem.active = true;
          this.unschedule(this._hideToast);
          this.scheduleOnce(this._hideToast, durationMs / 1000);
        }

        _label(n) {
          var _n$getComponent;

          if (!n) return null;
          return (_n$getComponent = n.getComponent(Label)) != null ? _n$getComponent : n.getComponentInChildren(Label);
        }

        _applyLine() {
          var _this$_script$lines, _this$_script$speaker, _lines$this$_lineInde, _lines$this$_lineInde2;

          if (!this._refs || !this._script) return;
          const lines = (_this$_script$lines = this._script.lines) != null ? _this$_script$lines : [];

          const sp = this._label(this._refs.dialogueSpeakerLabel);

          const tx = this._label(this._refs.dialogueTextLabel);

          if (sp) sp.string = (_this$_script$speaker = this._script.speaker) != null ? _this$_script$speaker : '';
          if (tx) tx.string = (_lines$this$_lineInde = lines[this._lineIndex]) != null ? _lines$this$_lineInde : '';
          (_crd && storyLogVerboseMsg === void 0 ? (_reportPossibleCrUseOfstoryLogVerboseMsg({
            error: Error()
          }), storyLogVerboseMsg) : storyLogVerboseMsg)('StoryDialoguePlayer._applyLine', {
            lineIndex: this._lineIndex,
            preview: ((_lines$this$_lineInde2 = lines[this._lineIndex]) != null ? _lines$this$_lineInde2 : '').slice(0, 24)
          });
        }

        _bindNext() {
          var _this$_refs10;

          if (this._nextBound || !((_this$_refs10 = this._refs) != null && _this$_refs10.nextButton)) return;
          const nb = this._refs.nextButton;
          const btnComp = nb.getComponent(Button);

          if (btnComp) {
            btnComp.node.on(Button.EventType.CLICK, this._onNextClickBound, this);
          }

          nb.on(Node.EventType.TOUCH_END, this._onNextTouchBound, this);
          this._nextBound = true;
          (_crd && storyLogVerboseMsg === void 0 ? (_reportPossibleCrUseOfstoryLogVerboseMsg({
            error: Error()
          }), storyLogVerboseMsg) : storyLogVerboseMsg)('StoryDialoguePlayer._bindNext', {
            node: nb.name,
            hasButton: Boolean(btnComp)
          });
        }

        _unbindNext() {
          var _this$_refs11;

          if (!((_this$_refs11 = this._refs) != null && _this$_refs11.nextButton)) {
            this._nextBound = false;
            return;
          }

          if (this._nextBound) {
            const nb = this._refs.nextButton;
            const btnComp = nb.getComponent(Button);

            if (btnComp) {
              btnComp.node.off(Button.EventType.CLICK, this._onNextClickBound, this);
            }

            nb.off(Node.EventType.TOUCH_END, this._onNextTouchBound, this);
          }

          this._nextBound = false;
        }

        _advanceFromUi(source) {
          const now = Date.now();

          if (now - this._lastAdvanceWallMs < StoryDialoguePlayer._ADVANCE_DEBOUNCE_MS) {
            (_crd && storyLogVerboseMsg === void 0 ? (_reportPossibleCrUseOfstoryLogVerboseMsg({
              error: Error()
            }), storyLogVerboseMsg) : storyLogVerboseMsg)('StoryDialoguePlayer._advanceFromUi: debounced', {
              source
            });
            return;
          }

          this._lastAdvanceWallMs = now;
          (_crd && storyLogVerboseMsg === void 0 ? (_reportPossibleCrUseOfstoryLogVerboseMsg({
            error: Error()
          }), storyLogVerboseMsg) : storyLogVerboseMsg)('StoryDialoguePlayer._advanceFromUi', {
            source
          });

          this._advanceLine();
        }

        _advanceLine() {
          var _this$_script$lines2, _this$_refs12;

          if (!this._script) return;
          const lines = (_this$_script$lines2 = this._script.lines) != null ? _this$_script$lines2 : [];
          const linesLen = lines.length;
          const willClose = !(this._lineIndex < linesLen - 1);
          (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
            error: Error()
          }), storyLog) : storyLog)('info', 'StoryDialoguePlayer._advanceLine', {
            lineIndex: this._lineIndex,
            linesLen,
            willClose
          });

          if (this._lineIndex < linesLen - 1) {
            this._lineIndex++;

            this._applyLine();

            return;
          }

          (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
            error: Error()
          }), storyLog) : storyLog)('info', 'StoryDialoguePlayer._advanceLine: 关闭对白面板');

          this._unbindNext();

          if ((_this$_refs12 = this._refs) != null && _this$_refs12.dialoguePanel) this._refs.dialoguePanel.active = false;
          const cb = this._onDialogueEnd;
          this._script = null;
          this._onDialogueEnd = null;
          cb == null || cb();
        }

        _clearChoiceHandlers() {
          var _this$_refs13;

          for (const u of this._choiceHandlers) u();

          this._choiceHandlers = [];
          const btnComp = (_this$_refs13 = this._refs) == null || (_this$_refs13 = _this$_refs13.nextButton) == null ? void 0 : _this$_refs13.getComponent(Button);
          if (btnComp) btnComp.interactable = true;
        }

      }, _class2._ADVANCE_DEBOUNCE_MS = 90, _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=3bd82a17ed1612d1367cf930d0845e84bae95005.js.map