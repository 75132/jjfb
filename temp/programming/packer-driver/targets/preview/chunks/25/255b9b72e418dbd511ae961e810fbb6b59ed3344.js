System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Label, Button, WebSocketManager, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _dec14, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _descriptor13, _crd, ccclass, property, REQUIRED_SECONDS, DALETOU_SYNC_INTERVAL_SEC, RESULT_TIP, MiniGame1;

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
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "fc10cPbOzpEOLuXMiFADzsN", "MiniGame1", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Label', 'Button']);

      ({
        ccclass,
        property
      } = _decorator);
      REQUIRED_SECONDS = 3 * 60 * 60;
      /** 与服务器校验大乐透状态；在线秒数建议 30s 上传一次，减少波动且符合防刷上限 45s */

      DALETOU_SYNC_INTERVAL_SEC = 30;
      /** 今日开奖结果说明（完整文案） */

      RESULT_TIP = {
        1: '未获得参与资格\n您今日尚未获得参与资格，暂无法查看个人开奖详情。领取资格需满足：当日在线满 3 小时，每日仅可参与 1 次。',
        2: '已获得资格但未参与\n您今日已获得参与资格，但尚未参与抽奖，暂无法查看个人开奖结果。请在下次开奖前完成参与。',
        3: '已参与但未中奖\n您今日已参与抽奖，本次未中奖。感谢您的参与，明日 24:00 将开启新一轮抽奖。',
        4: '已参与且中奖\n恭喜您！今日成功中得头奖，1000 能量块已发放至您的账户。',
        5: '未到开奖时间\n今日开奖尚未开始，请在 24:00 后再次查看开奖结果。'
      };

      _export("MiniGame1", MiniGame1 = (_dec = ccclass('MiniGame1'), _dec2 = property({
        type: Label,
        tooltip: '能量块'
      }), _dec3 = property({
        type: Label
      }), _dec4 = property({
        type: Label
      }), _dec5 = property({
        type: Label
      }), _dec6 = property({
        type: Label
      }), _dec7 = property({
        type: Node
      }), _dec8 = property({
        type: Label
      }), _dec9 = property({
        type: Node
      }), _dec10 = property({
        type: Node
      }), _dec11 = property({
        type: Label
      }), _dec12 = property({
        type: Label
      }), _dec13 = property({
        type: Label
      }), _dec14 = property({
        type: Node
      }), _dec(_class = (_class2 = class MiniGame1 extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "energyLabel", _descriptor, this);

          _initializerDefineProperty(this, "onlineTimeLabel", _descriptor2, this);

          _initializerDefineProperty(this, "timeUntilEligibleLabel", _descriptor3, this);

          _initializerDefineProperty(this, "participateEligibleLabel", _descriptor4, this);

          _initializerDefineProperty(this, "nowTimeLabel", _descriptor5, this);

          _initializerDefineProperty(this, "errorPanel", _descriptor6, this);

          /** Error 弹窗内提示文案（未绑定时自动查找 Error 下名为 Label 的节点） */
          _initializerDefineProperty(this, "errorTipLabel", _descriptor7, this);

          _initializerDefineProperty(this, "todayLotteryResultPanel", _descriptor8, this);

          /** 领取成功提示（可与 Error 同结构；未放场景时回退用 Error 面板） */
          _initializerDefineProperty(this, "claimSuccessPanel", _descriptor9, this);

          _initializerDefineProperty(this, "claimSuccessTipLabel", _descriptor10, this);

          _initializerDefineProperty(this, "resultPlayerNameLabel", _descriptor11, this);

          _initializerDefineProperty(this, "resultTipLabel", _descriptor12, this);

          _initializerDefineProperty(this, "backControlNode", _descriptor13, this);

          this.ws = null;
          this._lastPayload = null;
          this._errorCloseTimer = -1;
          this._successCloseTimer = -1;
          this._claimWatchdogTimer = -1;
          this._mainClaimRequesting = false;

          /** 当前弹窗状态：确保同一时间只有一个面板处于 active，减少“混乱感”。 */
          this._popupState = 'none';

          /** NowTime：以服务端 server_time 为基准平滑推算（确保动态）。 */
          this._serverTimeBaseMs = null;
          this._serverTimeRecvAtMs = 0;

          /** 用于本地估算：上次成功 daletou_sync 的在线秒数基准 */
          this._lastSyncRecvAtMs = 0;
          this._lastSyncOnlineSecondsBase = 0;
          this._lastSyncDayKey = '';
          this._autoSyncedForEligibility = false;

          /** 主界面「参与」按钮上的文案节点（ClaimParticipateQual 下 Label） */
          this.mainClaimButtonLabel = null;

          /** 主界面期号 */
          this.mainIssueNumLabel = null;

          /** 开奖结果弹窗期号 */
          this.resultIssueNumLabel = null;
          this._mainClaimBtnNode = null;
          this._viewResultBtnNode = null;
          this._innerClaimBtnNode = null;
          this._backCtrlBtnNode = null;

          /** 定时同步（不能用 schedule(this.requestSync)：引擎会把 dt 当作第一个参数传给 requestSync，误当成 done 回调） */
          this._scheduledSyncTick = () => {
            this.requestSync();
          };

          this.onMainClaimClick = () => {
            var _this$_lastPayload$se, _this$_lastPayload, _this$_lastPayload2;

            if (!this.ws.isConnected()) {
              this.showErrorAutoClose('网络未连接\n请连接后重试');
              return;
            }

            if (this._mainClaimRequesting) return;
            var sec = (_this$_lastPayload$se = (_this$_lastPayload = this._lastPayload) == null ? void 0 : _this$_lastPayload.seconds_until_eligible) != null ? _this$_lastPayload$se : REQUIRED_SECONDS;

            if (sec > 0) {
              this.showErrorAutoClose("\u672A\u83B7\u5F97\u53C2\u4E0E\u8D44\u683C\n\u5F53\u65E5\u5728\u7EBF\u6EE13\u5C0F\u65F6\u624D\u53EF\u9886\u53D6\uFF0C\u7EA6\u8FD8\u5DEE" + this.fmtDuration(sec));
              return;
            }

            if ((_this$_lastPayload2 = this._lastPayload) != null && _this$_lastPayload2.claimed) {
              this.showErrorAutoClose('今日已领取\n无需重复领取');
              return;
            }

            this._mainClaimRequesting = true;
            this.setMainClaimInteractable(false);
            if (this._claimWatchdogTimer >= 0) clearTimeout(this._claimWatchdogTimer); // 兜底：避免极端情况下回调未触发，导致按钮永久不可点

            this._claimWatchdogTimer = window.setTimeout(() => {
              var _this$_lastPayload$cl, _this$_lastPayload3;

              this._mainClaimRequesting = false;
              this.setMainClaimInteractable(!((_this$_lastPayload$cl = (_this$_lastPayload3 = this._lastPayload) == null ? void 0 : _this$_lastPayload3.claimed) != null ? _this$_lastPayload$cl : false));
              this._claimWatchdogTimer = -1;
            }, 16000);
            this.ws.request('daletou_claim', {}, resp => {
              var _this$_lastPayload$cl2, _this$_lastPayload4;

              if (resp != null && resp.success && resp != null && resp.data) {
                var data = resp.data;
                this.applyPayload(data);

                if (data.claimed) {
                  // 成功不再弹 Error/Success 弹窗：只改文字（applyPayload 已把按钮改为“已参与”）
                  this.cancelErrorPopup();
                }
              } else {
                this.showErrorAutoClose(this.formatClaimErrorMessage(resp));
              }

              if (this._claimWatchdogTimer >= 0) {
                clearTimeout(this._claimWatchdogTimer);
                this._claimWatchdogTimer = -1;
              }

              this._mainClaimRequesting = false;
              this.setMainClaimInteractable(!((_this$_lastPayload$cl2 = (_this$_lastPayload4 = this._lastPayload) == null ? void 0 : _this$_lastPayload4.claimed) != null ? _this$_lastPayload$cl2 : false));
            }, true, 15000);
          };

          this.onViewResultClick = () => {
            this.requestSync(() => {
              this.openResultPanel();
            });
          };

          this.closeResultPanel = () => {
            if (this.todayLotteryResultPanel) this.todayLotteryResultPanel.active = false;
            if (this._popupState === 'result') this._popupState = 'none';
          };

          this.onBackControl = () => {
            var _this$todayLotteryRes, _this$claimSuccessPan, _this$errorPanel;

            if ((_this$todayLotteryRes = this.todayLotteryResultPanel) != null && _this$todayLotteryRes.active) {
              this.todayLotteryResultPanel.active = false;
              return;
            }

            if ((_this$claimSuccessPan = this.claimSuccessPanel) != null && _this$claimSuccessPan.active) {
              this.claimSuccessPanel.active = false;

              if (this._successCloseTimer >= 0) {
                clearTimeout(this._successCloseTimer);
                this._successCloseTimer = -1;
              }

              return;
            }

            if ((_this$errorPanel = this.errorPanel) != null && _this$errorPanel.active) {
              this.errorPanel.active = false;

              if (this._errorCloseTimer >= 0) {
                clearTimeout(this._errorCloseTimer);
                this._errorCloseTimer = -1;
              }

              return;
            }

            this.node.active = false;
          };

          this.requestSync = done => {
            if (!this.ws.isConnected()) return;
            this.ws.request('daletou_sync', {}, resp => {
              if (resp != null && resp.success && resp != null && resp.data) {
                this.applyPayload(resp.data);
              }

              done == null || done();
            }, true, 12000);
          };
        }

        /**
         * 从场景根挂载到名为 MiniGame1 的节点（场景未手动绑脚本时使用）
         */
        static mountFromSceneRoot(root) {
          var scene = root.scene;
          if (!scene) return;
          var stack = [...scene.children];

          while (stack.length) {
            var n = stack.pop();

            if (n.name === 'MiniGame1') {
              if (!n.getComponent(MiniGame1)) {
                n.addComponent(MiniGame1);
              }

              return;
            }

            stack.push(...n.children);
          }
        }

        onLoad() {
          this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();
          this.resolveBindings();
          if (this.errorPanel) this.errorPanel.active = false;
          if (this.todayLotteryResultPanel) this.todayLotteryResultPanel.active = false;
          if (this.claimSuccessPanel) this.claimSuccessPanel.active = false;
          this._popupState = 'none';
        }

        start() {
          this.bindButtons();
        }

        onEnable() {
          this.requestSync();
          this.schedule(this._scheduledSyncTick, DALETOU_SYNC_INTERVAL_SEC);
        }
        /** 每帧刷新 NowTime（无固定 1s 步进感）；服务端时间仍由 daletou_sync 定期校准 */


        update() {
          this.refreshNowTimeLabel();
          this.refreshOnlineTimeLabels();
          this.maybeAutoSyncForEligibility();
        }

        onDisable() {
          this.unschedule(this._scheduledSyncTick);
        }

        onDestroy() {
          this.unschedule(this._scheduledSyncTick);

          if (this._errorCloseTimer >= 0) {
            clearTimeout(this._errorCloseTimer);
          }

          if (this._successCloseTimer >= 0) {
            clearTimeout(this._successCloseTimer);
          }

          this.unbindButtons();
        }

        refreshNowTimeLabel() {
          var _this$nowTimeLabel;

          if (!((_this$nowTimeLabel = this.nowTimeLabel) != null && _this$nowTimeLabel.isValid)) return;

          if (this._serverTimeBaseMs != null) {
            var ms = this._serverTimeBaseMs + (Date.now() - this._serverTimeRecvAtMs);

            this.nowTimeLabel.string = this.formatDateToClock(new Date(ms));
            return;
          }

          this.nowTimeLabel.string = this.localClock();
        }
        /** 在线时间/剩余资格：用“上次服务器累计值 + 本地经过时间”持续显示，避免 UI 只隔 sync 才跳。 */


        refreshOnlineTimeLabels() {
          var _this$onlineTimeLabel, _this$timeUntilEligib, _ref, _this$_lastSyncOnline, _this$onlineTimeLabel2, _this$timeUntilEligib2;

          if (!this._lastPayload) return;
          if (!((_this$onlineTimeLabel = this.onlineTimeLabel) != null && _this$onlineTimeLabel.isValid) && !((_this$timeUntilEligib = this.timeUntilEligibleLabel) != null && _this$timeUntilEligib.isValid)) return;
          var base = (_ref = (_this$_lastSyncOnline = this._lastSyncOnlineSecondsBase) != null ? _this$_lastSyncOnline : this._lastPayload.online_seconds) != null ? _ref : 0;
          var recvAt = this._lastSyncRecvAtMs || Date.now();
          var elapsedSec = (Date.now() - recvAt) / 1000; // 服务端每次累计 delta 最高 45s，这里用同样 cap 来估算

          var capped = Math.min(Math.max(elapsedSec, 0), 45);
          var estOnline = base + Math.floor(capped);

          if ((_this$onlineTimeLabel2 = this.onlineTimeLabel) != null && _this$onlineTimeLabel2.isValid) {
            this.onlineTimeLabel.string = this.fmtDuration(estOnline);
          }

          if ((_this$timeUntilEligib2 = this.timeUntilEligibleLabel) != null && _this$timeUntilEligib2.isValid) {
            var need = Math.max(0, REQUIRED_SECONDS - estOnline);
            this.timeUntilEligibleLabel.string = need > 0 ? this.fmtDuration(need) : '已达要求';
          }
        }

        maybeAutoSyncForEligibility() {
          var _this$_lastSyncOnline2;

          var p = this._lastPayload;
          if (!p) return;
          if (p.claimed) return;
          if (!this.ws.isConnected()) return;
          var day = (p.day || '').trim();
          if (!day) return;

          if (this._lastSyncDayKey !== day) {
            // 日切/期切：重置一次自动校验标记
            this._lastSyncDayKey = day;
            this._autoSyncedForEligibility = false;
          }

          if (this._autoSyncedForEligibility) return;
          var base = (_this$_lastSyncOnline2 = this._lastSyncOnlineSecondsBase) != null ? _this$_lastSyncOnline2 : 0;
          var recvAt = this._lastSyncRecvAtMs || Date.now();
          var elapsedSec = (Date.now() - recvAt) / 1000;
          var capped = Math.min(Math.max(elapsedSec, 0), 45);
          var estOnline = base + Math.floor(capped);

          if (estOnline >= REQUIRED_SECONDS) {
            this._autoSyncedForEligibility = true;
            this.requestSync();
          }
        }

        resolveBindings() {
          var _g$getComponent, _g, _g$getComponent2, _g2, _g$getComponent3, _g3, _g$getComponent4, _g4, _g$getComponent5, _g5, _g6, _g7, _g8;

          var g = name => this.findDeep(this.node, name);

          if (!this.energyLabel) this.energyLabel = (_g$getComponent = (_g = g('Energy')) == null ? void 0 : _g.getComponent(Label)) != null ? _g$getComponent : null;
          if (!this.onlineTimeLabel) this.onlineTimeLabel = (_g$getComponent2 = (_g2 = g('OnlineTime')) == null ? void 0 : _g2.getComponent(Label)) != null ? _g$getComponent2 : null;
          if (!this.timeUntilEligibleLabel) this.timeUntilEligibleLabel = (_g$getComponent3 = (_g3 = g('TimeUntilEligible')) == null ? void 0 : _g3.getComponent(Label)) != null ? _g$getComponent3 : null;
          if (!this.participateEligibleLabel) this.participateEligibleLabel = (_g$getComponent4 = (_g4 = g('ParticipateEligible')) == null ? void 0 : _g4.getComponent(Label)) != null ? _g$getComponent4 : null;
          if (!this.nowTimeLabel) this.nowTimeLabel = (_g$getComponent5 = (_g5 = g('NowTime')) == null ? void 0 : _g5.getComponent(Label)) != null ? _g$getComponent5 : null;
          if (!this.errorPanel) this.errorPanel = (_g6 = g('Error')) != null ? _g6 : null;

          if (!this.errorTipLabel && this.errorPanel) {
            var _ln$getComponent;

            var ln = this.findDeep(this.errorPanel, 'Label');
            this.errorTipLabel = (_ln$getComponent = ln == null ? void 0 : ln.getComponent(Label)) != null ? _ln$getComponent : null;
          }

          if (!this.todayLotteryResultPanel) this.todayLotteryResultPanel = (_g7 = g('TodayLotteryResult')) != null ? _g7 : null;
          var tr = this.todayLotteryResultPanel;

          if (!this.resultPlayerNameLabel && tr) {
            var _this$findDeep$getCom, _this$findDeep;

            this.resultPlayerNameLabel = (_this$findDeep$getCom = (_this$findDeep = this.findDeep(tr, 'PlayerName')) == null ? void 0 : _this$findDeep.getComponent(Label)) != null ? _this$findDeep$getCom : null;
          }

          if (!this.resultTipLabel && tr) {
            var _this$findDeep$getCom2, _this$findDeep2;

            this.resultTipLabel = (_this$findDeep$getCom2 = (_this$findDeep2 = this.findDeep(tr, 'Tip')) == null ? void 0 : _this$findDeep2.getComponent(Label)) != null ? _this$findDeep$getCom2 : null;
          }

          if (!this.backControlNode) this.backControlNode = (_g8 = g('BackControl')) != null ? _g8 : null;

          if (!this.claimSuccessPanel) {
            var _ref2, _g9;

            this.claimSuccessPanel = (_ref2 = (_g9 = g('ClaimSuccess')) != null ? _g9 : g('Success')) != null ? _ref2 : null;
          }

          if (!this.claimSuccessTipLabel && this.claimSuccessPanel) {
            var _sl$getComponent;

            var sl = this.findDeep(this.claimSuccessPanel, 'Label');
            this.claimSuccessTipLabel = (_sl$getComponent = sl == null ? void 0 : sl.getComponent(Label)) != null ? _sl$getComponent : null;
          }

          var trPanel = this.todayLotteryResultPanel;
          var claims = [];

          var collectClaim = root => {
            if (root.name === 'ClaimParticipateQual') claims.push(root);

            for (var c of root.children) collectClaim(c);
          };

          collectClaim(this.node);
          var mainClaim = claims.find(n => !this.isUnderPanel(n, trPanel));

          if (mainClaim) {
            if (!this.mainIssueNumLabel) {
              var _this$findDeep$getCom3, _this$findDeep3;

              this.mainIssueNumLabel = (_this$findDeep$getCom3 = (_this$findDeep3 = this.findDeep(mainClaim, 'issueNum')) == null ? void 0 : _this$findDeep3.getComponent(Label)) != null ? _this$findDeep$getCom3 : null;
            }

            if (!this.mainClaimButtonLabel) {
              var _ln$getComponent2;

              var _ln = this.findDeep(mainClaim, 'Label');

              this.mainClaimButtonLabel = (_ln$getComponent2 = _ln == null ? void 0 : _ln.getComponent(Label)) != null ? _ln$getComponent2 : null;
            }
          }

          if (trPanel && !this.resultIssueNumLabel) {
            var _this$findDeep$getCom4, _this$findDeep4;

            this.resultIssueNumLabel = (_this$findDeep$getCom4 = (_this$findDeep4 = this.findDeep(trPanel, 'issueNum')) == null ? void 0 : _this$findDeep4.getComponent(Label)) != null ? _this$findDeep$getCom4 : null;
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

        isUnderPanel(node, panel) {
          if (!panel) return false;
          var p = node.parent;

          while (p) {
            if (p === panel) return true;
            p = p.parent;
          }

          return false;
        }

        bindButtons() {
          var claims = [];

          var collect = root => {
            if (root.name === 'ClaimParticipateQual') claims.push(root);

            for (var c of root.children) collect(c);
          };

          collect(this.node);
          var tr = this.todayLotteryResultPanel;
          var mainClaim = claims.find(n => !this.isUnderPanel(n, tr));
          var innerClaim = claims.find(n => this.isUnderPanel(n, tr));
          this._mainClaimBtnNode = mainClaim != null ? mainClaim : null;

          if (mainClaim) {
            var b = mainClaim.getComponent(Button);
            if (b) b.node.on(Button.EventType.CLICK, this.onMainClaimClick, this);else mainClaim.on(Node.EventType.TOUCH_END, this.onMainClaimClick, this);
          }

          var viewResult = this.findDeep(this.node, 'ViewTodayLotteryResult');
          this._viewResultBtnNode = viewResult;

          if (viewResult) {
            var b2 = viewResult.getComponent(Button);
            if (b2) b2.node.on(Button.EventType.CLICK, this.onViewResultClick, this);else viewResult.on(Node.EventType.TOUCH_END, this.onViewResultClick, this);
          }

          this._innerClaimBtnNode = innerClaim != null ? innerClaim : null;

          if (innerClaim) {
            var b3 = innerClaim.getComponent(Button);
            if (b3) b3.node.on(Button.EventType.CLICK, this.closeResultPanel, this);else innerClaim.on(Node.EventType.TOUCH_END, this.closeResultPanel, this);
          }

          if (this.backControlNode) {
            var bb = this.backControlNode.getComponent(Button);

            if (bb) {
              this._backCtrlBtnNode = bb.node;
              bb.node.on(Button.EventType.CLICK, this.onBackControl, this);
            } else {
              var innerBtn = this.findDeep(this.backControlNode, 'Button');

              if (innerBtn) {
                var ib = innerBtn.getComponent(Button);

                if (ib) {
                  this._backCtrlBtnNode = ib.node;
                  ib.node.on(Button.EventType.CLICK, this.onBackControl, this);
                } else {
                  this._backCtrlBtnNode = innerBtn;
                  innerBtn.on(Node.EventType.TOUCH_END, this.onBackControl, this);
                }
              } else {
                this._backCtrlBtnNode = this.backControlNode;
                this.backControlNode.on(Node.EventType.TOUCH_END, this.onBackControl, this);
              }
            }
          }
        }

        unbindButtons() {
          var offClick = (btnNode, handler) => {
            if (!(btnNode != null && btnNode.isValid)) return;
            var b = btnNode.getComponent(Button);
            if (b) b.node.off(Button.EventType.CLICK, handler, this);else btnNode.off(Node.EventType.TOUCH_END, handler, this);
          };

          offClick(this._mainClaimBtnNode, this.onMainClaimClick);
          offClick(this._viewResultBtnNode, this.onViewResultClick);
          offClick(this._innerClaimBtnNode, this.closeResultPanel);
          offClick(this._backCtrlBtnNode, this.onBackControl);
        }

        hideAllPopups() {
          if (this.todayLotteryResultPanel) this.todayLotteryResultPanel.active = false;
          if (this.claimSuccessPanel) this.claimSuccessPanel.active = false;
          if (this.errorPanel) this.errorPanel.active = false;
          if (this._errorCloseTimer >= 0) clearTimeout(this._errorCloseTimer);
          if (this._successCloseTimer >= 0) clearTimeout(this._successCloseTimer);
          this._errorCloseTimer = -1;
          this._successCloseTimer = -1;
          this._popupState = 'none';
        }

        setMainClaimInteractable(enabled) {
          var _this$_mainClaimBtnNo;

          var btn = (_this$_mainClaimBtnNo = this._mainClaimBtnNode) == null ? void 0 : _this$_mainClaimBtnNo.getComponent(Button);
          if (btn) btn.interactable = enabled;
        }

        cancelErrorPopup() {
          if (!this.errorPanel) return;
          if (this.errorPanel.active) this.errorPanel.active = false;

          if (this._errorCloseTimer >= 0) {
            clearTimeout(this._errorCloseTimer);
            this._errorCloseTimer = -1;
          }

          if (this._popupState === 'error') this._popupState = 'none';
        }

        /** 多行/长文案自动延长展示时间，避免读不完就关闭 */
        errorPopupDurationMs(text) {
          var lines = text.split('\n').length;
          var len = text.length;
          var base = 2500;
          var extraLines = Math.max(0, lines - 1) * 550;
          var extraChars = Math.max(0, len - 48) * 22;
          return Math.min(5600, base + extraLines + extraChars);
        }
        /**
         * Error 弹窗：建议两行——第一行结论，第二行说明（与场景里 Label 换行一致）。
         */


        showErrorAutoClose(text) {
          if (!this.errorPanel) return;
          this.hideAllPopups();
          if (this.errorTipLabel) this.errorTipLabel.string = text;
          this.errorPanel.active = true;
          this._popupState = 'error';
          if (this._errorCloseTimer >= 0) clearTimeout(this._errorCloseTimer);
          var ms = this.errorPopupDurationMs(text);
          this._errorCloseTimer = window.setTimeout(() => {
            var _this$errorPanel2;

            if ((_this$errorPanel2 = this.errorPanel) != null && _this$errorPanel2.isValid) this.errorPanel.active = false;
            this._errorCloseTimer = -1;
            if (this._popupState === 'error') this._popupState = 'none';
          }, ms);
        }
        /**
         * 领取成功弹窗：优先 ClaimSuccess / Success 节点；若无则用 Error 面板样式（延长展示时间）。
         */


        showClaimSuccess(text) {
          var duration = 2200;
          this.hideAllPopups();

          if (this.claimSuccessPanel && this.claimSuccessTipLabel) {
            this.claimSuccessTipLabel.string = text;
            this.claimSuccessPanel.active = true;
            this._popupState = 'success';
            if (this._successCloseTimer >= 0) clearTimeout(this._successCloseTimer);
            this._successCloseTimer = window.setTimeout(() => {
              var _this$claimSuccessPan2;

              if ((_this$claimSuccessPan2 = this.claimSuccessPanel) != null && _this$claimSuccessPan2.isValid) this.claimSuccessPanel.active = false;
              this._successCloseTimer = -1;
              if (this._popupState === 'success') this._popupState = 'none';
            }, duration);
            return;
          } // 场景未单独做成功弹窗时：沿用 Error 节点，时间略长


          var prev = this._errorCloseTimer;
          if (prev >= 0) clearTimeout(prev);
          if (!this.errorPanel) return;
          if (this.errorTipLabel) this.errorTipLabel.string = text;
          this.errorPanel.active = true;
          this._popupState = 'success';
          this._errorCloseTimer = window.setTimeout(() => {
            var _this$errorPanel3;

            if ((_this$errorPanel3 = this.errorPanel) != null && _this$errorPanel3.isValid) this.errorPanel.active = false;
            this._errorCloseTimer = -1;
            if (this._popupState === 'success') this._popupState = 'none';
          }, duration);
        }
        /** 将服务端 daletou_claim 失败转为可读文案 */


        formatClaimErrorMessage(resp) {
          var _resp$message;

          var msg = String((_resp$message = resp == null ? void 0 : resp.message) != null ? _resp$message : '').trim();
          var code = resp == null ? void 0 : resp.code;

          if (code === 401 || msg.includes('未登录')) {
            return '无法领取\n请先登录游戏';
          }

          if (msg.includes('未选择角色') || msg.includes('no_character')) {
            return '无法领取\n请先选择角色';
          }

          if (msg.includes('未满3小时') || msg.includes('not_enough_online')) {
            return '未获得参与资格\n当日在线未满3小时';
          }

          if (msg.includes('player_not_found') || msg.includes('not_found')) {
            return '领取失败\n角色数据异常，请稍后重试';
          }

          if (msg.includes('already_claimed') || msg.includes('已领取')) {
            return '今日已领取\n无需重复领取';
          }

          if (msg.includes('429') || code === 429) {
            return '操作过于频繁\n请稍后再试';
          }

          if (msg) {
            return "\u9886\u53D6\u5931\u8D25\n" + msg;
          }

          return '领取失败\n请稍后重试';
        }

        applyPayload(d) {
          var _d$online_seconds2, _this$todayLotteryRes2;

          this._lastPayload = d;

          if (this.energyLabel) {
            var eb = d.energy_blocks;
            this.energyLabel.string = eb !== undefined && eb !== null && Number.isFinite(Number(eb)) ? String(eb) : '—';
          }

          if (this.onlineTimeLabel) {
            var _d$online_seconds;

            this.onlineTimeLabel.string = this.fmtDuration((_d$online_seconds = d.online_seconds) != null ? _d$online_seconds : 0);
          }

          if (this.timeUntilEligibleLabel) {
            var _d$seconds_until_elig;

            var need = (_d$seconds_until_elig = d.seconds_until_eligible) != null ? _d$seconds_until_elig : 0;
            this.timeUntilEligibleLabel.string = need > 0 ? this.fmtDuration(need) : '已达要求';
          }

          if (this.participateEligibleLabel) {
            var base = d.claimed ? '已领取' : '未领取';
            var rn = (d.role_name || '').trim();
            this.participateEligibleLabel.string = rn ? base + "\uFF08" + rn + "\uFF09" : base;
          }

          if (this.nowTimeLabel) {
            if (d.server_time) {
              var parsed = this.parseServerTimeToMs(d.server_time);

              if (parsed != null) {
                this._serverTimeBaseMs = parsed;
                this._serverTimeRecvAtMs = Date.now();
                this.nowTimeLabel.string = this.formatDateToClock(new Date(parsed));
              } else {
                // 解析失败则退回本地时间显示
                this.nowTimeLabel.string = this.localClock();
              }
            } else {
              this.nowTimeLabel.string = this.localClock();
            }
          } // 更新本地“在线估算”基准


          this._lastSyncRecvAtMs = Date.now();
          this._lastSyncOnlineSecondsBase = (_d$online_seconds2 = d.online_seconds) != null ? _d$online_seconds2 : 0;
          this._lastSyncDayKey = (d.day || '').trim();
          this._autoSyncedForEligibility = false;
          var issueKey = this.getIssueKey(d);
          if (this.mainIssueNumLabel) this.mainIssueNumLabel.string = issueKey;
          if (this.resultIssueNumLabel) this.resultIssueNumLabel.string = issueKey;

          if (this.mainClaimButtonLabel) {
            this.mainClaimButtonLabel.string = d.claimed ? '已参与' : '参与游戏';
          } // 已领取资格后：直接禁止再次点“领取”，减少误触造成的“今日已领取”弹窗错觉


          this.setMainClaimInteractable(!d.claimed && !this._mainClaimRequesting); // 若用户正停留在“开奖结果”面板，则同步刷新减少错觉/信息滞后

          if ((_this$todayLotteryRes2 = this.todayLotteryResultPanel) != null && _this$todayLotteryRes2.active) {
            this.openResultPanel();
          }
        }

        openResultPanel() {
          var _d$result_tip_code;

          if (!this.todayLotteryResultPanel) return;
          this.hideAllPopups();
          var d = this._lastPayload;
          var code = (_d$result_tip_code = d == null ? void 0 : d.result_tip_code) != null ? _d$result_tip_code : 5;

          if (this.resultPlayerNameLabel) {
            // 始终显示本期中奖玩家名字（若无人中奖则给出占位）
            var winName = ((d == null ? void 0 : d.winner_display_name) || '').trim();
            this.resultPlayerNameLabel.string = winName.length > 0 ? winName : '本期暂无中奖玩家';
          }

          if (this.resultTipLabel) {
            var _RESULT_TIP$code;

            var tip = (_RESULT_TIP$code = RESULT_TIP[code]) != null ? _RESULT_TIP$code : RESULT_TIP[5];

            var _winName = ((d == null ? void 0 : d.winner_display_name) || '').trim(); // 已开奖且 tip 未强调「谁中了」时，补一行头奖公示（避免与中奖名单区信息脱节）


            if (_winName && (d != null && d.draw_finished || d != null && d.after_draw_time) && code !== 4 && code !== 1) {
              tip += "\n\n\u672C\u671F\u5934\u5956\uFF1A" + _winName;
            }

            if (code === 4 && d != null && d.is_winner) {
              tip += '\n\n奖励已发放至当前角色。';
            }

            this.resultTipLabel.string = tip;
          }

          var issueKey = this.getIssueKey(d != null ? d : null);
          if (this.resultIssueNumLabel) this.resultIssueNumLabel.string = issueKey;
          this.todayLotteryResultPanel.active = true;
          this._popupState = 'result';
        }

        fmtDuration(sec) {
          var s = Math.max(0, Math.floor(sec));
          var h = Math.floor(s / 3600);
          var m = Math.floor(s % 3600 / 60);
          var r = s % 60;
          return h + "\u5C0F\u65F6" + m + "\u5206" + r + "\u79D2";
        }

        localClock() {
          var t = new Date();

          var p = n => n < 10 ? "0" + n : "" + n;

          return t.getFullYear() + "-" + p(t.getMonth() + 1) + "-" + p(t.getDate()) + " " + p(t.getHours()) + ":" + p(t.getMinutes()) + ":" + p(t.getSeconds());
        }
        /** 期号：优先服务端 issue，否则由 day / 本地推算 */


        getIssueKey(d) {
          var _d$issue;

          var iss = ((_d$issue = d == null ? void 0 : d.issue) != null ? _d$issue : '').trim();
          if (iss.length === 8 && /^\d{8}$/.test(iss)) return iss;
          return this.formatIssueKeyFromDay(d == null ? void 0 : d.day);
        }

        formatIssueKeyFromDay(day) {
          var _this$_lastPayload$se2, _this$_lastPayload5;

          if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
            return day.replace(/-/g, '');
          }

          var st = (_this$_lastPayload$se2 = (_this$_lastPayload5 = this._lastPayload) == null ? void 0 : _this$_lastPayload5.server_time) != null ? _this$_lastPayload$se2 : '';

          if (st.length >= 10) {
            var head = st.slice(0, 10).replace(/-/g, '');
            if (head.length === 8 && /^\d{8}$/.test(head)) return head;
          }

          var t = new Date();

          var p = n => n < 10 ? "0" + n : "" + n;

          return "" + t.getFullYear() + p(t.getMonth() + 1) + p(t.getDate());
        }

        parseServerTimeToMs(serverTime) {
          // server_time 格式：YYYY-MM-DD HH:mm:ss（无时区信息，按本机本地时间解释用于展示）
          var s = String(serverTime || '').trim();
          var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
          if (!m) return null;
          var y = parseInt(m[1], 10);
          var mo = parseInt(m[2], 10) - 1;
          var d = parseInt(m[3], 10);
          var h = parseInt(m[4], 10);
          var mi = parseInt(m[5], 10);
          var se = parseInt(m[6], 10);
          var dt = new Date(y, mo, d, h, mi, se);
          var ms = dt.getTime();
          return Number.isFinite(ms) ? ms : null;
        }

        formatDateToClock(dt) {
          var p = n => n < 10 ? "0" + n : "" + n;

          return dt.getFullYear() + "-" + p(dt.getMonth() + 1) + "-" + p(dt.getDate()) + " " + p(dt.getHours()) + ":" + p(dt.getMinutes()) + ":" + p(dt.getSeconds());
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "energyLabel", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "onlineTimeLabel", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "timeUntilEligibleLabel", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "participateEligibleLabel", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "nowTimeLabel", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "errorPanel", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "errorTipLabel", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "todayLotteryResultPanel", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "claimSuccessPanel", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "claimSuccessTipLabel", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "resultPlayerNameLabel", [_dec12], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "resultTipLabel", [_dec13], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor13 = _applyDecoratedDescriptor(_class2.prototype, "backControlNode", [_dec14], {
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
//# sourceMappingURL=255b9b72e418dbd511ae961e810fbb6b59ed3344.js.map