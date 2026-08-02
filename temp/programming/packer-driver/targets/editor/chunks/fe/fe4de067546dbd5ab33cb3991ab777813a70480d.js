System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Collider2D, BoxCollider2D, Contact2DType, director, input, Input, KeyCode, PlayerGridMove, BattleScene, _dec, _dec2, _dec3, _dec4, _class, _class2, _descriptor, _descriptor2, _descriptor3, _crd, ccclass, property, BattleTriggerOnContact;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfPlayerGridMove(extras) {
    _reporterNs.report("PlayerGridMove", "./PlayerGridMove", _context.meta, extras);
  }

  function _reportPossibleCrUseOfBattleScene(extras) {
    _reporterNs.report("BattleScene", "../BattleScene", _context.meta, extras);
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
      Collider2D = _cc.Collider2D;
      BoxCollider2D = _cc.BoxCollider2D;
      Contact2DType = _cc.Contact2DType;
      director = _cc.director;
      input = _cc.input;
      Input = _cc.Input;
      KeyCode = _cc.KeyCode;
    }, function (_unresolved_2) {
      PlayerGridMove = _unresolved_2.PlayerGridMove;
    }, function (_unresolved_3) {
      BattleScene = _unresolved_3.BattleScene;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "eea13AjWOpNSK7SS5Ar/Sie", "BattleTriggerOnContact", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Collider2D', 'BoxCollider2D', 'Contact2DType', 'director', 'input', 'Input', 'EventKeyboard', 'KeyCode']);

      ({
        ccclass,
        property
      } = _decorator);
      /**
       * 说明：
       * - 挂在 npc/敌人节点（带 BoxCollider2D + 配好 2D physics 的碰撞体系）
       * - 玩家碰到：若当前未在战斗中 => 自动打开 BattleScene 面板
       * - 战斗结束后：若玩家仍在碰撞框内 => 不自动再触发，需要按 Enter
       * - 玩家离开碰撞框 => 清掉等待 Enter 状态；下次再次碰到又会自动触发
       */

      _export("BattleTriggerOnContact", BattleTriggerOnContact = (_dec = ccclass('BattleTriggerOnContact'), _dec2 = property({
        type: Node,
        tooltip: 'BattleScene 根节点（挂 BattleScene 脚本的那个 Node）'
      }), _dec3 = property({
        tooltip: '调试：在碰撞/触发时打印日志（建议仅用于排查一次）'
      }), _dec4 = property({
        tooltip: '兜底：用 AABB 重叠轮询触发（即使物理 BEGIN/END_CONTACT 没触发，也能工作）'
      }), _dec(_class = (_class2 = class BattleTriggerOnContact extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "battleRoot", _descriptor, this);

          _initializerDefineProperty(this, "debugLog", _descriptor2, this);

          _initializerDefineProperty(this, "pollingEnabled", _descriptor3, this);

          /** 用于判断“按 Enter 才能再次开战”的玩家仍处于碰撞状态 */
          this._playerTouching = false;
          this._pendingEnter = false;

          /** 战斗面板是否激活，用于检测“战斗刚结束”的边沿 */
          this._battleWasActive = false;

          /** 本次战斗触发前玩家是否确实处于碰撞中（战斗结束后才需要 Enter） */
          this._wasTouchingWhenBattleStarted = false;
          this._battleScene = null;
          this._collider = null;
          this._triggerBox = null;
          this._playerMove = null;
          this._playerBox = null;
          this._lastPlayerResolveAt = 0;
          this._touchBeganThisFrame = false;

          this._onKeyDown = e => {
            if (!this.enabled) return;
            if (e.keyCode !== KeyCode.KEY_ENTER) return;
            if (!this._pendingEnter) return;
            if (!this._playerTouching) return;
            this._pendingEnter = false;

            this._tryStartBattle();
          };

          this._onBeginContact = (_self, other) => {
            var _this$battleRoot2;

            if (!this.enabled) return;
            const otherNode = other == null ? void 0 : other.node;
            if (!otherNode) return;

            const playerMove = this._findPlayerGridMoveComponent(otherNode);

            if (!playerMove) return;
            this._playerTouching = true;

            if (this.debugLog) {
              var _this$battleRoot;

              console.log(`[BattleTriggerOnContact] BEGIN (player=${playerMove.node.name}, trigger=${this.node.name}, pendingEnter=${this._pendingEnter}, battleActive=${Boolean((_this$battleRoot = this.battleRoot) == null ? void 0 : _this$battleRoot.active)})`);
            } // 战斗进行中：不允许重复触发


            if ((_this$battleRoot2 = this.battleRoot) != null && _this$battleRoot2.active) return; // 战斗结束后若仍触碰，会进入 pendingEnter 状态，此时不自动触发

            if (this._pendingEnter) return; // 正常路径：自动开战

            this._tryStartBattle();
          };

          this._onEndContact = (_self, other) => {
            if (!this.enabled) return;
            const otherNode = other == null ? void 0 : other.node;
            if (!otherNode) return;

            const playerMove = this._findPlayerGridMoveComponent(otherNode);

            if (!playerMove) return;
            this._playerTouching = false; // 离开碰撞框后，下次再次碰到就恢复自动触发

            this._pendingEnter = false;
            this._wasTouchingWhenBattleStarted = false;

            if (this.debugLog) {
              console.log(`[BattleTriggerOnContact] END (player=${playerMove.node.name}, trigger=${this.node.name})`);
            }
          };
        }

        onLoad() {
          var _this$battleRoot4;

          if (this.battleRoot) {
            this._battleScene = this.battleRoot.getComponent(_crd && BattleScene === void 0 ? (_reportPossibleCrUseOfBattleScene({
              error: Error()
            }), BattleScene) : BattleScene);
          } // 重要：优先拿 BoxCollider2D（getComponent(Collider2D) 在某些情况下可能拿不到具体子类）


          const box = this.getComponent(BoxCollider2D);
          this._triggerBox = box;
          this._collider = box || this.getComponent(Collider2D);

          if (this.debugLog) {
            var _this$node, _this$_collider, _this$battleRoot3;

            console.log(`[BattleTriggerOnContact] onLoad trigger=${(_this$node = this.node) == null ? void 0 : _this$node.name} collider=${((_this$_collider = this._collider) == null || (_this$_collider = _this$_collider.constructor) == null ? void 0 : _this$_collider.name) || 'null'} battleRootActive=${Boolean((_this$battleRoot3 = this.battleRoot) == null ? void 0 : _this$battleRoot3.active)}`);
          }

          if (this._collider) {
            this._collider.on(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);

            this._collider.on(Contact2DType.END_CONTACT, this._onEndContact, this);
          } else if (this.debugLog) {
            var _this$node2;

            console.warn(`[BattleTriggerOnContact] collider not found on node=${(_this$node2 = this.node) == null ? void 0 : _this$node2.name}`);
          }

          input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this); // 初始化战斗边沿状态

          this._battleWasActive = Boolean((_this$battleRoot4 = this.battleRoot) == null ? void 0 : _this$battleRoot4.active); // 兜底：解析本地玩家组件（用于 AABB 轮询）

          this._resolveLocalPlayerOnce();
        }

        onDestroy() {
          if (this._collider) {
            this._collider.off(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);

            this._collider.off(Contact2DType.END_CONTACT, this._onEndContact, this);
          }

          input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        }

        update() {
          var _this$battleRoot5;

          if (!this.enabled) return;
          this._touchBeganThisFrame = false;

          if (this.pollingEnabled) {
            this._pollTouchOverlap();
          }

          const battleActive = Boolean((_this$battleRoot5 = this.battleRoot) == null ? void 0 : _this$battleRoot5.active); // 战斗从 active -> inactive：如果玩家当时还在碰撞框里，则进入“等待 Enter 才能再次开战”

          if (this._battleWasActive && !battleActive) {
            if (this._wasTouchingWhenBattleStarted && this._playerTouching) {
              this._pendingEnter = true;
            }

            this._wasTouchingWhenBattleStarted = false;
          } // 触碰“开始这一帧”且当前不在战斗、不处于 pendingEnter：自动开战


          if (this.pollingEnabled && this._touchBeganThisFrame && !battleActive && !this._pendingEnter) {
            if (this.debugLog) {
              console.log(`[BattleTriggerOnContact] >>> POLL START BATTLE (trigger=${this.node.name})`);
            }

            this._tryStartBattle();
          }

          this._battleWasActive = battleActive;
        }

        _findPlayerGridMoveComponent(node) {
          // 触发回调里的 otherNode 未必就是脚本挂载节点（可能是碰撞子节点）
          // 所以向父节点逐级查找，确保判定可靠。
          let cur = node;
          let guard = 0;

          while (cur && guard++ < 8) {
            const comp = cur.getComponent(_crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
              error: Error()
            }), PlayerGridMove) : PlayerGridMove);
            if (comp) return comp;
            cur = cur.parent;
          }

          return null;
        }

        _resolveLocalPlayerOnce() {
          // 防止每个触发器每帧都去遍历节点树
          const now = Date.now();
          if (this._lastPlayerResolveAt > 0 && now - this._lastPlayerResolveAt < 2000) return;
          this._lastPlayerResolveAt = now;

          try {
            var _scene$getComponentIn, _this$_playerMove$nod, _this$_playerMove;

            const scene = director.getScene == null ? void 0 : director.getScene();
            this._playerMove = (_scene$getComponentIn = scene == null ? void 0 : scene.getComponentInChildren(_crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
              error: Error()
            }), PlayerGridMove) : PlayerGridMove)) != null ? _scene$getComponentIn : null;
            this._playerBox = (_this$_playerMove$nod = (_this$_playerMove = this._playerMove) == null || (_this$_playerMove = _this$_playerMove.node) == null ? void 0 : _this$_playerMove.getComponentInChildren(BoxCollider2D)) != null ? _this$_playerMove$nod : null;
          } catch {
            this._playerMove = null;
            this._playerBox = null;
          }
        }

        _pollTouchOverlap() {
          this._resolveLocalPlayerOnce();

          if (!this._triggerBox || !this._playerBox) return;
          const a = this._triggerBox.worldAABB;
          const b = this._playerBox.worldAABB;
          if (!a || !b) return;
          const hit = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

          if (hit) {
            if (!this._playerTouching) {
              this._playerTouching = true;
              this._touchBeganThisFrame = true;
            }
          } else {
            if (this._playerTouching) {
              this._playerTouching = false; // 离开碰撞框后，下次再次碰到就恢复自动触发

              this._pendingEnter = false;
              this._wasTouchingWhenBattleStarted = false;
            }
          }
        }

        _tryStartBattle() {
          if (!this.battleRoot) return;
          if (this.battleRoot.active) return;

          if (this.debugLog) {
            console.log(`[BattleTriggerOnContact] >>> START BATTLE (trigger=${this.node.name})`);
          } // 关键：记录战斗开始时玩家是否仍在碰撞框内


          this._wasTouchingWhenBattleStarted = this._playerTouching;
          this._pendingEnter = false; // BattleScene.onEnable 里会自动发起/恢复战斗

          this.battleRoot.active = true;
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "battleRoot", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "debugLog", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return false;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "pollingEnabled", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return true;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=fe4de067546dbd5ab33cb3991ab777813a70480d.js.map