System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, UITransform, input, Input, KeyCode, misc, Animation, v3, TiledLayer, UIOpacity, Sprite, PlayerAnimRuntime, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _dec14, _dec15, _dec16, _dec17, _dec18, _dec19, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _descriptor13, _descriptor14, _descriptor15, _descriptor16, _descriptor17, _descriptor18, _crd, ccclass, property, CELL, MV_BASE_FPS, PlayerGridMove;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfPlayerAnimRuntime(extras) {
    _reporterNs.report("PlayerAnimRuntime", "./PlayerAnimRuntime", _context.meta, extras);
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
      UITransform = _cc.UITransform;
      input = _cc.input;
      Input = _cc.Input;
      KeyCode = _cc.KeyCode;
      misc = _cc.misc;
      Animation = _cc.Animation;
      v3 = _cc.v3;
      TiledLayer = _cc.TiledLayer;
      UIOpacity = _cc.UIOpacity;
      Sprite = _cc.Sprite;
    }, function (_unresolved_2) {
      PlayerAnimRuntime = _unresolved_2.PlayerAnimRuntime;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "7d7beIW2gtIoZPG3uCetU+g", "PlayerGridMove", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'UITransform', 'input', 'Input', 'EventKeyboard', 'KeyCode', 'misc', 'Animation', 'v3', 'TiledLayer', 'UIOpacity', 'Sprite']);

      ({
        ccclass,
        property
      } = _decorator);
      /** 单格像素（硬性 48×48） */

      CELL = 48;
      /** RPG Maker MV 的速度基准帧率（引擎内部默认按 60fps 公式定义） */

      MV_BASE_FPS = 60;

      _export("PlayerGridMove", PlayerGridMove = (_dec = ccclass('PlayerGridMove'), _dec2 = property({
        type: Node,
        tooltip: '地图瓦片父节点（MapRoot / TiledMap），用于边界与格子原点'
      }), _dec3 = property({
        tooltip: 'RPG Maker MV：moveSpeed 1～6（默认 4），对应 Game_CharacterBase.prototype.moveSpeed'
      }), _dec4 = property({
        tooltip: '启用后按住 Shift 等同 MV 奔跑：realMoveSpeed = moveSpeed + 1（不超过 7）'
      }), _dec5 = property({
        tooltip: '动画名前缀（例如 player1）。将自动播放：${prefix}_walk_right/left/up/down 与 ${prefix}_idle_...；idle 缺失时回退用 walk'
      }), _dec6 = property({
        tooltip: '严格按 animPrefix 播放。开启后不会回退到 walk_right/idle_right 这类通用名，避免串到别的角色动画。'
      }), _dec7 = property({
        tooltip: '地图锚点作为格子坐标原点(0,0)。左上锚点(0,1)时，首格中心位于锚点右下半格。'
      }), _dec8 = property({
        tooltip: '初始格子列（默认 0）'
      }), _dec9 = property({
        tooltip: '初始格子行（默认 0，左上锚点模式下向下递增）'
      }), _dec10 = property({
        tooltip: '若节点上挂了 PlayerStateSync（服务器权威坐标恢复），则 start() 阶段不强制 placeAtGrid(startGridCol/startGridRow)，避免偶发拿不到 player_info 时被丢到(0,0)看起来像左上角。'
      }), _dec11 = property({
        tooltip: '等待服务器坐标恢复的超时（秒）。超时仍未恢复时，将使用 fallbackSpawnX/Y 作为兜底，避免角色卡在(0,0)。'
      }), _dec12 = property({
        tooltip: '服务器坐标恢复超时后的兜底出生点 X（像素）'
      }), _dec13 = property({
        tooltip: '服务器坐标恢复超时后的兜底出生点 Y（像素）'
      }), _dec14 = property({
        tooltip: '不可通行图层名（逗号分隔，默认 Wall,items）'
      }), _dec15 = property({
        tooltip: '可通行但可触发效果图层名（逗号分隔，默认 plant）'
      }), _dec16 = property({
        tooltip: 'Tiled 行号是否以上方为 0（默认 true，Tiled 编辑器常用）'
      }), _dec17 = property({
        tooltip: '处于 plant 草丛时角色透明度（0-255）'
      }), _dec18 = property({
        tooltip: '透明度过渡速度（每秒变化量）'
      }), _dec19 = property({
        tooltip: '关闭 Sprite 逐帧裁剪框、使用 RAW 尺寸，避免行走帧切换时 UITransform/锚点随 trim 变化造成的像素抖动与形变（像素风推荐开启）'
      }), _dec(_class = (_class2 = class PlayerGridMove extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "mapRoot", _descriptor, this);

          _initializerDefineProperty(this, "moveSpeed", _descriptor2, this);

          _initializerDefineProperty(this, "dashLikeMV", _descriptor3, this);

          _initializerDefineProperty(this, "animPrefix", _descriptor4, this);

          _initializerDefineProperty(this, "strictAnimPrefix", _descriptor5, this);

          _initializerDefineProperty(this, "useAnchorAsGridOrigin", _descriptor6, this);

          _initializerDefineProperty(this, "startGridCol", _descriptor7, this);

          _initializerDefineProperty(this, "startGridRow", _descriptor8, this);

          _initializerDefineProperty(this, "deferInitialPlaceToServerRestore", _descriptor9, this);

          _initializerDefineProperty(this, "serverRestoreTimeoutSec", _descriptor10, this);

          _initializerDefineProperty(this, "fallbackSpawnX", _descriptor11, this);

          _initializerDefineProperty(this, "fallbackSpawnY", _descriptor12, this);

          _initializerDefineProperty(this, "blockedLayerNames", _descriptor13, this);

          _initializerDefineProperty(this, "passableEffectLayerNames", _descriptor14, this);

          _initializerDefineProperty(this, "tiledRowFromTop", _descriptor15, this);

          _initializerDefineProperty(this, "grassOpacity", _descriptor16, this);

          _initializerDefineProperty(this, "grassOpacityLerpSpeed", _descriptor17, this);

          _initializerDefineProperty(this, "pixelPerfectSprite", _descriptor18, this);

          this._ut = null;
          this._anim = null;
          this._uiOpacity = null;
          this._animRt = null;
          this._serverRestored = false;
          this._restoreTimeoutScheduled = false;
          this._axis = null;
          this._targetX = 0;
          this._targetY = 0;
          this._moving = false;
          this._facing = 'down';
          this._snapToPixel = true;

          /** 每走完一格到达终点后回调（用于网络上报 world_step） */
          this._stepCb = null;

          /** 本段移动的目的格中心（抵达时用于精确对齐） */
          this._destCx = 0;
          this._destCy = 0;

          /** 当前按下的方向键（MV 式按住连走；引擎无 isKeyPress 时用 DOWN/UP 维护） */
          this._heldCodes = new Set();
          this._tmpV3 = v3();
          this._blockedNameSet = new Set();
          this._effectNameSet = new Set();
          this._inPlant = false;
        }

        onLoad() {
          this._ut = this.getComponent(UITransform);
          this._anim = this.getComponent(Animation);
          this._animRt = this.getComponent(_crd && PlayerAnimRuntime === void 0 ? (_reportPossibleCrUseOfPlayerAnimRuntime({
            error: Error()
          }), PlayerAnimRuntime) : PlayerAnimRuntime);

          if (this._anim) {
            this._anim.playOnLoad = false;
          }

          this._uiOpacity = this.getComponent(UIOpacity) || this.addComponent(UIOpacity);
          this._uiOpacity.opacity = 255;

          this._applyPixelPerfectSpriteIfNeeded();

          this._refreshLayerNameSets();

          input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
          input.on(Input.EventType.KEY_UP, this._onKeyUp, this);
        }

        onDestroy() {
          input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
          input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
        }

        start() {
          var _anyNode$getComponent;

          var anyNode = this.node;
          var hasPlayerStateSync = this.deferInitialPlaceToServerRestore && !!((_anyNode$getComponent = anyNode == null || anyNode.getComponent == null ? void 0 : anyNode.getComponent('PlayerStateSync')) != null ? _anyNode$getComponent : null);

          if (!hasPlayerStateSync) {
            if (this.useAnchorAsGridOrigin) {
              this.placeAtGrid(this.startGridCol, this.startGridRow);
            } else {
              this._snapToGridFromCurrentPos();
            }
          } else {
            this._scheduleRestoreTimeoutOnce();
          }

          this._playIdleAnim(this._facing);
        }
        /** PlayerStateSync 首次应用服务器坐标后调用，避免超时兜底覆盖。 */


        markServerRestored() {
          this._serverRestored = true;
        }

        _scheduleRestoreTimeoutOnce() {
          if (this._restoreTimeoutScheduled) return;
          this._restoreTimeoutScheduled = true;
          var sec = Math.max(0.1, Number(this.serverRestoreTimeoutSec) || 2.0);
          this.scheduleOnce(() => {
            if (this._serverRestored) return; // 兜底：避免偶发拿不到 player_info 时停在(0,0)（左上角观感）

            this.setPixelPosition(this.fallbackSpawnX, this.fallbackSpawnY, true);
          }, sec);
        }

        update(dt) {
          var dashing = this.dashLikeMV && (this._heldCodes.has(KeyCode.SHIFT_LEFT) || this._heldCodes.has(KeyCode.SHIFT_RIGHT));

          var ms = misc.clampf(this.moveSpeed, 1, 6);
          var realSpeed = misc.clampf(ms + (dashing ? 1 : 0), 1, 7);
          var distTiles = Math.pow(2, realSpeed) / 256 * MV_BASE_FPS * dt;
          var distPx = distTiles * CELL;

          if (this._moving && this._axis !== null) {
            this._advanceAlongAxis(distPx);
          }

          if (!this._moving) {
            var _dir = this._readDesiredDir();

            if (_dir) {
              this._tryBeginStep(_dir.dc, _dir.dr);
            }
          }

          this._updatePlantVisual(dt);
        }

        _onKeyDown(e) {
          this._heldCodes.add(e.keyCode);
        }

        _onKeyUp(e) {
          this._heldCodes.delete(e.keyCode);
        }

        _readDesiredDir() {
          var r = this._heldCodes.has(KeyCode.KEY_D) || this._heldCodes.has(KeyCode.ARROW_RIGHT);

          var l = this._heldCodes.has(KeyCode.KEY_A) || this._heldCodes.has(KeyCode.ARROW_LEFT);

          var u = this._heldCodes.has(KeyCode.KEY_W) || this._heldCodes.has(KeyCode.ARROW_UP);

          var d = this._heldCodes.has(KeyCode.KEY_S) || this._heldCodes.has(KeyCode.ARROW_DOWN);

          if (r && !l) {
            return {
              dc: 1,
              dr: 0
            };
          }

          if (l && !r) {
            return {
              dc: -1,
              dr: 0
            };
          }

          if (u && !d) {
            return {
              dc: 0,
              dr: this.useAnchorAsGridOrigin ? -1 : 1
            };
          }

          if (d && !u) {
            return {
              dc: 0,
              dr: this.useAnchorAsGridOrigin ? 1 : -1
            };
          }

          return null;
        }

        _advanceAlongAxis(distPx) {
          var ut = this._ut;

          if (!ut) {
            return;
          }

          var cur = this.node.position;
          var rest = 1e-4;

          if (this._axis === 'x') {
            var dx = this._targetX - cur.x;

            if (Math.abs(dx) <= distPx + rest) {
              this._setPos(this._destCx, cur.y, cur.z);

              this._endStep();
            } else {
              this._setPos(cur.x + Math.sign(dx) * distPx, cur.y, cur.z);
            }
          } else {
            var dy = this._targetY - cur.y;

            if (Math.abs(dy) <= distPx + rest) {
              this._setPos(cur.x, this._destCy, cur.z);

              this._endStep();
            } else {
              this._setPos(cur.x, cur.y + Math.sign(dy) * distPx, cur.z);
            }
          }
        }

        _endStep() {
          this._moving = false;
          this._axis = null;
          var cur = this.node.position;

          this._setPos(this._destCx, this._destCy, cur.z);

          this._playIdleAnim(this._facing);

          if (this._stepCb) {
            this._stepCb(this._facing, this._destCx, this._destCy);
          }
        }

        _tryBeginStep(deltaCol, deltaRow) {
          var map = this.mapRoot;
          var ut = this._ut;

          if (!map || !ut || this._moving) {
            return false;
          }

          var mapUt = map.getComponent(UITransform);

          if (!mapUt) {
            return false;
          }

          var {
            originX,
            originY,
            cols,
            rows
          } = this._mapGridMetrics(map, mapUt);

          if (cols <= 0 || rows <= 0) {
            return false;
          }

          var cur = this.node.position;
          var cc = Math.floor((cur.x - originX) / CELL);
          var rr = this.useAnchorAsGridOrigin ? Math.floor((originY - cur.y) / CELL) : Math.floor((cur.y - originY) / CELL);
          var ncol = cc + deltaCol;
          var nrow = rr + deltaRow;

          if (ncol < 0 || ncol > cols - 1 || nrow < 0 || nrow > rows - 1) {
            return false;
          }

          this._destCx = originX + (ncol + 0.5) * CELL;
          this._destCy = this.useAnchorAsGridOrigin ? originY - (nrow + 0.5) * CELL : originY + (nrow + 0.5) * CELL;

          if (!this._canPassByTiledLayers(this._destCx, this._destCy)) {
            return false;
          }

          if (deltaCol !== 0) {
            this._facing = deltaCol > 0 ? 'right' : 'left';
            this._axis = 'x';
            this._targetX = this._destCx;
            this._targetY = cur.y;
          } else {
            // y 轴方向与 row 递增方向无关，按目标点相对当前位置决定朝向
            this._facing = this._destCy > cur.y ? 'up' : 'down';
            this._axis = 'y';
            this._targetY = this._destCy;
            this._targetX = cur.x;
          }

          this._moving = true;

          this._playMoveAnim(this._facing);

          return true;
        }
        /**
         * 尝试开始平滑走一格（MV 速率）；已开始移动则返回 true。
         */


        tryStep(deltaCol, deltaRow) {
          return this._tryBeginStep(deltaCol, deltaRow);
        }
        /** 订阅“开始走一格”事件（用于上报 world_step）。 */


        onStep(cb) {
          this._stepCb = cb;
        }
        /** 将当前位置吸附到最近合法格子中心（会取消未完成的移动） */


        snapToGrid() {
          this._moving = false;
          this._axis = null;

          this._snapToGridFromCurrentPos();

          this._updatePlantVisual(0);
        }
        /** 按格子坐标直接放置角色到格子中心（用于出生点/传送点）。 */


        placeAtGrid(col, row) {
          var map = this.mapRoot;
          var ut = this._ut;
          if (!map || !ut) return;
          var mapUt = map.getComponent(UITransform);
          if (!mapUt) return;

          var m = this._mapGridMetrics(map, mapUt);

          if (m.cols <= 0 || m.rows <= 0) return;
          var c = Math.min(m.cols - 1, Math.max(0, Math.floor(col)));
          var r = Math.min(m.rows - 1, Math.max(0, Math.floor(row)));
          var x = m.originX + (c + 0.5) * CELL;
          var y = this.useAnchorAsGridOrigin ? m.originY - (r + 0.5) * CELL : m.originY + (r + 0.5) * CELL;
          var z = this.node.position.z;

          this._setPos(x, y, z);

          this._destCx = x;
          this._destCy = y;

          this._updatePlantVisual(0);
        }
        /** 返回当前像素坐标（与节点实际坐标一致，不做 48 格换算）。 */


        getPixelPosition() {
          if (!this.node || !this.node.isValid) {
            return {
              x: Number.NaN,
              y: Number.NaN
            };
          }

          var p = this.node.position;
          return {
            x: p.x,
            y: p.y
          };
        }
        /** 当前是否处于一步移动中（用于网络状态同步） */


        isMovingNow() {
          return this._moving;
        }
        /** 当前朝向（用于网络状态同步） */


        getFacingDir() {
          return this._facing;
        }
        /** 外部设置角色动画前缀（例如 player7），并立即刷新到当前朝向待机动画。 */


        setAnimPrefix(prefix, refreshNow) {
          if (refreshNow === void 0) {
            refreshNow = true;
          }

          var p = (prefix || '').trim();
          if (!p) return false;

          if (this.strictAnimPrefix && !this._hasRequiredPrefixClips(p)) {
            this._logAnimPrefixMissing(p);

            return false;
          }

          this.animPrefix = p;

          if (refreshNow) {
            this._playIdleAnim(this._facing);
          }

          return true;
        }
        /** 按服务器 Sprite 应用前缀（Sprite=7 => player7） */


        applyServerSprite(spriteIndex, refreshNow) {
          if (refreshNow === void 0) {
            refreshNow = true;
          }

          if (this._animRt) {
            var ok = this._animRt.applyServerSprite(spriteIndex);

            if (ok) {
              this.animPrefix = this._animRt.prefix;
            }

            return ok;
          }

          if (!Number.isFinite(spriteIndex) || spriteIndex <= 0) return false;
          return this.setAnimPrefix("player" + Math.floor(spriteIndex), refreshNow);
        }
        /** 直接设置到像素坐标；可选吸附到格子中心。 */


        setPixelPosition(x, y, snapToGrid) {
          if (snapToGrid === void 0) {
            snapToGrid = false;
          }

          var z = this.node.position.z;

          this._setPos(x, y, z);

          if (snapToGrid) {
            this._snapToGridFromCurrentPos();
          }

          this._updatePlantVisual(0);
        }

        _snapToGridFromCurrentPos() {
          var map = this.mapRoot;
          var ut = this._ut;

          if (!map || !ut) {
            return;
          }

          var mapUt = map.getComponent(UITransform);

          if (!mapUt) {
            return;
          }

          var {
            originX,
            originY,
            cols,
            rows
          } = this._mapGridMetrics(map, mapUt);

          if (cols <= 0 || rows <= 0) {
            return;
          }

          var cur = this.node.position;
          var cc = Math.floor((cur.x - originX) / CELL);
          var rr = this.useAnchorAsGridOrigin ? Math.floor((originY - cur.y) / CELL) : Math.floor((cur.y - originY) / CELL);
          cc = Math.min(cols - 1, Math.max(0, cc));
          rr = Math.min(rows - 1, Math.max(0, rr));
          var cx = originX + (cc + 0.5) * CELL;
          var cy = this.useAnchorAsGridOrigin ? originY - (rr + 0.5) * CELL : originY + (rr + 0.5) * CELL;

          this._setPos(cx, cy, cur.z);
        }

        _setPos(x, y, z) {
          if (this._snapToPixel) {
            x = Math.round(x);
            y = Math.round(y);
          }

          this.node.setPosition(x, y, z);
        }
        /** 逐帧 spriteFrame 若带 trim，会改变内容框与视觉中心；关 trim + RAW 与整像素位移一致时最稳 */


        _applyPixelPerfectSpriteIfNeeded() {
          if (!this.pixelPerfectSprite) {
            return;
          }

          var sp = this.getComponent(Sprite);

          if (!sp) {
            return;
          }

          sp.trim = false;
          sp.sizeMode = Sprite.SizeMode.RAW;
        }

        _mapGridMetrics(map, mapUt) {
          var b = this._mapBoundsInParentSpace(map, mapUt);

          var originX = this.useAnchorAsGridOrigin ? map.position.x : b.minX;
          var originY = this.useAnchorAsGridOrigin ? map.position.y : b.minY;
          var cols = this.useAnchorAsGridOrigin ? Math.floor((b.maxX - originX) / CELL) : Math.floor((b.maxX - b.minX) / CELL);
          var rows = this.useAnchorAsGridOrigin ? Math.floor((originY - b.minY) / CELL) : Math.floor((b.maxY - b.minY) / CELL);
          return {
            originX,
            originY,
            cols,
            rows
          };
        }
        /**
         * 取地图“实际内容”在 Player 同父坐标系中的包围盒。
         * 兼容 MapRoot 左上锚点(0,1) 与多块拼接地图（子节点尺寸参与计算）。
         */


        _mapBoundsInParentSpace(map, mapUt) {
          var _map$parent;

          var parentUt = (_map$parent = map.parent) == null ? void 0 : _map$parent.getComponent(UITransform);

          if (!parentUt) {
            // 无法换坐标时回退到 MapRoot 自身尺寸
            var w = mapUt.width;
            var h = mapUt.height;
            var left = map.position.x - mapUt.anchorX * w;
            var right = left + w;
            var bottom = map.position.y - mapUt.anchorY * h;
            var top = bottom + h;
            return {
              minX: left,
              maxX: right,
              minY: bottom,
              maxY: top
            };
          }

          var minX = Infinity;
          var maxX = -Infinity;
          var minY = Infinity;
          var maxY = -Infinity;
          var tmp = this._tmpV3;

          var updateByNode = n => {
            var ut = n.getComponent(UITransform);
            if (!ut) return;
            var w = ut.width;
            var h = ut.height;
            var l = -ut.anchorX * w;
            var r = (1 - ut.anchorX) * w;
            var b = -ut.anchorY * h;
            var t = (1 - ut.anchorY) * h;
            var corners = [{
              x: l,
              y: b
            }, {
              x: r,
              y: b
            }, {
              x: l,
              y: t
            }, {
              x: r,
              y: t
            }];

            for (var i = 0; i < corners.length; i++) {
              tmp.set(corners[i].x, corners[i].y, 0);
              ut.convertToWorldSpaceAR(tmp, tmp);
              parentUt.convertToNodeSpaceAR(tmp, tmp);
              minX = Math.min(minX, tmp.x);
              maxX = Math.max(maxX, tmp.x);
              minY = Math.min(minY, tmp.y);
              maxY = Math.max(maxY, tmp.y);
            }
          };

          var stack = [map];

          while (stack.length > 0) {
            var n = stack.pop();
            updateByNode(n);

            for (var i = 0; i < n.children.length; i++) {
              stack.push(n.children[i]);
            }
          }

          if (!isFinite(minX) || !isFinite(minY)) {
            var _w = mapUt.width;
            var _h = mapUt.height;

            var _left = map.position.x - mapUt.anchorX * _w;

            var _right = _left + _w;

            var _bottom = map.position.y - mapUt.anchorY * _h;

            var _top = _bottom + _h;

            return {
              minX: _left,
              maxX: _right,
              minY: _bottom,
              maxY: _top
            };
          }

          return {
            minX,
            maxX,
            minY,
            maxY
          };
        }

        _refreshLayerNameSets() {
          var toSet = raw => new Set(raw.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0));

          this._blockedNameSet = toSet(this.blockedLayerNames);
          this._effectNameSet = toSet(this.passableEffectLayerNames);
        }

        _canPassByTiledLayers(targetX, targetY) {
          var flags = this._queryTileFlagsAtPoint(targetX, targetY);

          return !flags.blocked;
        }

        _queryTileFlagsAtPoint(targetX, targetY) {
          var map = this.mapRoot;
          if (!map) return {
            blocked: false,
            effect: false
          };

          var layers = this._collectTiledLayers(map);

          if (layers.length === 0) return {
            blocked: false,
            effect: false
          };
          var touchedEffect = false;

          for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            var lname = (layer.node.name || '').trim().toLowerCase();

            var gid = this._getLayerGidAtPoint(layer, targetX, targetY);

            if (gid <= 0) continue;

            if (this._blockedNameSet.has(lname)) {
              return {
                blocked: true,
                effect: touchedEffect
              };
            }

            if (this._effectNameSet.has(lname)) {
              touchedEffect = true;
            }
          }

          return {
            blocked: false,
            effect: touchedEffect
          };
        }

        _collectTiledLayers(root) {
          var out = [];
          var stack = [root];

          while (stack.length > 0) {
            var n = stack.pop();
            var layer = n.getComponent(TiledLayer);
            if (layer) out.push(layer);

            for (var i = 0; i < n.children.length; i++) {
              stack.push(n.children[i]);
            }
          }

          return out;
        }

        _getLayerGidAtPoint(layer, parentX, parentY) {
          var _this$mapRoot;

          var mapParentUt = (_this$mapRoot = this.mapRoot) == null || (_this$mapRoot = _this$mapRoot.parent) == null ? void 0 : _this$mapRoot.getComponent(UITransform);
          var ut = layer.getComponent(UITransform);
          if (!mapParentUt || !ut) return 0;
          var tileSize = layer.getMapTileSize();
          var layerSize = layer.getLayerSize();
          if (!tileSize || !layerSize) return 0;
          var p = this._tmpV3;
          p.set(parentX, parentY, 0);
          mapParentUt.convertToWorldSpaceAR(p, p);
          ut.convertToNodeSpaceAR(p, p);
          var left = -ut.anchorX * ut.width;
          var bottom = -ut.anchorY * ut.height;
          var tx = Math.floor((p.x - left) / tileSize.width);
          var tyBottom = Math.floor((p.y - bottom) / tileSize.height);

          if (tx < 0 || tx >= layerSize.width || tyBottom < 0 || tyBottom >= layerSize.height) {
            return 0;
          }

          var ty = this.tiledRowFromTop ? layerSize.height - 1 - tyBottom : tyBottom;
          return layer.getTileGIDAt(tx, ty);
        }

        _updatePlantVisual(dt) {
          var o = this._uiOpacity;
          if (!o) return;
          var p = this.node.position;

          var flags = this._queryTileFlagsAtPoint(p.x, p.y);

          this._inPlant = flags.effect;
          var target = this._inPlant ? misc.clampf(this.grassOpacity, 0, 255) : 255;

          if (dt <= 0) {
            o.opacity = target;
            return;
          }

          var cur = o.opacity;
          var step = Math.max(1, this.grassOpacityLerpSpeed * dt);

          if (Math.abs(target - cur) <= step) {
            o.opacity = target;
          } else {
            o.opacity = cur + Math.sign(target - cur) * step;
          }
        }

        _playMoveAnim(dir) {
          if (!this._animRt) return;

          this._animRt.playMove(dir);
        }

        _playIdleAnim(dir) {
          if (!this._animRt) return;

          this._animRt.playIdle(dir, true);
        }

        _getMoveAnimName(dir) {
          var p = (this.animPrefix || '').trim();
          if (!p) return '';
          return p + "_walk_" + dir;
        }

        _getIdleAnimName(dir) {
          var p = (this.animPrefix || '').trim();
          if (!p) return '';
          return p + "_idle_" + dir;
        }

        _getMoveAnimCandidates(dir) {
          var p = (this.animPrefix || '').trim();
          var out = [];
          if (p) out.push(p + "_walk_" + dir);

          if (!this.strictAnimPrefix) {
            out.push("walk_" + dir);
          }

          return out;
        }

        _getIdleAnimCandidates(dir) {
          var p = (this.animPrefix || '').trim();
          var out = [];
          if (p) out.push(p + "_idle_" + dir);

          if (!this.strictAnimPrefix) {
            out.push("idle_" + dir);
          }

          return out;
        }

        _resolvePlayableClip(candidates) {
          var anim = this._anim;
          if (!anim) return '';

          for (var i = 0; i < candidates.length; i++) {
            var name = candidates[i];
            if (!name) continue;
            if (anim.getState(name)) return name;
          }

          return '';
        }

        _hasRequiredPrefixClips(prefix) {
          var anim = this._anim;
          if (!anim) return false;
          var required = [prefix + "_idle_down", prefix + "_idle_left", prefix + "_idle_right", prefix + "_idle_up", prefix + "_walk_down", prefix + "_walk_left", prefix + "_walk_right", prefix + "_walk_up"];

          for (var i = 0; i < required.length; i++) {
            if (!anim.getState(required[i])) return false;
          }

          return true;
        }

        _logAnimPrefixMissing(prefix) {
          var anim = this._anim;
          if (!anim) return;
          var names = (anim.clips || []).map(c => c && c.name).filter(n => !!n);
          console.warn("[PlayerGridMove] strictAnimPrefix=ON\uFF0C\u4F46\u7F3A\u5C11 " + prefix + "_* \u7684\u5B8C\u65748\u4E2Aclip\u3002\u5F53\u524D\u5DF2\u6302\u8F7D:", names);
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "mapRoot", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "moveSpeed", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 4;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "dashLikeMV", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "animPrefix", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 'player1';
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "strictAnimPrefix", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "useAnchorAsGridOrigin", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "startGridCol", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "startGridRow", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "deferInitialPlaceToServerRestore", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "serverRestoreTimeoutSec", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 2.0;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "fallbackSpawnX", [_dec12], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 120.0;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "fallbackSpawnY", [_dec13], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return -24.0;
        }
      }), _descriptor13 = _applyDecoratedDescriptor(_class2.prototype, "blockedLayerNames", [_dec14], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 'Wall,items';
        }
      }), _descriptor14 = _applyDecoratedDescriptor(_class2.prototype, "passableEffectLayerNames", [_dec15], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 'plant';
        }
      }), _descriptor15 = _applyDecoratedDescriptor(_class2.prototype, "tiledRowFromTop", [_dec16], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor16 = _applyDecoratedDescriptor(_class2.prototype, "grassOpacity", [_dec17], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 170;
        }
      }), _descriptor17 = _applyDecoratedDescriptor(_class2.prototype, "grassOpacityLerpSpeed", [_dec18], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 720;
        }
      }), _descriptor18 = _applyDecoratedDescriptor(_class2.prototype, "pixelPerfectSprite", [_dec19], {
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
//# sourceMappingURL=aadc54e549d7bffffc13bf64a47fc4cbbb7851a0.js.map