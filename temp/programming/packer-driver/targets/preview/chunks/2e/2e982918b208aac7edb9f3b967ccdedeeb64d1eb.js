System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, UITransform, misc, v3, PlayerGridMove, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _crd, ccclass, property, WorldFollow;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfPlayerGridMove(extras) {
    _reporterNs.report("PlayerGridMove", "./PlayerGridMove", _context.meta, extras);
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
      misc = _cc.misc;
      v3 = _cc.v3;
    }, function (_unresolved_2) {
      PlayerGridMove = _unresolved_2.PlayerGridMove;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "be357UgRh9L6qrUtmBJutTz", "WorldFollow", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'UITransform', 'misc', 'v3']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("WorldFollow", WorldFollow = (_dec = ccclass('WorldFollow'), _dec2 = property({
        type: Node,
        tooltip: 'Player 节点'
      }), _dec3 = property({
        type: Node,
        tooltip: 'GameArea（480×540 + Mask）'
      }), _dec4 = property({
        type: Node,
        tooltip: 'MapRoot 地图根节点'
      }), _dec5 = property({
        tooltip: '将 WorldRoot 最终坐标四舍五入到整像素，减少 48 格对齐时的次像素抖动'
      }), _dec6 = property({
        tooltip: 'Player 未拖引用时，在运行时从本节点（WorldRoot）子级按名称 Player 或 PlayerGridMove 自动查找'
      }), _dec(_class = (_class2 = class WorldFollow extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "player", _descriptor, this);

          _initializerDefineProperty(this, "gameArea", _descriptor2, this);

          _initializerDefineProperty(this, "mapRoot", _descriptor3, this);

          _initializerDefineProperty(this, "pixelAlign", _descriptor4, this);

          _initializerDefineProperty(this, "autoResolvePlayer", _descriptor5, this);

          this._tmp = v3();
        }

        onLoad() {
          if (!this.autoResolvePlayer || this.player) {
            return;
          }

          var wr = this.node;
          var n = wr.getChildByName('Player');

          if (!n) {
            for (var i = 0; i < wr.children.length; i++) {
              var ch = wr.children[i];

              if (ch.getComponent(_crd && PlayerGridMove === void 0 ? (_reportPossibleCrUseOfPlayerGridMove({
                error: Error()
              }), PlayerGridMove) : PlayerGridMove)) {
                n = ch;
                break;
              }
            }
          }

          this.player = n;
        }

        lateUpdate() {
          var player = this.player;
          var gameArea = this.gameArea;
          var mapRoot = this.mapRoot;

          if (!player || !gameArea || !mapRoot) {
            return;
          }

          var gaUt = gameArea.getComponent(UITransform);
          var pUt = player.getComponent(UITransform);

          if (!gaUt || !pUt) {
            return;
          }

          var v = this._viewportLocal(gaUt);

          var playerGa = gaUt.convertToNodeSpaceAR(player.worldPosition, this._tmp);
          var centerX = (v.left + v.right) * 0.5;
          var centerY = (v.bottom + v.top) * 0.5;
          var wr = this.node.position;
          var idealX = wr.x + (centerX - playerGa.x);
          var idealY = wr.y + (centerY - playerGa.y);

          var C = this._mapEdgeConstants(mapRoot, gameArea);

          var xMin = v.right - C.maxX;
          var xMax = v.left - C.minX;
          var yMin = v.top - C.maxY;
          var yMax = v.bottom - C.minY;
          var nx = idealX;
          var ny = idealY;

          if (xMin <= xMax) {
            nx = misc.clampf(idealX, xMin, xMax);
          } else {
            nx = (xMin + xMax) * 0.5;
          }

          if (yMin <= yMax) {
            ny = misc.clampf(idealY, yMin, yMax);
          } else {
            ny = (yMin + yMax) * 0.5;
          }

          if (this.pixelAlign) {
            nx = Math.round(nx);
            ny = Math.round(ny);
          }

          this.node.setPosition(nx, ny, wr.z);
        }

        _viewportLocal(gaUt) {
          var w = gaUt.width;
          var h = gaUt.height;
          var ax = gaUt.anchorX;
          var ay = gaUt.anchorY;
          var left = -ax * w;
          var right = (1 - ax) * w;
          var bottom = -ay * h;
          var top = (1 - ay) * h;
          return {
            left,
            right,
            bottom,
            top
          };
        }
        /**
         * 在当前 WorldRoot 位移下，地图包络在 GameArea 本地座标中的 min/max，
         * 并分解为「与 wr 无关的常数项 + wr」：edges = wr + C
         */

        /**
         * 在 wr.x=0 / wr.y=0 的基准下取得地图在 GameArea 内的包络，
         * 使得 mapMinX = C.minX + wr.x、mapMaxX = C.maxX + wr.x（y 固定为当前 wr.y），
         * mapMinY / mapMaxY 同理随 wr.y 平移。
         */


        _mapEdgeConstants(mapRoot, gameArea) {
          var wr = this.node.position;
          var wx = wr.x;
          var wy = wr.y;

          try {
            this.node.setPosition(0, wy, wr.z);

            var ex = this._mapAabbInGameArea(mapRoot, gameArea);

            this.node.setPosition(wx, 0, wr.z);

            var ey = this._mapAabbInGameArea(mapRoot, gameArea);

            return {
              minX: ex.minX,
              maxX: ex.maxX,
              minY: ey.minY,
              maxY: ey.maxY
            };
          } finally {
            this.node.setPosition(wx, wy, wr.z);
          }
        }

        _mapAabbInGameArea(mapRoot, gameArea) {
          var gaUt = gameArea.getComponent(UITransform);
          var minX = Infinity;
          var maxX = -Infinity;
          var minY = Infinity;
          var maxY = -Infinity;
          var tmp = v3();
          var stack = [mapRoot];

          while (stack.length > 0) {
            var n = stack.pop();
            var ut = n.getComponent(UITransform);

            if (ut) {
              var w = ut.width;
              var h = ut.height;
              var left = -ut.anchorX * w;
              var right = (1 - ut.anchorX) * w;
              var bottom = -ut.anchorY * h;
              var top = (1 - ut.anchorY) * h;
              var corners = [v3(left, bottom), v3(right, bottom), v3(left, top), v3(right, top)];

              for (var i = 0; i < corners.length; i++) {
                ut.convertToWorldSpaceAR(corners[i], tmp);
                gaUt.convertToNodeSpaceAR(tmp, tmp);
                minX = Math.min(minX, tmp.x);
                maxX = Math.max(maxX, tmp.x);
                minY = Math.min(minY, tmp.y);
                maxY = Math.max(maxY, tmp.y);
              }
            }

            for (var _i = 0; _i < n.children.length; _i++) {
              stack.push(n.children[_i]);
            }
          }

          if (!isFinite(minX) || !isFinite(minY)) {
            var mUt = mapRoot.getComponent(UITransform);
            var _w = mUt.width;
            var _h = mUt.height;

            var _left = -mUt.anchorX * _w;

            var _right = (1 - mUt.anchorX) * _w;

            var _bottom = -mUt.anchorY * _h;

            var _top = (1 - mUt.anchorY) * _h;

            var _corners = [v3(_left, _bottom), v3(_right, _bottom), v3(_left, _top), v3(_right, _top)];

            for (var _i2 = 0; _i2 < _corners.length; _i2++) {
              mUt.convertToWorldSpaceAR(_corners[_i2], tmp);
              gaUt.convertToNodeSpaceAR(tmp, tmp);
              minX = Math.min(minX, tmp.x);
              maxX = Math.max(maxX, tmp.x);
              minY = Math.min(minY, tmp.y);
              maxY = Math.max(maxY, tmp.y);
            }
          }

          return {
            minX,
            maxX,
            minY,
            maxY
          };
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "player", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "gameArea", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "mapRoot", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "pixelAlign", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "autoResolvePlayer", [_dec6], {
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
//# sourceMappingURL=2e982918b208aac7edb9f3b967ccdedeeb64d1eb.js.map