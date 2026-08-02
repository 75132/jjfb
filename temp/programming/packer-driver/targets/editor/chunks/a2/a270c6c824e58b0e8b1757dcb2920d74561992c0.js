System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, find, Sprite, SpriteAtlas, SpriteFrame, tween, Vec3, ResourceManager, _dec, _dec2, _dec3, _dec4, _class, _class2, _descriptor, _descriptor2, _descriptor3, _class3, _crd, ccclass, property, RobotEvolutionEffect;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfResourceManager(extras) {
    _reporterNs.report("ResourceManager", "./ResourceManager", _context.meta, extras);
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
      find = _cc.find;
      Sprite = _cc.Sprite;
      SpriteAtlas = _cc.SpriteAtlas;
      SpriteFrame = _cc.SpriteFrame;
      tween = _cc.tween;
      Vec3 = _cc.Vec3;
    }, function (_unresolved_2) {
      ResourceManager = _unresolved_2.ResourceManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "90656pwDcBDHanyzoG5QyYt", "RobotEvolutionEffect", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'find', 'Sprite', 'SpriteAtlas', 'SpriteFrame', 'tween', 'Vec3', 'math', 'resources']);

      ({
        ccclass,
        property
      } = _decorator);
      /**
       * RobotEvolutionEffect
       * 负责在 Game 场景中控制 RobotJinHua 面板的进化动画。
       * 通过名字查找 `Canvas/RobotJinHua`，无需在编辑器绑定。
       */

      _export("RobotEvolutionEffect", RobotEvolutionEffect = (_dec = ccclass('RobotEvolutionEffect'), _dec2 = property({
        type: Node,
        tooltip: '根节点，留空则使用当前节点'
      }), _dec3 = property({
        type: Node,
        tooltip: '用于显示闪烁的 Sprite 节点，留空则自动查找 Jin/Robot'
      }), _dec4 = property({
        type: SpriteAtlas,
        tooltip: '进化图集，命名规则 AniID-0'
      }), _dec(_class = (_class2 = (_class3 = class RobotEvolutionEffect extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "rootNode", _descriptor, this);

          _initializerDefineProperty(this, "spriteNode", _descriptor2, this);

          _initializerDefineProperty(this, "atlas", _descriptor3, this);

          this.primarySprite = null;
          this.isPlaying = false;
          this.frameCache = new Map();
          this.currentOldFrameName = '';
          this.currentNewFrameName = '';
          this.tipNode = null;
          this.switchCallback = null;
          // 切换回调函数引用
          this.closeCallback = null;
          // 关闭回调函数引用
          this.useNewFrame = false;
          // 当前使用的帧（false=旧形态，true=新形态）
          this.startTime = 0;
          // 动画开始时间（毫秒）
          this.switchTotal = 3;
          // 总时长（秒）
          this.minInterval = 0.02;
          // 最快间隔（剧烈切换）
          this.maxInterval = 0.15;
          // 最慢间隔（缓慢切换）
          this.loadingFrames = new Set();
        }

        // 正在加载的帧名称集合
        static getInstance() {
          if (this._instance && this._instance.node && this._instance.node.isValid) {
            return this._instance;
          } // 默认查找 Canvas/RobotJinHua


          const panel = find('Canvas/RobotJinHua');

          if (!panel) {
            console.warn('[RobotEvolutionEffect] 未找到 RobotJinHua 节点');
            return null;
          }

          let comp = panel.getComponent(RobotEvolutionEffect);

          if (!comp) {
            comp = panel.addComponent(RobotEvolutionEffect);
          }

          comp.init();
          this._instance = comp;
          return comp;
        }

        init() {
          var _this$spriteNode;

          const root = this.spriteNode || this.rootNode || this.node;

          if (!this.spriteNode) {
            var _root$getChildByName;

            // 兼容美术层级：RobotJinHua -> Jin -> Robot
            this.spriteNode = ((_root$getChildByName = root.getChildByName('Jin')) == null ? void 0 : _root$getChildByName.getChildByName('Robot')) || root.getChildByName('Robot') || root;
          }

          this.primarySprite = ((_this$spriteNode = this.spriteNode) == null ? void 0 : _this$spriteNode.getComponent(Sprite)) || null; // 查找Tip节点（显示"进化成功!"）

          this.tipNode = this.node.getChildByName('Tip') || null;

          if (this.tipNode) {
            this.tipNode.active = false;
          }
        }
        /**
         * 播放进化动画
         * @param oldAniId 旧形态 AniID（如 bl_L1）
         * @param newAniId 新形态 AniID（如 bl_L2 或 bl_L3）
         */


        playEvolution(oldAniId, newAniId) {
          // 停止之前的动画
          this.stopEvolution();
          this.init();
          const root = this.rootNode || this.node;

          if (!this.primarySprite) {
            console.warn('[RobotEvolutionEffect] 缺少 Sprite 组件');
            return;
          }

          this.currentOldFrameName = `${oldAniId}-0`;
          this.currentNewFrameName = `${newAniId}-0`;
          console.log('[RobotEvolutionEffect] 请求进化动画', {
            oldAniId,
            newAniId,
            oldFrameName: this.currentOldFrameName,
            newFrameName: this.currentNewFrameName
          }); // 清空正在加载的帧集合

          this.loadingFrames.clear(); // 注意：不清空缓存，因为帧可能被复用
          // 如果需要强制重新加载，可以删除缓存
          // this.frameCache.delete(this.currentOldFrameName);
          // this.frameCache.delete(this.currentNewFrameName);
          // 显示面板和Robot节点

          this.node.active = true;
          root.active = true;
          root.setScale(new Vec3(1, 1, 1));
          root.setPosition(new Vec3(0, 0, 0)); // 重置状态

          this.useNewFrame = false;
          this.startTime = Date.now(); // 尝试获取帧

          const oldFrame = this.getFrameImmediate(this.currentOldFrameName);
          const newFrame = this.getFrameImmediate(this.currentNewFrameName); // 如果有旧形态的帧，立即显示

          if (oldFrame) {
            this.primarySprite.spriteFrame = oldFrame;
          }

          this.isPlaying = true; // 如果两个帧都已经加载完成，立即开始动画

          if (oldFrame && newFrame) {
            console.log('[RobotEvolutionEffect] 帧已缓存，立即开始切换动画');
            this.startSwitchAnimation();
          } else {
            // 异步加载帧（如果还没有）
            if (!oldFrame) {
              this.loadFrameAsync(this.currentOldFrameName);
            }

            if (!newFrame) {
              this.loadFrameAsync(this.currentNewFrameName);
            } // 如果至少有一个帧已加载，先启动动画（动画会等待另一个帧加载完成）


            if (oldFrame || newFrame) {
              this.startSwitchAnimation();
            }
          }
        }
        /**
         * 停止进化动画
         */


        stopEvolution() {
          this.isPlaying = false;

          if (this.switchCallback) {
            this.unschedule(this.switchCallback);
            this.switchCallback = null;
          }

          if (this.closeCallback) {
            this.unschedule(this.closeCallback);
            this.closeCallback = null;
          }

          tween(this.node).stop();

          if (this.tipNode) {
            tween(this.tipNode).stop();
          } // 清空正在加载的帧集合


          this.loadingFrames.clear();
        }
        /**
         * 开始切换动画
         */


        startSwitchAnimation() {
          // 停止之前的调度
          if (this.switchCallback) {
            this.unschedule(this.switchCallback);
            this.switchCallback = null;
          }

          const doSwitch = () => {
            if (!this.isPlaying || !this.primarySprite) {
              if (this.switchCallback) {
                this.unschedule(this.switchCallback);
                this.switchCallback = null;
              }

              return;
            }

            const now = Date.now();
            const elapsed = (now - this.startTime) / 1000; // 已过时间（秒）
            // 获取当前帧

            const oldF = this.getFrameImmediate(this.currentOldFrameName);
            const newF = this.getFrameImmediate(this.currentNewFrameName); // 如果两个帧都加载了，进行切换

            if (oldF && newF) {
              // 切换帧
              this.useNewFrame = !this.useNewFrame;
              const targetFrame = this.useNewFrame ? newF : oldF;
              this.primarySprite.spriteFrame = targetFrame;
              console.log('[RobotEvolutionEffect] ✅ 切换帧', {
                elapsed: elapsed.toFixed(2),
                useNew: this.useNewFrame,
                frameName: targetFrame.name
              }); // 检查是否应该结束

              if (elapsed >= this.switchTotal) {
                // 结束时定格在新形态
                this.primarySprite.spriteFrame = newF;
                this.isPlaying = false;

                if (this.switchCallback) {
                  this.unschedule(this.switchCallback);
                  this.switchCallback = null;
                }

                console.log('[RobotEvolutionEffect] 切换完成，定格新形态', {
                  frameName: newF.name
                });
                this.showTipAndClose();
                return;
              } // 计算当前应该使用的间隔（从快到慢）


              const progress = Math.min(elapsed / this.switchTotal, 1);
              const easeOutProgress = 1 - (1 - progress) * (1 - progress); // easeOutQuad

              const currentInterval = this.minInterval + (this.maxInterval - this.minInterval) * easeOutProgress; // 取消之前的调度，用新间隔重新调度

              if (this.switchCallback) {
                this.unschedule(this.switchCallback);
              }

              this.switchCallback = doSwitch;
              this.schedule(this.switchCallback, currentInterval);
            } else {
              // 如果帧还没加载完，等待一下再试
              if (oldF || newF) {
                // 至少有一个帧加载了，先显示它
                const availableFrame = newF || oldF;

                if (availableFrame) {
                  this.primarySprite.spriteFrame = availableFrame;
                }
              } // 继续等待（短间隔，确保加载完成后立即切换）


              if (this.switchCallback) {
                this.unschedule(this.switchCallback);
              }

              this.switchCallback = doSwitch;
              this.schedule(this.switchCallback, 0.05);
            }
          }; // 保存回调引用并开始调度


          this.switchCallback = doSwitch;
          this.schedule(this.switchCallback, this.minInterval);
        }

        getFrameImmediate(frameName) {
          var _this$primarySprite;

          if (!frameName) return null;

          if (this.frameCache.has(frameName)) {
            return this.frameCache.get(frameName) || null;
          }

          const atlas = this.atlas;

          if (atlas) {
            const frame = atlas.getSpriteFrame(frameName);

            if (frame) {
              this.frameCache.set(frameName, frame);
              return frame;
            }
          }

          if ((_this$primarySprite = this.primarySprite) != null && _this$primarySprite.spriteFrame && this.primarySprite.spriteFrame.name === frameName) {
            return this.primarySprite.spriteFrame;
          }

          return null;
        }

        loadFrameAsync(frameName) {
          if (!frameName) {
            return;
          } // 如果已经在缓存中，直接返回


          if (this.frameCache.has(frameName)) {
            // 如果正在播放动画且帧已加载，立即检查是否可以开始切换
            if (this.isPlaying && this.primarySprite) {
              const oldF = this.getFrameImmediate(this.currentOldFrameName);
              const newF = this.getFrameImmediate(this.currentNewFrameName);

              if (oldF && newF && !this.switchCallback) {
                // 如果调度器意外停止，重新启动
                this.startSwitchAnimation();
              }
            }

            return;
          } // 如果正在加载中，避免重复加载


          if (this.loadingFrames.has(frameName)) {
            return;
          } // 标记为正在加载


          this.loadingFrames.add(frameName); // 资源已移动到 assets/resources/Robot 目录，文件直接放在 Robot 下
          // Cocos Creator 3.x 中，单张图片会生成 Texture2D + SpriteFrame 子资源：
          //  - 图片导入路径：assets/resources/Robot/xh_L1-0.png
          //  - 对应 SpriteFrame 资源路径：Robot/xh_L1-0/spriteFrame
          // resources.load 的路径不包含 "resources" 前缀，这里直接加载 SpriteFrame 子资源

          const path = `Robot/${frameName}/spriteFrame`;
          console.log('[RobotEvolutionEffect] 开始加载帧', {
            frameName,
            path
          }); // 使用 ResourceManager 统一管理资源缓存

          (_crd && ResourceManager === void 0 ? (_reportPossibleCrUseOfResourceManager({
            error: Error()
          }), ResourceManager) : ResourceManager).getInstance().loadAsset(path, SpriteFrame, (err, sf) => {
            // 移除加载标记
            this.loadingFrames.delete(frameName);

            if (err || !sf) {
              console.warn('[RobotEvolutionEffect] 加载帧失败', {
                frameName,
                path,
                err
              });
              return;
            } // 检查是否还在播放动画（可能在加载过程中动画已停止）


            if (!this.isPlaying) {
              console.log('[RobotEvolutionEffect] 帧加载完成但动画已停止', {
                frameName
              });
              return;
            }

            this.frameCache.set(frameName, sf);
            console.log('[RobotEvolutionEffect] 加载帧成功', {
              frameName,
              path
            }); // 图片加载完成后，如果正在播放动画，立即应用

            if (this.isPlaying && this.primarySprite) {
              // 如果是旧形态帧且当前没有显示任何帧，立即显示
              if (frameName === this.currentOldFrameName && !this.primarySprite.spriteFrame) {
                this.primarySprite.spriteFrame = sf;
                console.log('[RobotEvolutionEffect] 应用旧形态帧', {
                  frameName
                });
              } // 如果两个帧都加载完成，确保动画已经开始切换


              const oldF = this.getFrameImmediate(this.currentOldFrameName);
              const newF = this.getFrameImmediate(this.currentNewFrameName);

              if (oldF && newF) {
                if (!this.switchCallback) {
                  // 如果调度器意外停止，重新启动
                  console.log('[RobotEvolutionEffect] 帧加载完成，重新启动切换动画');
                  this.startSwitchAnimation();
                }
              }
            }
          });
        }

        showTipAndClose() {
          // 清理之前的关闭回调
          if (this.closeCallback) {
            this.unschedule(this.closeCallback);
            this.closeCallback = null;
          } // 显示Tip面板（"进化成功!"）


          if (this.tipNode) {
            this.tipNode.active = true; // Tip面板可以添加淡入动画（可选）

            this.tipNode.setScale(new Vec3(0, 0, 1));
            tween(this.tipNode).to(0.3, {
              scale: new Vec3(1, 1, 1)
            }, {
              easing: 'backOut'
            }).start();
          } // 2 秒后关闭整個面板（RobotJinHua）


          this.closeCallback = () => {
            this.stopEvolution();

            if (this.tipNode) {
              this.tipNode.active = false;
            }

            this.node.active = false;
            this.closeCallback = null;
          };

          this.scheduleOnce(this.closeCallback, 2);
        }

      }, _class3._instance = null, _class3), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "rootNode", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "spriteNode", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "atlas", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=a270c6c824e58b0e8b1757dcb2920d74561992c0.js.map