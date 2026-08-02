System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Label, Button, Sprite, instantiate, Prefab, EditBox, assetManager, UITransform, v2, WebSocketManager, _dec, _dec2, _dec3, _dec4, _class, _class2, _descriptor, _descriptor2, _descriptor3, _crd, ccclass, property, SYNC_INTERVAL_SEC, MAX_BET_AMOUNT, MIN_BET_AMOUNT, CATEGORIES, MiniGame2;

  function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

  function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
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
      Button = _cc.Button;
      Sprite = _cc.Sprite;
      instantiate = _cc.instantiate;
      Prefab = _cc.Prefab;
      EditBox = _cc.EditBox;
      assetManager = _cc.assetManager;
      UITransform = _cc.UITransform;
      v2 = _cc.v2;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "40bbfJTVgBH1JHxbXNjZd2q", "MiniGame2", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Label', 'Button', 'Sprite', 'SpriteFrame', 'instantiate', 'Prefab', 'EditBox', 'assetManager', 'UITransform', 'v2']);

      ({
        ccclass,
        property
      } = _decorator);
      SYNC_INTERVAL_SEC = 10;
      MAX_BET_AMOUNT = 999999999;
      MIN_BET_AMOUNT = 1;
      CATEGORIES = [{
        key: 'bear',
        name: '熊市',
        multiplier: 2
      }, {
        key: 'bull',
        name: '牛市',
        multiplier: 2
      }, {
        key: 'nano',
        name: '纳米科技',
        multiplier: 3
      }, {
        key: 'quantum_mine',
        name: '量子矿脉',
        multiplier: 4
      }, {
        key: 'stellar_route',
        name: '星海航线',
        multiplier: 5
      }, {
        key: 'annihilation',
        name: '湮灭能量',
        multiplier: 7
      }];

      _export("MiniGame2", MiniGame2 = (_dec = ccclass('MiniGame2'), _dec2 = property({
        type: Prefab
      }), _dec3 = property({
        type: Label
      }), _dec4 = property({
        type: Label
      }), _dec(_class = (_class2 = class MiniGame2 extends Component {
        constructor() {
          var _this;

          super(...arguments);
          _this = this;

          // 下方选项项 prefab（MiniGame2ListPrefab）。建议你拖进来，确保动态生成选项一定可用。
          _initializerDefineProperty(this, "optionItemPrefab", _descriptor, this);

          // 当前期数显示（你在编辑器里把 Label 拖到这里即可）
          _initializerDefineProperty(this, "currentIssueLabel", _descriptor2, this);

          // 本期已投资明细显示（你在编辑器里把 Label 拖到这里即可）
          _initializerDefineProperty(this, "myBetsLabel", _descriptor3, this);

          this.ws = null;
          this._lastPayload = null;
          this._serverTimeBaseMs = null;
          this._serverTimeRecvAtMs = 0;
          this._roundCloseMs = null;
          this._requestingBet = false;
          this.countdownLabel = null;
          this.energyAvailableLabel = null;
          this.topEnergyLabel = null;
          this.currentSelectionLabel = null;
          this.editBox = null;
          this.confirmBtn = null;
          this.confirmButtonComp = null;
          this.optionContent = null;
          this.selectedKey = null;
          this.optionItems = [];
          this._optionItemsLoading = false;
          this.backControlNode = null;
          this._backBtnNode = null;
          this.errorPanel = null;
          this.errorLabel = null;
          // 顶部提示文案（场景中 MiniGame2 下的 Label，用来显示“乱投资是吧”等提示）
          this.mainTipLabel = null;
          this.errorConfirmNode = null;
          this.errorCancelNode = null;
          this.errorConfirmBtn = null;
          this.errorCancelBtn = null;
          this._pendingBetAmount = null;
          this._pendingBetKey = null;
          this.viewHistoryBtn = null;
          // InvestmentReturnHistory 看板（点击 ViewInvestmentReturnHistory 后弹出）
          this.investmentReturnHistoryOpen = false;
          this.investmentReturnHistoryPanel = null;
          this.investmentReturnHistoryTotalLabel = null;
          this.investmentReturnHistoryHistoryProtoNode = null;
          this.investmentReturnHistoryHistoryProtoLabel = null;
          this.investmentReturnHistoryHistoryParent = null;
          this.investmentReturnHistoryDynamicNodes = [];
          this._requestingHistory = false;

          this._scheduledSyncTick = () => {
            this.requestSync();
          };

          this.openInvestmentReturnHistoryPanel = /*#__PURE__*/_asyncToGenerator(function* () {
            if (!_this.ws.isConnected()) {
              _this.showError('网络未连接');

              return;
            }

            _this.ensureInvestmentReturnHistoryPanelReady();

            if (!_this.investmentReturnHistoryPanel || !_this.investmentReturnHistoryTotalLabel || !_this.investmentReturnHistoryHistoryProtoNode || !_this.investmentReturnHistoryHistoryProtoLabel) {
              _this.showError('历史看板节点未就绪');

              return;
            } // 面板打开时：禁止主玩法交互（避免你点着点着又下注）


            _this.investmentReturnHistoryOpen = true;
            _this.investmentReturnHistoryPanel.active = true; // 若尚未拿到 sync payload，先手动禁用，避免用户误操作

            if (_this.editBox) _this.editBox.enabled = false;

            for (var item of _this.optionItems) item.btn.interactable = false;

            if (_this.confirmButtonComp) _this.confirmButtonComp.interactable = false;
            if (_this._lastPayload) _this.applyPayload(_this._lastPayload); // 清理上一次动态复制的行

            if (_this.investmentReturnHistoryDynamicNodes.length > 0) {
              for (var n of _this.investmentReturnHistoryDynamicNodes) n.destroy();

              _this.investmentReturnHistoryDynamicNodes = [];
            } // 先展示加载态（使用你场景里已有的 History 文本作为第一行模板）


            _this.investmentReturnHistoryTotalLabel.string = '今日总收益：加载中...';
            _this.investmentReturnHistoryHistoryProtoLabel.string = '加载中...';
            yield _this.requestInvestmentReturnHistory();
          });

          this.onBackControl = () => {
            // 返回按钮：优先关闭 InvestmentReturnHistory，否则关闭 MiniGame2 面板
            if (this.investmentReturnHistoryOpen) {
              this.closeInvestmentReturnHistoryPanel();
              return;
            }

            this.node.active = false;
          };

          this.onErrorConfirmClick = () => {
            if (!this.ws.isConnected()) {
              this.showError('网络未连接');
              return;
            }

            if (this._requestingBet) return;
            var amount = this._pendingBetAmount;
            var key = this._pendingBetKey;

            if (!amount || !key) {
              this.errorPanel && (this.errorPanel.active = false);
              return;
            } // 关闭确认框，开始真正下注


            if (this.errorPanel) this.errorPanel.active = false;
            if (this.errorConfirmNode) this.errorConfirmNode.active = false;
            if (this.errorCancelNode) this.errorCancelNode.active = false;
            this._requestingBet = true;
            if (this.confirmButtonComp) this.confirmButtonComp.interactable = false;
            this.ws.request('minigame2_bet', {
              selected_key: key,
              bet_amount: amount
            }, resp => {
              this._requestingBet = false;

              if (resp != null && resp.success && resp != null && resp.data) {
                var _resp$data, _resp$data2;

                var data = resp.data;
                this.applyPayload(data); // 服务端支持同一期多类目累计下注：这里只提示“本次请求”的类目与金额即可

                var respSelected = resp == null || (_resp$data = resp.data) == null ? void 0 : _resp$data.selected_key;
                var respAmt = resp == null || (_resp$data2 = resp.data) == null ? void 0 : _resp$data2.bet_amount;

                if (respSelected && respAmt) {
                  var cat = CATEGORIES.find(c => c.key === respSelected);
                  var catName = cat ? cat.name : String(respSelected);
                  this.showError("\u5DF2\u6295\u8D44 " + respAmt + " \u5230 " + catName);
                } else {
                  this.showError('投资成功');
                }
              } else {
                var _resp$message;

                var msg = String((_resp$message = resp == null ? void 0 : resp.message) != null ? _resp$message : '下注失败').replace(/\\n/g, '\n');
                this.showError(msg);
                if (this._lastPayload) this.applyPayload(this._lastPayload);
              } // 用完以后清掉 pending


              this._pendingBetAmount = null;
              this._pendingBetKey = null;
            }, true, 15000);
          };

          this.onErrorCancelClick = () => {
            // 取消：只关闭确认框，不扣钱
            this._pendingBetAmount = null;
            this._pendingBetKey = null;
            if (this.errorConfirmNode) this.errorConfirmNode.active = false;
            if (this.errorCancelNode) this.errorCancelNode.active = false;
            if (this.errorPanel) this.errorPanel.active = false;
          };
        }

        static mountFromSceneRoot(root) {
          var scene = root.scene;
          if (!scene) return;
          var stack = [...scene.children];

          while (stack.length) {
            var n = stack.pop();

            if (n.name === 'MiniGame2') {
              if (!n.getComponent(MiniGame2)) n.addComponent(MiniGame2);
              return;
            }

            stack.push(...n.children);
          }
        }

        updateOptionVisual() {
          if (!this.optionItems.length) return;

          for (var item of this.optionItems) {
            if (!item.sprite || !item.normalSprite || !item.pressedSprite) continue;
            var isSelected = this.selectedKey === item.key;
            item.sprite.spriteFrame = isSelected ? item.pressedSprite : item.normalSprite;
          }
        }

        onLoad() {
          this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          this.resolveBindings();
        }

        onEnable() {
          this.bindViewHistoryTrigger();
          this.requestSync();
          this.schedule(this._scheduledSyncTick, SYNC_INTERVAL_SEC);
        }

        onDisable() {
          this.unschedule(this._scheduledSyncTick);
        }

        start() {
          // 初次渲染选项：不依赖首个 sync，先把 UI 列表画出来，减少“卡很久才出现”的体感
          // 若 prefab 已在编辑器中绑定，这里是本地即时创建，不涉及资源加载。
          // 异步执行，避免阻塞主线程。
          this.ensureOptionItemsReady();
        }

        update() {
          this.refreshCountdown();
        }

        resolveBindings() {
          var _g$getComponent, _g, _g$getComponent2, _g2, _g$getComponent3, _g3, _ebNode$getComponent, _this$confirmBtn$getC, _this$confirmBtn, _ref2, _g4;

          var g = name => this.findDeep(this.node, name);

          this.countdownLabel = (_g$getComponent = (_g = g('CountdownToDraw')) == null ? void 0 : _g.getComponent(Label)) != null ? _g$getComponent : null;

          if (!this.countdownLabel) {
            // 兜底：找该节点下任意 Label
            var cd = g('CountdownToDraw');
            if (cd) this.countdownLabel = cd.getComponentInChildren(Label);
          }

          this.energyAvailableLabel = (_g$getComponent2 = (_g2 = g('EnergyAvailable')) == null ? void 0 : _g2.getComponent(Label)) != null ? _g$getComponent2 : null; // 顶部能量块显示（节点名为 EnergyBlock，下挂一个 Label）

          var topEnergyNode = g('EnergyBlock');

          if (topEnergyNode) {
            var _topEnergyNode$getCom;

            this.topEnergyLabel = (_topEnergyNode$getCom = topEnergyNode.getComponent(Label)) != null ? _topEnergyNode$getCom : topEnergyNode.getComponentInChildren(Label);
          }

          this.currentSelectionLabel = (_g$getComponent3 = (_g3 = g('CurrentSelection')) == null ? void 0 : _g3.getComponent(Label)) != null ? _g$getComponent3 : null; // 顶部提示 Label（节点名就叫 Label，在 MiniGame2 根下）

          var topLabelNode = g('Label');

          if (topLabelNode) {
            var _topLabelNode$getComp;

            this.mainTipLabel = (_topLabelNode$getComp = topLabelNode.getComponent(Label)) != null ? _topLabelNode$getComp : topLabelNode.getComponentInChildren(Label);
          }

          var ebNode = g('EnergyBlockInput');
          this.editBox = (_ebNode$getComponent = ebNode == null ? void 0 : ebNode.getComponent(EditBox)) != null ? _ebNode$getComponent : null;
          this.confirmBtn = g('ConfirmInvestment');
          this.confirmButtonComp = (_this$confirmBtn$getC = (_this$confirmBtn = this.confirmBtn) == null ? void 0 : _this$confirmBtn.getComponent(Button)) != null ? _this$confirmBtn$getC : null;

          if (this.confirmBtn) {
            if (this.confirmButtonComp) {
              this.confirmButtonComp.node.on(Button.EventType.CLICK, this.onConfirmInvestmentClick, this);
            } else {
              var btn = this.confirmBtn.getComponentInChildren(Button);
              if (btn) btn.node.on(Button.EventType.CLICK, this.onConfirmInvestmentClick, this);
            }
          } // MiniGame2List -> view -> content


          var listRoot = g('MiniGame2List');
          this.optionContent = listRoot ? this.findDeep(listRoot, 'content') : null; // 错误提示面板：兼容 Errortip / ErrorTip

          this.errorPanel = (_ref2 = (_g4 = g('Errortip')) != null ? _g4 : g('ErrorTip')) != null ? _ref2 : null; // 若在 MiniGame2 节点下没找到，就从整个场景再兜底找一次

          if (!this.errorPanel && this.node.scene) {
            var _findInScene;

            var findInScene = (root, name) => {
              if (root.name === name) return root;

              for (var c of root.children) {
                var r = findInScene(c, name);
                if (r) return r;
              }

              return null;
            };

            this.errorPanel = (_findInScene = findInScene(this.node.scene, 'Errortip')) != null ? _findInScene : findInScene(this.node.scene, 'ErrorTip');
          }

          if (this.errorPanel) {
            var _this$errorPanel$chil, _ref3, _directChildLabelNode, _this$findDeep, _ref4, _this$errorConfirmNod, _this$errorConfirmNod2, _this$errorConfirmNod3, _ref5, _this$errorCancelNode, _this$errorCancelNode2, _this$errorCancelNode3;

            // 先优先从 Errortip 直系子节点中查找名为 "Label" 的节点，确保拿到的是主文案 Label，
            // 而不是 Confirm/Cancel 等按钮内部的 Label，避免把按钮文字当成错误文案。
            var directChildLabelNode = (_this$errorPanel$chil = this.errorPanel.children.find(c => c.name === 'Label')) != null ? _this$errorPanel$chil : null;
            this.errorLabel = (_ref3 = (_directChildLabelNode = directChildLabelNode == null ? void 0 : directChildLabelNode.getComponent(Label)) != null ? _directChildLabelNode : (_this$findDeep = this.findDeep(this.errorPanel, 'Label')) == null ? void 0 : _this$findDeep.getComponent(Label)) != null ? _ref3 : this.errorPanel.getComponentInChildren(Label); // 确认/取消按钮（用于“确认投资”对话框）

            this.errorConfirmNode = this.findDeep(this.errorPanel, 'Confirm');
            this.errorCancelNode = this.findDeep(this.errorPanel, 'Cancel');
            this.errorConfirmBtn = (_ref4 = (_this$errorConfirmNod = (_this$errorConfirmNod2 = this.errorConfirmNode) == null ? void 0 : _this$errorConfirmNod2.getComponent(Button)) != null ? _this$errorConfirmNod : (_this$errorConfirmNod3 = this.errorConfirmNode) == null ? void 0 : _this$errorConfirmNod3.getComponentInChildren(Button)) != null ? _ref4 : null;
            this.errorCancelBtn = (_ref5 = (_this$errorCancelNode = (_this$errorCancelNode2 = this.errorCancelNode) == null ? void 0 : _this$errorCancelNode2.getComponent(Button)) != null ? _this$errorCancelNode : (_this$errorCancelNode3 = this.errorCancelNode) == null ? void 0 : _this$errorCancelNode3.getComponentInChildren(Button)) != null ? _ref5 : null;

            if (this.errorConfirmBtn) {
              this.errorConfirmBtn.node.on(Button.EventType.CLICK, this.onErrorConfirmClick, this);
            }

            if (this.errorCancelBtn) {
              this.errorCancelBtn.node.on(Button.EventType.CLICK, this.onErrorCancelClick, this);
            } // 进场时按钮默认隐藏


            if (this.errorConfirmNode) this.errorConfirmNode.active = false;
            if (this.errorCancelNode) this.errorCancelNode.active = false; // 进场时保持隐藏，只有有错误时才短暂显示

            this.errorPanel.active = false;
          }

          this.viewHistoryBtn = g('ViewInvestmentReturnHistory');
          this.bindViewHistoryTrigger(); // InvestmentReturnHistory 看板节点（场景内已布置好，直接复用，不动态新建面板）

          this.investmentReturnHistoryPanel = g('InvestmentReturnHistory');

          if (this.investmentReturnHistoryPanel) {
            var _ref6, _totalNode$getCompone, _ref7, _this$investmentRetur, _this$investmentRetur2, _this$investmentRetur3, _this$investmentRetur4, _this$investmentRetur5;

            var totalNode = this.findDeep(this.investmentReturnHistoryPanel, 'Number');
            this.investmentReturnHistoryTotalLabel = (_ref6 = (_totalNode$getCompone = totalNode == null ? void 0 : totalNode.getComponent(Label)) != null ? _totalNode$getCompone : totalNode == null ? void 0 : totalNode.getComponentInChildren(Label)) != null ? _ref6 : null;
            this.investmentReturnHistoryHistoryProtoNode = this.findDeep(this.investmentReturnHistoryPanel, 'History');
            this.investmentReturnHistoryHistoryProtoLabel = (_ref7 = (_this$investmentRetur = (_this$investmentRetur2 = this.investmentReturnHistoryHistoryProtoNode) == null ? void 0 : _this$investmentRetur2.getComponent(Label)) != null ? _this$investmentRetur : (_this$investmentRetur3 = this.investmentReturnHistoryHistoryProtoNode) == null ? void 0 : _this$investmentRetur3.getComponentInChildren(Label)) != null ? _ref7 : null;
            this.investmentReturnHistoryHistoryParent = (_this$investmentRetur4 = (_this$investmentRetur5 = this.investmentReturnHistoryHistoryProtoNode) == null ? void 0 : _this$investmentRetur5.parent) != null ? _this$investmentRetur4 : null; // 面板内部的返回按钮：关闭看板即可

            var panelBack = this.findDeep(this.investmentReturnHistoryPanel, 'BackControl');

            if (panelBack) {
              var _panelBack$getCompone;

              var _btn = (_panelBack$getCompone = panelBack.getComponent(Button)) != null ? _panelBack$getCompone : panelBack.getComponentInChildren(Button);

              if (_btn) {
                _btn.node.on(Button.EventType.CLICK, this.onBackControl, this);
              } else {
                panelBack.on(Node.EventType.TOUCH_END, this.onBackControl, this);
              }
            } // 防御：场景里默认 active=false，确保脚本逻辑一致


            this.investmentReturnHistoryPanel.active = false;
          } // Back 按钮：关闭 MiniGame2 面板


          this.backControlNode = g('BackControl');
          var back = this.backControlNode;

          if (back) {
            var _back$getComponent;

            var _btn2 = (_back$getComponent = back.getComponent(Button)) != null ? _back$getComponent : back.getComponentInChildren(Button);

            if (_btn2) {
              this._backBtnNode = _btn2.node;

              _btn2.node.on(Button.EventType.CLICK, this.onBackControl, this);
            } else {
              this._backBtnNode = back;
              back.on(Node.EventType.TOUCH_END, this.onBackControl, this);
            }
          }
        }

        findDeep(root, name) {
          if (root.name === name) return root;

          for (var c of root.children) {
            var r = this.findDeep(c, name);
            if (r) return r;
          }

          return null;
        }

        bindViewHistoryTrigger() {
          var _this$viewHistoryBtn$;

          if (!this.viewHistoryBtn) return;
          var btn = (_this$viewHistoryBtn$ = this.viewHistoryBtn.getComponent(Button)) != null ? _this$viewHistoryBtn$ : this.viewHistoryBtn.getComponentInChildren(Button); // 防止重复绑定（onEnable 会兜底再次调用）

          if (btn) {
            btn.node.off(Button.EventType.CLICK, this.openInvestmentReturnHistoryPanel, this);
            btn.node.on(Button.EventType.CLICK, this.openInvestmentReturnHistoryPanel, this);
          }

          this.viewHistoryBtn.off(Node.EventType.TOUCH_END, this.openInvestmentReturnHistoryPanel, this);
          this.viewHistoryBtn.on(Node.EventType.TOUCH_END, this.openInvestmentReturnHistoryPanel, this);
        }

        fmtHMS(sec) {
          var s = Math.max(0, Math.floor(sec));
          var h = Math.floor(s / 3600);
          var m = Math.floor(s % 3600 / 60);
          var r = s % 60;

          var p = n => n < 10 ? "0" + n : "" + n;

          return h + ":" + p(m) + ":" + p(r);
        }

        parseServerTimeToMs(serverTime) {
          var s = String(serverTime || '').trim(); // YYYY-MM-DD HH:mm:ss

          var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
          if (!m) return null;
          var y = parseInt(m[1], 10);
          var mo = parseInt(m[2], 10) - 1;
          var d = parseInt(m[3], 10);
          var h = parseInt(m[4], 10);
          var mi = parseInt(m[5], 10);
          var se = parseInt(m[6], 10); // server_time 是 Asia/Shanghai 的本地时间（无时区字符串），这里按 UTC+8 还原到 epoch，避免客户端时区不同导致倒计时偏差

          var utcMs = Date.UTC(y, mo, d, h, mi, se);
          var shanghaiOffsetMs = 8 * 3600 * 1000;
          var ms = utcMs - shanghaiOffsetMs;
          return Number.isFinite(ms) ? ms : null;
        }

        refreshCountdown() {
          var _this$countdownLabel;

          if (!this._roundCloseMs || !this._serverTimeBaseMs) return;
          if (!((_this$countdownLabel = this.countdownLabel) != null && _this$countdownLabel.isValid)) return;

          var nowMs = this._serverTimeBaseMs + (Date.now() - this._serverTimeRecvAtMs);

          var remaining = Math.floor((this._roundCloseMs - nowMs) / 1000);
          this.countdownLabel.string = this.fmtHMS(remaining);
        }

        ensureOptionItemsReady() {
          var _this2 = this;

          return _asyncToGenerator(function* () {
            if (_this2.optionItems.length > 0) return;
            if (_this2._optionItemsLoading) return;
            if (!_this2.optionContent) return;
            _this2._optionItemsLoading = true;
            var prefab = yield _this2.ensureOptionItemPrefab(); // 清空旧项（content 下理论上为空；但为了多次 mount 也要防御）

            try {
              _this2.optionContent.removeAllChildren();

              _this2.optionItems = [];

              var _loop = function* _loop(cat) {
                if (prefab) {
                  var _labelNode$getCompone, _node$getComponent, _node$getComponent2;

                  var node = instantiate(prefab);

                  _this2.optionContent.addChild(node);

                  var labelNode = _this2.findDeep(node, 'Label');

                  var labelComp = (_labelNode$getCompone = labelNode == null ? void 0 : labelNode.getComponent(Label)) != null ? _labelNode$getCompone : node.getComponentInChildren(Label);
                  var btnComp = (_node$getComponent = node.getComponent(Button)) != null ? _node$getComponent : node.getComponentInChildren(Button);
                  var spriteComp = (_node$getComponent2 = node.getComponent(Sprite)) != null ? _node$getComponent2 : node.getComponentInChildren(Sprite);
                  if (!btnComp || !labelComp) return 1; // continue

                  labelComp.string = cat.name + " X " + cat.multiplier;
                  var item = {
                    key: cat.key,
                    btn: btnComp,
                    label: labelComp,
                    node,
                    sprite: spriteComp,
                    // Button 的 normalSprite / pressedSprite 在运行时可直接访问
                    normalSprite: btnComp.normalSprite,
                    pressedSprite: btnComp.pressedSprite
                  };

                  _this2.optionItems.push(item);

                  btnComp.node.on(Button.EventType.CLICK, () => {
                    var _this2$_lastPayload, _this2$_lastPayload2;

                    // 允许同一期持续下注，只要未开奖且仍在投注时间内
                    if ((_this2$_lastPayload = _this2._lastPayload) != null && _this2$_lastPayload.round_drawn) return;
                    if (((_this2$_lastPayload2 = _this2._lastPayload) == null ? void 0 : _this2$_lastPayload2.seconds_until_close) !== undefined && _this2._lastPayload.seconds_until_close <= 0) return;
                    _this2.selectedKey = cat.key;
                    if (_this2.currentSelectionLabel) _this2.currentSelectionLabel.string = cat.name;

                    _this2.updateOptionVisual();
                  }, _this2);
                } else {
                  // 降级渲染：Prefab 加载失败时，仍生成可点击项（保证玩法通路）
                  var _node = new Node(cat.key);

                  var ui = _node.addComponent(UITransform);

                  ui.setAnchorPoint(v2(0.5, 0.5));
                  ui.setContentSize(120, 40);

                  var label = _node.addComponent(Label);

                  label.string = cat.name + " X " + cat.multiplier;
                  label.fontSize = 20;
                  label.horizontalAlign = 1; // CENTER

                  label.verticalAlign = 1; // CENTER

                  var btn = _node.addComponent(Button);

                  _this2.optionContent.addChild(_node);

                  var _item = {
                    key: cat.key,
                    btn,
                    label,
                    node: _node
                  };

                  _this2.optionItems.push(_item);

                  btn.node.on(Button.EventType.CLICK, () => {
                    var _this2$_lastPayload3, _this2$_lastPayload4;

                    if ((_this2$_lastPayload3 = _this2._lastPayload) != null && _this2$_lastPayload3.round_drawn) return;
                    if (((_this2$_lastPayload4 = _this2._lastPayload) == null ? void 0 : _this2$_lastPayload4.seconds_until_close) !== undefined && _this2._lastPayload.seconds_until_close <= 0) return;
                    _this2.selectedKey = cat.key;
                    if (_this2.currentSelectionLabel) _this2.currentSelectionLabel.string = cat.name;

                    _this2.updateOptionVisual();
                  }, _this2);
                }
              };

              for (var cat of CATEGORIES) {
                if (yield* _loop(cat)) continue;
              } // 默认选中第一档


              if (!_this2.selectedKey && _this2.optionItems.length > 0) _this2.selectedKey = _this2.optionItems[0].key;

              if (_this2.currentSelectionLabel && _this2.selectedKey) {
                var _cat = CATEGORIES.find(c => c.key === _this2.selectedKey);

                if (_cat) _this2.currentSelectionLabel.string = _cat.name;
              }
            } finally {
              _this2._optionItemsLoading = false;
            }
          })();
        }

        ensureOptionItemPrefab() {
          var _this3 = this;

          return _asyncToGenerator(function* () {
            if (_this3.optionItemPrefab) return _this3.optionItemPrefab; // 尝试从外部资源路径加载（如果你没在编辑器里填 prefab，这里兜底）

            var tryLoad = () => new Promise(resolve => {
              assetManager.loadAny({
                path: 'UIPrefab/MiniGame2ListPrefab',
                type: Prefab
              }, (err, asset) => {
                if (err) {
                  console.warn('[MiniGame2] load MiniGame2ListPrefab failed:', err);
                  resolve(null);
                  return;
                }

                resolve(asset);
              });
            });

            _this3.optionItemPrefab = yield tryLoad();
            return _this3.optionItemPrefab;
          })();
        }

        ensureInvestmentReturnHistoryPanelReady() {
          // 面板应当已经在场景里存在：InvestmentReturnHistory（active 默认 false）
          if (!this.investmentReturnHistoryPanel) {
            this.investmentReturnHistoryPanel = this.findDeep(this.node, 'InvestmentReturnHistory');
          }

          if (this.investmentReturnHistoryPanel && !this.investmentReturnHistoryTotalLabel) {
            var _ref8, _totalNode$getCompone2;

            var totalNode = this.findDeep(this.investmentReturnHistoryPanel, 'Number');
            this.investmentReturnHistoryTotalLabel = (_ref8 = (_totalNode$getCompone2 = totalNode == null ? void 0 : totalNode.getComponent(Label)) != null ? _totalNode$getCompone2 : totalNode == null ? void 0 : totalNode.getComponentInChildren(Label)) != null ? _ref8 : null;
          }

          if (this.investmentReturnHistoryPanel && !this.investmentReturnHistoryHistoryProtoNode) {
            var _ref9, _this$investmentRetur6, _this$investmentRetur7, _this$investmentRetur8, _this$investmentRetur9, _this$investmentRetur10;

            this.investmentReturnHistoryHistoryProtoNode = this.findDeep(this.investmentReturnHistoryPanel, 'History');
            this.investmentReturnHistoryHistoryProtoLabel = (_ref9 = (_this$investmentRetur6 = (_this$investmentRetur7 = this.investmentReturnHistoryHistoryProtoNode) == null ? void 0 : _this$investmentRetur7.getComponent(Label)) != null ? _this$investmentRetur6 : (_this$investmentRetur8 = this.investmentReturnHistoryHistoryProtoNode) == null ? void 0 : _this$investmentRetur8.getComponentInChildren(Label)) != null ? _ref9 : null;
            this.investmentReturnHistoryHistoryParent = (_this$investmentRetur9 = (_this$investmentRetur10 = this.investmentReturnHistoryHistoryProtoNode) == null ? void 0 : _this$investmentRetur10.parent) != null ? _this$investmentRetur9 : null;
          }
        }

        closeInvestmentReturnHistoryPanel() {
          this.investmentReturnHistoryOpen = false;

          if (this.investmentReturnHistoryDynamicNodes.length > 0) {
            for (var n of this.investmentReturnHistoryDynamicNodes) n.destroy();

            this.investmentReturnHistoryDynamicNodes = [];
          }

          if (this.investmentReturnHistoryPanel) this.investmentReturnHistoryPanel.active = false; // 回到主玩法交互态（基于最新 sync）

          if (this._lastPayload) this.applyPayload(this._lastPayload);
        }

        requestInvestmentReturnHistory() {
          var _this4 = this;

          return _asyncToGenerator(function* () {
            if (_this4._requestingHistory) return;
            _this4._requestingHistory = true;

            _this4.ws.request('minigame2_return_history_sync', {}, resp => {
              var _resp$message2;

              _this4._requestingHistory = false;

              if (resp != null && resp.success && resp != null && resp.data) {
                _this4.populateInvestmentReturnHistory(resp.data);

                return;
              }

              var msg = String((_resp$message2 = resp == null ? void 0 : resp.message) != null ? _resp$message2 : '获取回报历史失败').replace(/\\n/g, '\n');

              _this4.showError(msg);
            }, true, 15000);
          })();
        }

        populateInvestmentReturnHistory(data) {
          var _data$total_profit;

          var total = Math.floor(Number((_data$total_profit = data == null ? void 0 : data.total_profit) != null ? _data$total_profit : 0));

          if (this.investmentReturnHistoryTotalLabel) {
            // 文案改为“最近收益：0”（最近若干期总和），避免与自然日强绑定引起困惑
            this.investmentReturnHistoryTotalLabel.string = "\u6700\u8FD1\u6536\u76CA\uFF1A" + total;
          }

          if (!this.investmentReturnHistoryHistoryProtoLabel) return; // 清掉之前的动态行（即使以后不再创建，也安全防御一下）

          if (this.investmentReturnHistoryDynamicNodes.length > 0) {
            for (var n of this.investmentReturnHistoryDynamicNodes) n.destroy();

            this.investmentReturnHistoryDynamicNodes = [];
          }

          var list = Array.isArray(data == null ? void 0 : data.history) ? data.history : [];

          if (list.length === 0) {
            this.investmentReturnHistoryHistoryProtoLabel.string = '暂无记录';
            return;
          }

          var formatLine = (timeKeyOrHm, catName, profit) => {
            // 显示“开奖时间键”YYYYMMDDHH（例如 2026040100），更直观地表达跨日 00:00 的那一档。
            // 若服务端没返回 close_time_key，则回退到 HH:mm。
            return "[" + timeKeyOrHm + "] \u5F00       " + catName + "        \u6536\u76CA " + profit + " ";
          };

          var lines = [];

          for (var it of list) {
            var _ref10, _it$close_time_key, _ref11, _it$winner_category_n, _it$profit;

            var timeKeyOrHm = String((_ref10 = (_it$close_time_key = it == null ? void 0 : it.close_time_key) != null ? _it$close_time_key : it == null ? void 0 : it.close_time_hm) != null ? _ref10 : '');
            var catName = String((_ref11 = (_it$winner_category_n = it == null ? void 0 : it.winner_category_name) != null ? _it$winner_category_n : it == null ? void 0 : it.winner_key) != null ? _ref11 : '');
            var profit = Math.floor(Number((_it$profit = it == null ? void 0 : it.profit) != null ? _it$profit : 0));
            lines.push(formatLine(timeKeyOrHm, catName, profit));
          }

          this.investmentReturnHistoryHistoryProtoLabel.string = lines.join('\n');
        }

        requestSync() {
          if (!this.ws.isConnected()) return;
          this.ws.request('minigame2_sync', {}, resp => {
            if (resp != null && resp.success && resp != null && resp.data) {
              this.applyPayload(resp.data);
            }
          }, true, 12000);
        }

        applyPayload(p) {
          var _p$energy_blocks, _p$seconds_until_clos2, _p$seconds_until_clos3;

          this._lastPayload = p; // 当前期数：issue_key 是轮次开始时间（YYYYMMDDHH）

          if (this.currentIssueLabel) {
            var _p$issue_key;

            var ik = String((_p$issue_key = p.issue_key) != null ? _p$issue_key : '').trim();
            this.currentIssueLabel.string = ik ? "\u5F53\u524D\u671F\uFF1A" + ik : '当前期：-';
          } // 本期已投资明细：多类目累计


          if (this.myBetsLabel) {
            var bets = Array.isArray(p.my_bets) ? p.my_bets : [];

            if (bets.length === 0) {
              this.myBetsLabel.string = '本期已投资：无';
            } else {
              var lines = [];

              var _loop2 = function _loop2() {
                var _selected_key, _bet_amount;

                var key = String((_selected_key = b == null ? void 0 : b.selected_key) != null ? _selected_key : '').trim();
                var amt = Math.floor(Number((_bet_amount = b == null ? void 0 : b.bet_amount) != null ? _bet_amount : 0));
                if (!key || !Number.isFinite(amt) || amt <= 0) return 1; // continue

                var cat = CATEGORIES.find(c => c.key === key);
                var name = cat ? cat.name : key;
                lines.push(name + " x " + amt);
              };

              for (var b of bets) {
                if (_loop2()) continue;
              }

              this.myBetsLabel.string = lines.length ? "\u672C\u671F\u5DF2\u6295\u8D44\uFF1A" + lines.join('，') : '本期已投资：无';
            }
          }

          var energyStr = String((_p$energy_blocks = p.energy_blocks) != null ? _p$energy_blocks : 0);
          if (this.energyAvailableLabel) this.energyAvailableLabel.string = energyStr;
          if (this.topEnergyLabel) this.topEnergyLabel.string = energyStr; // 倒计时刷新基准

          if (p.server_time) {
            var parsed = this.parseServerTimeToMs(p.server_time);

            if (parsed != null) {
              var _p$seconds_until_clos;

              this._serverTimeBaseMs = parsed;
              this._serverTimeRecvAtMs = Date.now();
              this._roundCloseMs = parsed + ((_p$seconds_until_clos = p.seconds_until_close) != null ? _p$seconds_until_clos : 0) * 1000;
            }
          }

          if (this.countdownLabel) this.countdownLabel.string = this.fmtHMS((_p$seconds_until_clos2 = p.seconds_until_close) != null ? _p$seconds_until_clos2 : 0); // 初始化选项 UI（只做一次）

          this.ensureOptionItemsReady(); // 下注状态：支持本期持续下注，只要未开奖且仍在投注时间内

          var canBetBase = !p.round_drawn && ((_p$seconds_until_clos3 = p.seconds_until_close) != null ? _p$seconds_until_clos3 : 0) > 0; // 面板打开时禁止下注交互

          var canBet = canBetBase && !this.investmentReturnHistoryOpen; // 多类目下注：不再强行用“我已下注的类目”覆盖当前选中项，避免你投了多个后 UI 跳来跳去
          // 保持选中类目的“按下状态”高亮

          this.updateOptionVisual(); // 启用/禁用输入与选项

          if (this.editBox) {
            // EditBox：直接用 enabled 来禁用编辑
            this.editBox.enabled = canBet;
          }

          for (var item of this.optionItems) {
            item.btn.interactable = canBet;
          }

          if (this.confirmButtonComp) {
            this.confirmButtonComp.interactable = canBet && this.selectedKey != null;
          }
        }

        showError(text) {
          console.warn('[MiniGame2]', text);
          if (!this.errorPanel) return; // 若之前没找到 Label，这里再兜底找一次，优先直系子节点名为 "Label" 的主文案

          if (!this.errorLabel) {
            var _this$errorPanel$chil2, _ref12, _directChildLabelNode2, _this$findDeep2;

            var directChildLabelNode = (_this$errorPanel$chil2 = this.errorPanel.children.find(c => c.name === 'Label')) != null ? _this$errorPanel$chil2 : null;
            this.errorLabel = (_ref12 = (_directChildLabelNode2 = directChildLabelNode == null ? void 0 : directChildLabelNode.getComponent(Label)) != null ? _directChildLabelNode2 : (_this$findDeep2 = this.findDeep(this.errorPanel, 'Label')) == null ? void 0 : _this$findDeep2.getComponent(Label)) != null ? _ref12 : this.errorPanel.getComponentInChildren(Label);
          }

          if (!this.errorLabel) return; // 错误提示：只显示文案，隐藏确认/取消按钮

          if (this.errorConfirmNode) this.errorConfirmNode.active = false;
          if (this.errorCancelNode) this.errorCancelNode.active = false;
          this.errorLabel.string = text;
          if (this.mainTipLabel) this.mainTipLabel.string = text;
          this.errorPanel.active = true;
          setTimeout(() => {
            var _this$errorPanel;

            if ((_this$errorPanel = this.errorPanel) != null && _this$errorPanel.isValid) this.errorPanel.active = false;
          }, 1400);
        }

        showConfirmInvest(text, amount, key) {
          if (!this.errorPanel) return;
          this._pendingBetAmount = amount;
          this._pendingBetKey = key;

          if (!this.errorLabel) {
            var _this$errorPanel$chil3, _ref13, _ref14, _directChildLabelNode3, _this$findDeep3;

            var directChildLabelNode = (_this$errorPanel$chil3 = this.errorPanel.children.find(c => c.name === 'Label')) != null ? _this$errorPanel$chil3 : null;
            this.errorLabel = (_ref13 = (_ref14 = (_directChildLabelNode3 = directChildLabelNode == null ? void 0 : directChildLabelNode.getComponent(Label)) != null ? _directChildLabelNode3 : (_this$findDeep3 = this.findDeep(this.errorPanel, 'Label')) == null ? void 0 : _this$findDeep3.getComponent(Label)) != null ? _ref14 : this.errorPanel.getComponentInChildren(Label)) != null ? _ref13 : null;
          }

          if (!this.errorLabel) return;
          this.errorLabel.string = text;
          if (this.mainTipLabel) this.mainTipLabel.string = text;
          if (this.errorConfirmNode) this.errorConfirmNode.active = true;
          if (this.errorCancelNode) this.errorCancelNode.active = true;
          this.errorPanel.active = true;
        }

        onConfirmInvestmentClick() {
          var _this$editBox$string;

          if (!this.ws.isConnected()) {
            this.showError('网络未连接');
            return;
          }

          if (this._requestingBet) return;
          var payload = this._lastPayload;
          if (!payload) return;

          if (payload.round_drawn || payload.seconds_until_close <= 0) {
            this.showError('已到开奖时间');
            return;
          }

          if (!this.editBox) {
            this.showError('缺少投资输入框');
            return;
          }

          var raw = ((_this$editBox$string = this.editBox.string) != null ? _this$editBox$string : '').trim();
          var amt = Math.floor(Number(raw));

          if (!Number.isFinite(amt) || amt < MIN_BET_AMOUNT || amt > MAX_BET_AMOUNT) {
            this.showError("\u65E0\u6548\u4E0B\u6CE8\u91D1\u989D\uFF08\u8303\u56F4 " + MIN_BET_AMOUNT + "-" + MAX_BET_AMOUNT + "\uFF09");
            return;
          }

          if (!this.selectedKey) {
            this.showError('请选择期货类目');
            return;
          }

          var cat = CATEGORIES.find(c => c.key === this.selectedKey);
          var catName = cat ? cat.name : this.selectedKey;
          this.showConfirmInvest("\u786E\u8BA4\u6295\u8D44 " + amt + " \u5230 " + catName + " \u5417\uFF1F", amt, this.selectedKey);
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "optionItemPrefab", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "currentIssueLabel", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "myBetsLabel", [_dec4], {
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
//# sourceMappingURL=5bf7d0caa3adec1e0f8b78b3516816f1a24fe5e8.js.map