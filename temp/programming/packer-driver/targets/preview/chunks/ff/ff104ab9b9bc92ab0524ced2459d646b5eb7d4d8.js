System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, BoxCollider2D, Collider2D, Component, director, input, Input, JsonAsset, KeyCode, Node, PlayerGridMove, BattleTriggerOnContact, StoryDialoguePlayer, storyLog, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _crd, ccclass, property, executionOrder, MapNpcInteract;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfPlayerGridMove(extras) {
    _reporterNs.report("PlayerGridMove", "./GameArea/PlayerGridMove", _context.meta, extras);
  }

  function _reportPossibleCrUseOfBattleTriggerOnContact(extras) {
    _reporterNs.report("BattleTriggerOnContact", "./GameArea/BattleTriggerOnContact", _context.meta, extras);
  }

  function _reportPossibleCrUseOfStoryDialoguePlayer(extras) {
    _reporterNs.report("StoryDialoguePlayer", "./StoryDialoguePlayer", _context.meta, extras);
  }

  function _reportPossibleCrUseOfChoiceScript(extras) {
    _reporterNs.report("ChoiceScript", "./StoryDialoguePlayer", _context.meta, extras);
  }

  function _reportPossibleCrUseOfDialogueLineScript(extras) {
    _reporterNs.report("DialogueLineScript", "./StoryDialoguePlayer", _context.meta, extras);
  }

  function _reportPossibleCrUseOfstoryLog(extras) {
    _reporterNs.report("storyLog", "./storyLogger", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      BoxCollider2D = _cc.BoxCollider2D;
      Collider2D = _cc.Collider2D;
      Component = _cc.Component;
      director = _cc.director;
      input = _cc.input;
      Input = _cc.Input;
      JsonAsset = _cc.JsonAsset;
      KeyCode = _cc.KeyCode;
      Node = _cc.Node;
    }, function (_unresolved_2) {
      PlayerGridMove = _unresolved_2.PlayerGridMove;
    }, function (_unresolved_3) {
      BattleTriggerOnContact = _unresolved_3.BattleTriggerOnContact;
    }, function (_unresolved_4) {
      StoryDialoguePlayer = _unresolved_4.StoryDialoguePlayer;
    }, function (_unresolved_5) {
      storyLog = _unresolved_5.storyLog;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "c3d8afxTitcnaGyPE1eb3CB", "MapNpcInteract", undefined);

      __checkObsolete__(['_decorator', 'BoxCollider2D', 'Collider2D', 'Component', 'director', 'input', 'Input', 'EventKeyboard', 'JsonAsset', 'KeyCode', 'Node']);

      ({
        ccclass,
        property,
        executionOrder
      } = _decorator);

      /**
       * 地图 NPC 交互：读取共享地图 Json（npcUid + events），在范围内按交互键触发对白/选项。
       * 与 BattleTriggerOnContact 同挂时，默认禁用战斗触发器，避免「先对话」被开战抢占。
       */
      _export("MapNpcInteract", MapNpcInteract = (_dec = ccclass('MapNpcInteract'), _dec2 = executionOrder(-50), _dec3 = property(JsonAsset), _dec4 = property(Node), _dec5 = property({
        tooltip: '本地调试：忽略 map JSON 里 server.requirements，便于验 UI 与对白'
      }), _dec6 = property({
        tooltip: '与 NPC 碰撞范围内按此键触发交互（默认 E）'
      }), _dec7 = property({
        tooltip: '为 true 时不再禁用同节点 BattleTriggerOnContact（纯战斗 NPC）'
      }), _dec8 = property({
        tooltip: '兜底：与 BattleTriggerOnContact 一致，用 AABB 轮询重叠（物理事件未触发时仍可用）'
      }), _dec9 = property({
        tooltip: '打印 [Story] 诊断日志（调通后可开）'
      }), _dec10 = property({
        tooltip: '重复进入范围时，提示 Toast 的最小间隔（毫秒）'
      }), _dec11 = property({
        tooltip: '进入可交互范围时 Toast 提示文案'
      }), _dec(_class = _dec2(_class = (_class2 = class MapNpcInteract extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "mapConfig", _descriptor, this);

          _initializerDefineProperty(this, "uiRoot", _descriptor2, this);

          _initializerDefineProperty(this, "npcUid", _descriptor3, this);

          _initializerDefineProperty(this, "skipServerRequirements", _descriptor4, this);

          _initializerDefineProperty(this, "interactKey", _descriptor5, this);

          _initializerDefineProperty(this, "letBattleTriggerHandleCombat", _descriptor6, this);

          _initializerDefineProperty(this, "pollingEnabled", _descriptor7, this);

          _initializerDefineProperty(this, "debugLog", _descriptor8, this);

          /**
           * 与 map JSON `maxInteractDistance` 对齐的像素距离（纯距离兜底 + 与 AABB 配合时的“心距”上限）。
           * `_parseMap` 会用 JSON 值做上限收紧，不再做 1.5 倍放大。
           */
          _initializerDefineProperty(this, "interactDistanceFallbackPx", _descriptor9, this);

          /** 已在范围内时，允许心距略大于 R 仍保持“在范围内”，减少边界抖动（施密特触发） */
          _initializerDefineProperty(this, "interactReleaseHysteresisPx", _descriptor10, this);

          _initializerDefineProperty(this, "interactHintMinIntervalMs", _descriptor11, this);

          _initializerDefineProperty(this, "interactHintText", _descriptor12, this);

          this._triggerBox = null;
          this._playerTouching = false;
          this._playerMove = null;

          /** 玩家任意 Collider2D（不限定 Box），用于 worldAABB 或兜底距离 */
          this._playerCollider = null;
          this._lastPlayerResolveAt = 0;
          this._loggedAabbFallback = false;
          this._lastOutOfRangeKeyLogAt = 0;
          this._lastRangeDiagLogAt = 0;
          this._lastInteractHintAt = 0;
          this._dialogueScripts = {};
          this._choiceScripts = {};
          this._npcEvents = [];

          /** 本地已完成的 eventId（会话内），用于按 order 推进多条 events，避免永远卡在第一条对白 */
          this._localCompletedEventIds = new Set();

          this._onKeyDown = e => {
            var _ev$client, _ev$eventType;

            if (e.keyCode !== this.interactKey) return;

            if (!this.uiRoot) {
              var _this$node;

              if (this.debugLog) (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
                error: Error()
              }), storyLog) : storyLog)('warn', 'MapNpcInteract: 按了交互键但 uiRoot 未绑定', {
                node: (_this$node = this.node) == null ? void 0 : _this$node.name
              });
              return;
            }

            if (!this._playerTouching) {
              var now = Date.now();

              if (this.debugLog && now - this._lastOutOfRangeKeyLogAt > 2000) {
                var _this$node2;

                this._lastOutOfRangeKeyLogAt = now;
                (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
                  error: Error()
                }), storyLog) : storyLog)('info', 'MapNpcInteract: 按了交互键但不在本 NPC 范围内（碰撞/AABB/距离兜底）', {
                  node: (_this$node2 = this.node) == null ? void 0 : _this$node2.name,
                  hasPlayerMove: Boolean(this._playerMove),
                  hasPlayerCollider: Boolean(this._playerCollider)
                });
              }

              return;
            }

            var existing = this.uiRoot.getComponent(_crd && StoryDialoguePlayer === void 0 ? (_reportPossibleCrUseOfStoryDialoguePlayer({
              error: Error()
            }), StoryDialoguePlayer) : StoryDialoguePlayer);

            if (existing != null && existing.isBlocking) {
              if (this.debugLog) (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
                error: Error()
              }), storyLog) : storyLog)('info', 'MapNpcInteract: 剧情占用中，忽略重复交互');
              return;
            }

            var ev = this._pickInteractEvent();

            if (!ev) {
              if (this.debugLog) {
                (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
                  error: Error()
                }), storyLog) : storyLog)('info', 'MapNpcInteract: 无可推进事件（已全部完成、events 为空或 requirements 未满足）', {
                  npcUid: this.npcUid,
                  completedIds: Array.from(this._localCompletedEventIds)
                });
              }

              return;
            }

            var player = this._ensureStoryPlayer();

            if (!player) return;
            var client = (_ev$client = ev.client) != null ? _ev$client : {};

            if (ev.eventType === 'dialog' && client.dialogueScriptId) {
              var scr = this._dialogueScripts[client.dialogueScriptId];

              if (scr) {
                if (this.debugLog) {
                  (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
                    error: Error()
                  }), storyLog) : storyLog)('info', 'MapNpcInteract: 开始对白', {
                    scriptId: client.dialogueScriptId,
                    speaker: scr.speaker,
                    eventId: this._stableEventId(ev)
                  });
                }

                player.startDialogue(scr, () => this._markEventDone(ev));
                return;
              }

              if (this.debugLog) {
                (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
                  error: Error()
                }), storyLog) : storyLog)('warn', 'MapNpcInteract: dialogueScriptId 在 dialogueScripts 中不存在', {
                  scriptId: client.dialogueScriptId
                });
              }

              return;
            }

            if (client.choiceScriptId) {
              var ch = this._choiceScripts[client.choiceScriptId];

              if (ch) {
                if (this.debugLog) {
                  (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
                    error: Error()
                  }), storyLog) : storyLog)('info', 'MapNpcInteract: 打开选项', {
                    choiceScriptId: client.choiceScriptId,
                    eventId: this._stableEventId(ev)
                  });
                }

                player.startChoice(ch, () => {
                  /* 选项已选，具体逻辑后续接服务端 */
                }, () => this._markEventDone(ev));
                return;
              }
            }

            if (ev.eventType === 'task' && client.taskUiHint) {
              player.showToast(client.taskUiHint, 3200);

              this._markEventDone(ev);

              return;
            }

            player.showToast("\u672A\u63A5\u5165\u7684 NPC \u4E8B\u4EF6: " + ((_ev$eventType = ev.eventType) != null ? _ev$eventType : 'unknown'), 3200);

            this._markEventDone(ev);
          };
        }

        onLoad() {
          if (!this.letBattleTriggerHandleCombat) {
            var battle = this.getComponent(_crd && BattleTriggerOnContact === void 0 ? (_reportPossibleCrUseOfBattleTriggerOnContact({
              error: Error()
            }), BattleTriggerOnContact) : BattleTriggerOnContact);
            if (battle) battle.enabled = false;
          }

          this._triggerBox = this.getComponent(BoxCollider2D);
          input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);

          this._parseMap();

          this._resolveLocalPlayerOnce();

          this._ensureStoryPlayer();

          if (this.debugLog) {
            var _this$node3, _this$mapConfig;

            (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
              error: Error()
            }), storyLog) : storyLog)('info', 'MapNpcInteract.onLoad', {
              node: (_this$node3 = this.node) == null ? void 0 : _this$node3.name,
              npcUid: this.npcUid,
              hasMapConfig: Boolean((_this$mapConfig = this.mapConfig) == null ? void 0 : _this$mapConfig.json),
              eventCount: this._npcEvents.length,
              hasTriggerBox: Boolean(this._triggerBox),
              hasUiRoot: Boolean(this.uiRoot),
              battleTriggerLeftOn: this.letBattleTriggerHandleCombat,
              interactKey: this.interactKey,
              interactDistanceFallbackPx: this.interactDistanceFallbackPx
            });
          }
        }

        onDestroy() {
          input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        }

        update() {
          if (this.pollingEnabled) {
            this._pollTouchOverlap();
          }
        }

        _parseMap() {
          var _this$mapConfig2, _raw$client, _client$dialogueScrip, _client$choiceScripts, _raw$npcs, _npc$events, _raw$server, _server$antiCheat;

          var raw = (_this$mapConfig2 = this.mapConfig) == null ? void 0 : _this$mapConfig2.json;

          if (!raw) {
            if (this.debugLog) {
              var _this$node4;

              (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
                error: Error()
              }), storyLog) : storyLog)('warn', 'MapNpcInteract._parseMap: mapConfig 为空或尚未加载 json', {
                node: (_this$node4 = this.node) == null ? void 0 : _this$node4.name,
                npcUid: this.npcUid
              });
            }

            return;
          }

          var client = (_raw$client = raw.client) != null ? _raw$client : {};
          this._dialogueScripts = (_client$dialogueScrip = client.dialogueScripts) != null ? _client$dialogueScrip : {};
          this._choiceScripts = (_client$choiceScripts = client.choiceScripts) != null ? _client$choiceScripts : {};
          var npcs = (_raw$npcs = raw.npcs) != null ? _raw$npcs : [];
          var npc = npcs.find(n => n.npcUid === this.npcUid);
          this._npcEvents = (_npc$events = npc == null ? void 0 : npc.events) != null ? _npc$events : [];

          if (this.debugLog && !npc) {
            (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
              error: Error()
            }), storyLog) : storyLog)('warn', 'MapNpcInteract._parseMap: npcs 中未找到 npcUid', {
              npcUid: this.npcUid,
              known: npcs.map(n => n.npcUid).filter(Boolean)
            });
          }

          var server = (_raw$server = raw.server) != null ? _raw$server : {};
          var anti = (_server$antiCheat = server.antiCheat) != null ? _server$antiCheat : {};
          var maxD = Number(anti.maxInteractDistance);

          if (Number.isFinite(maxD) && maxD > 0) {
            var before = this.interactDistanceFallbackPx;
            this.interactDistanceFallbackPx = Math.min(this.interactDistanceFallbackPx, maxD);

            if (this.debugLog) {
              (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
                error: Error()
              }), storyLog) : storyLog)('info', 'MapNpcInteract._parseMap: 交互距离已与 JSON maxInteractDistance 对齐（取小、不放大）', {
                maxInteractDistance: maxD,
                interactDistanceFallbackPxBefore: before,
                interactDistanceFallbackPxAfter: this.interactDistanceFallbackPx,
                releaseHysteresisPx: this.interactReleaseHysteresisPx
              });
            }
          }
        }

        _requirementsMet(reqs) {
          if (this.skipServerRequirements) return true;
          if (!(reqs != null && reqs.length)) return true;
          return false;
        }

        _stableEventId(ev) {
          var _ev$order;

          if (ev.eventId) return ev.eventId;
          return this.npcUid + "#order_" + ((_ev$order = ev.order) != null ? _ev$order : 0);
        }

        _markEventDone(ev) {
          var id = this._stableEventId(ev);

          this._localCompletedEventIds.add(id);

          if (this.debugLog) {
            (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
              error: Error()
            }), storyLog) : storyLog)('info', 'MapNpcInteract: 事件已完成（本地推进）', {
              npcUid: this.npcUid,
              eventId: id,
              eventType: ev.eventType,
              completedCount: this._localCompletedEventIds.size
            });
          }
        }
        /** 取第一个满足 requirements 且尚未本地完成的事件 */


        _pickInteractEvent() {
          var sorted = [...this._npcEvents].sort((a, b) => {
            var _a$order, _b$order;

            return ((_a$order = a.order) != null ? _a$order : 0) - ((_b$order = b.order) != null ? _b$order : 0);
          });

          for (var ev of sorted) {
            var _ev$server;

            var reqs = (_ev$server = ev.server) == null ? void 0 : _ev$server.requirements;
            if (!this._requirementsMet(reqs)) continue;
            if (this._localCompletedEventIds.has(this._stableEventId(ev))) continue;
            return ev;
          }

          return null;
        }

        _ensureStoryPlayer() {
          if (!this.uiRoot) return null;
          var p = this.uiRoot.getComponent(_crd && StoryDialoguePlayer === void 0 ? (_reportPossibleCrUseOfStoryDialoguePlayer({
            error: Error()
          }), StoryDialoguePlayer) : StoryDialoguePlayer);
          if (!p) p = this.uiRoot.addComponent(_crd && StoryDialoguePlayer === void 0 ? (_reportPossibleCrUseOfStoryDialoguePlayer({
            error: Error()
          }), StoryDialoguePlayer) : StoryDialoguePlayer);
          return p;
        }

        _resolveLocalPlayerOnce() {
          var now = Date.now();
          var resolved = Boolean(this._playerMove && this._playerCollider); // 仅在已解析到玩家时做 2s 节流；首帧/预制体晚到时必须每帧重试，否则会永久拿不到碰撞体

          if (resolved && this._lastPlayerResolveAt > 0 && now - this._lastPlayerResolveAt < 2000) return;
          this._lastPlayerResolveAt = now;

          try {
            var _scene$getComponentIn, _this$_playerMove;

            var scene = director.getScene == null ? void 0 : director.getScene();
            this._playerMove = (_scene$getComponentIn = scene == null ? void 0 : scene.getComponentInChildren(_crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
              error: Error()
            }), PlayerGridMove) : PlayerGridMove)) != null ? _scene$getComponentIn : null;
            var pNode = (_this$_playerMove = this._playerMove) == null ? void 0 : _this$_playerMove.node;

            if (pNode) {
              var _cols$;

              var cols = pNode.getComponentsInChildren(Collider2D).filter(c => c.enabled);
              this._playerCollider = (_cols$ = cols[0]) != null ? _cols$ : null;
            } else {
              this._playerCollider = null;
            }
          } catch (_unused) {
            this._playerMove = null;
            this._playerCollider = null;
          }
        }

        _distanceToPlayer() {
          var _this$_playerMove2;

          if (!((_this$_playerMove2 = this._playerMove) != null && _this$_playerMove2.node)) return Number.POSITIVE_INFINITY;
          var a = this.node.worldPosition;
          var b = this._playerMove.node.worldPosition;
          return Math.hypot(a.x - b.x, a.y - b.y);
        }

        _aabbValid(rect) {
          return Boolean(rect && rect.width > 1e-6 && rect.height > 1e-6);
        }
        /** AABB 重叠（物理盒）；“可交互”心距仍受 interactDistanceFallbackPx 约束，避免盒过大吸住远处 */


        _computeAabbOverlap() {
          var trig = this._triggerBox;
          if (!trig || !this._playerCollider) return false;
          var a = trig.worldAABB;
          var b = this._playerCollider.worldAABB;

          if (!this._aabbValid(a) || !this._aabbValid(b)) {
            if (this.debugLog && this._playerMove && !this._loggedAabbFallback) {
              this._loggedAabbFallback = true;
              (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
                error: Error()
              }), storyLog) : storyLog)('info', 'MapNpcInteract: AABB 无效，使用心距判定', {
                aabbNpc: a != null ? a : null,
                aabbPlayer: b != null ? b : null
              });
            }

            return false;
          }

          return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        }

        _pollTouchOverlap() {
          var _this$_playerMove3;

          var prevTouching = this._playerTouching;

          this._resolveLocalPlayerOnce();

          var dist = this._distanceToPlayer();

          var R = this.interactDistanceFallbackPx;
          var RLeave = R + this.interactReleaseHysteresisPx;

          var aabbOverlap = this._computeAabbOverlap();

          var withinCenter = dist <= R;
          var withinLeave = dist <= RLeave;
          var hit = false;

          if (aabbOverlap) {
            hit = withinCenter;
          } else if (!prevTouching) {
            hit = withinCenter;
          } else {
            hit = withinLeave;
          }

          this._playerTouching = hit;

          if (prevTouching !== hit) {
            if (this.debugLog) {
              if (hit) {
                var _this$node5;

                (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
                  error: Error()
                }), storyLog) : storyLog)('info', 'MapNpcInteract: inRange=true（边沿）', {
                  npcUid: this.npcUid,
                  node: (_this$node5 = this.node) == null ? void 0 : _this$node5.name,
                  dist,
                  thresholdPx: R,
                  aabbOverlap
                });
              } else {
                var _this$node6;

                (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
                  error: Error()
                }), storyLog) : storyLog)('info', 'MapNpcInteract: inRange=false（边沿）', {
                  npcUid: this.npcUid,
                  node: (_this$node6 = this.node) == null ? void 0 : _this$node6.name,
                  dist,
                  thresholdPx: R,
                  releaseAtPx: RLeave
                });
              }
            }

            if (hit) {
              var p = this._ensureStoryPlayer();

              if (p && !p.isBlocking) {
                var now = Date.now();

                if (now - this._lastInteractHintAt >= this.interactHintMinIntervalMs) {
                  this._lastInteractHintAt = now;
                  p.showToast(this.interactHintText, 1600);
                }
              }
            }
          }

          if (this.debugLog && !hit && (_this$_playerMove3 = this._playerMove) != null && _this$_playerMove3.node) {
            var near = dist < R * 2.2;

            var _now = Date.now();

            if (near && _now - this._lastRangeDiagLogAt > 3000) {
              this._lastRangeDiagLogAt = _now;
              var npcWp = this.node.worldPosition;
              var plWp = this._playerMove.node.worldPosition;
              (_crd && storyLog === void 0 ? (_reportPossibleCrUseOfstoryLog({
                error: Error()
              }), storyLog) : storyLog)('info', 'MapNpcInteract: rangeDiag（未命中但较近）', {
                npcUid: this.npcUid,
                dist,
                thresholdPx: R,
                releaseAtPx: RLeave,
                aabbOverlap: this._computeAabbOverlap(),
                npcWorld: {
                  x: npcWp.x,
                  y: npcWp.y
                },
                playerWorld: {
                  x: plWp.x,
                  y: plWp.y
                },
                colliderCount: this._playerMove.node.getComponentsInChildren(Collider2D).filter(c => c.enabled).length
              });
            }
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "mapConfig", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "uiRoot", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "npcUid", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return '';
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "skipServerRequirements", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "interactKey", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return KeyCode.KEY_E;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "letBattleTriggerHandleCombat", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return false;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "pollingEnabled", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "debugLog", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return false;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "interactDistanceFallbackPx", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 120;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "interactReleaseHysteresisPx", [property], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 18;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "interactHintMinIntervalMs", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 8000;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "interactHintText", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return '按 E 交谈';
        }
      })), _class2)) || _class) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=ff104ab9b9bc92ab0524ced2459d646b5eb7d4d8.js.map