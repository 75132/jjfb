System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4", "__unresolved_5"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Label, Button, UITransform, Animation, tween, WebSocketManager, GameConfig, RobotShow, DataCacheManager, MechEquipment, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _dec14, _dec15, _dec16, _dec17, _dec18, _dec19, _dec20, _dec21, _dec22, _dec23, _dec24, _dec25, _dec26, _dec27, _dec28, _dec29, _dec30, _dec31, _dec32, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _descriptor13, _descriptor14, _descriptor15, _descriptor16, _descriptor17, _descriptor18, _descriptor19, _descriptor20, _descriptor21, _descriptor22, _descriptor23, _descriptor24, _descriptor25, _descriptor26, _descriptor27, _descriptor28, _descriptor29, _descriptor30, _descriptor31, _class3, _crd, ccclass, property, MechAttributeTEST;

  function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

  function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

  function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "../global/GameConfig", _context.meta, extras);
  }

  function _reportPossibleCrUseOfRobotShow(extras) {
    _reporterNs.report("RobotShow", "./RobotShow", _context.meta, extras);
  }

  function _reportPossibleCrUseOfDataCacheManager(extras) {
    _reporterNs.report("DataCacheManager", "../global/DataCacheManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfMechEquipment(extras) {
    _reporterNs.report("MechEquipment", "./MechEquipment", _context.meta, extras);
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
      UITransform = _cc.UITransform;
      Animation = _cc.Animation;
      tween = _cc.tween;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      GameConfig = _unresolved_3.GameConfig;
    }, function (_unresolved_4) {
      RobotShow = _unresolved_4.RobotShow;
    }, function (_unresolved_5) {
      DataCacheManager = _unresolved_5.DataCacheManager;
    }, function (_unresolved_6) {
      MechEquipment = _unresolved_6.MechEquipment;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "c1cf118hKFAQrEuzFdl2cHN", "MechAttributeTEST", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Label', 'Button', 'UITransform', 'Animation', 'Vec3', 'tween']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("MechAttributeTEST", MechAttributeTEST = (_dec = ccclass('MechAttributeTEST'), _dec2 = property({
        tooltip: "悬浮高度"
      }), _dec3 = property({
        tooltip: "悬浮动画周期时长"
      }), _dec4 = property({
        tooltip: "启用悬浮效果"
      }), _dec5 = property({
        tooltip: "悬浮时进行像素对齐，减少锯齿"
      }), _dec6 = property({
        type: [Node],
        tooltip: "拖拽绑定需要悬浮的节点"
      }), _dec7 = property(Node), _dec8 = property(Node), _dec9 = property(Node), _dec10 = property(Node), _dec11 = property(Node), _dec12 = property(Node), _dec13 = property(Node), _dec14 = property(Node), _dec15 = property(Node), _dec16 = property(Node), _dec17 = property(Node), _dec18 = property(Node), _dec19 = property(Node), _dec20 = property(Node), _dec21 = property(Node), _dec22 = property(Node), _dec23 = property(Node), _dec24 = property(Node), _dec25 = property(Node), _dec26 = property(Node), _dec27 = property(Button), _dec28 = property(Node), _dec29 = property(Node), _dec30 = property(Node), _dec31 = property(Node), _dec32 = property({
        type: _crd && RobotShow === void 0 ? (_reportPossibleCrUseOfRobotShow({
          error: Error()
        }), RobotShow) : RobotShow,
        tooltip: '机甲展示组件（新的 RobotShow 预制体脚本）'
      }), _dec(_class = (_class2 = (_class3 = class MechAttributeTEST extends Component {
        constructor() {
          super(...arguments);

          // 悬浮效果相关属性
          _initializerDefineProperty(this, "floatAmplitude", _descriptor, this);

          _initializerDefineProperty(this, "floatDuration", _descriptor2, this);

          _initializerDefineProperty(this, "enableFloat", _descriptor3, this);

          _initializerDefineProperty(this, "pixelSnap", _descriptor4, this);

          this.originalPosMap = new Map();
          this.floatPhaseMap = new Map();
          this.floatTime = 0;

          _initializerDefineProperty(this, "floatNodes", _descriptor5, this);

          _initializerDefineProperty(this, "Growth", _descriptor6, this);

          _initializerDefineProperty(this, "Comprehension", _descriptor7, this);

          _initializerDefineProperty(this, "StarLevel", _descriptor8, this);

          _initializerDefineProperty(this, "Star", _descriptor9, this);

          _initializerDefineProperty(this, "Melee", _descriptor10, this);

          _initializerDefineProperty(this, "Armor", _descriptor11, this);

          _initializerDefineProperty(this, "Accuracy", _descriptor12, this);

          _initializerDefineProperty(this, "Corrosion", _descriptor13, this);

          _initializerDefineProperty(this, "Initiative", _descriptor14, this);

          _initializerDefineProperty(this, "Block", _descriptor15, this);

          _initializerDefineProperty(this, "ParticleShield", _descriptor16, this);

          _initializerDefineProperty(this, "ArmorPenetration", _descriptor17, this);

          _initializerDefineProperty(this, "Shooting", _descriptor18, this);

          _initializerDefineProperty(this, "Evasion", _descriptor19, this);

          _initializerDefineProperty(this, "Lethality", _descriptor20, this);

          _initializerDefineProperty(this, "Resistance", _descriptor21, this);

          _initializerDefineProperty(this, "Counterattack", _descriptor22, this);

          _initializerDefineProperty(this, "HP", _descriptor23, this);

          _initializerDefineProperty(this, "MP", _descriptor24, this);

          _initializerDefineProperty(this, "EXP", _descriptor25, this);

          _initializerDefineProperty(this, "FetchButton", _descriptor26, this);

          _initializerDefineProperty(this, "RobotName", _descriptor27, this);

          _initializerDefineProperty(this, "Level", _descriptor28, this);

          _initializerDefineProperty(this, "Class", _descriptor29, this);

          // 旧：直接绑定 Robot 节点
          _initializerDefineProperty(this, "Robot", _descriptor30, this);

          // 新：独立的机甲展示组件（推荐在预制体上挂 RobotShow，并在这里拖引用）
          _initializerDefineProperty(this, "robotShow", _descriptor31, this);

          this.nodeMap = {};
          this.textMap = {};
          this.barMap = {};
          this.wsManager = null;
          // 初始化状态标记
          this.isInitialized = false;
          this.initializationPromise = null;
          // 是否已注册消息监听
          this.isListenerRegistered = false;
          // 关键修复：跟踪当前应该显示的机甲ID，防止显示错误的机甲
          this.currentPetId = null;

          this.onRobotInfo = data => {
            try {
              var _ref, _data$pet_id, _data$data;

              // 关键修复：即使 success 为 false，也尝试使用数据（可能是部分数据）
              // 但如果没有数据对象本身，则返回
              if (!data) {
                return;
              } // 关键修复：提取 petId 并验证是否匹配当前显示的机甲


              var rawPetId = (_ref = (_data$pet_id = data.pet_id) != null ? _data$pet_id : (_data$data = data.data) == null ? void 0 : _data$data.pet_id) != null ? _ref : null;
              var petId = rawPetId !== null && rawPetId !== undefined ? String(rawPetId) : null;
              var normIncoming = this.normPetId(petId);
              var normCurrent = this.normPetId(this.currentPetId); // 如果界面已有目标机甲ID，而本次消息没有 petId 或者与当前不一致，则跳过

              if (normCurrent !== null) {
                if (!normIncoming) {
                  return;
                }

                if (normIncoming !== normCurrent) {
                  return;
                }
              } // 如果 success 为 false，继续处理（可能是部分数据或缓存数据）


              if (data.success === false) {// 不直接返回，继续处理，因为可能包含部分有效数据
              } // 关键修复：更新 currentPetId（如果数据中有 petId）


              if (petId) {
                this.currentPetId = String(petId).trim();
              }

              for (var _key in this.textMap) {
                if (this.textMap[_key]) {
                  if (_key === 'Star') {
                    var _data$StarLevel;

                    this.textMap[_key].string = String((_data$StarLevel = data['StarLevel']) != null ? _data$StarLevel : '');
                  } else if (_key === 'RobotName') {
                    var _data$RobotName;

                    var name = (_data$RobotName = data['RobotName']) != null ? _data$RobotName : ''; // 优先使用Form字段，如果没有则使用Fo字段（兼容性）

                    var formNum = data['Form'] !== undefined ? data['Form'] : data['Fo'] !== undefined ? data['Fo'] : 0;
                    var formSuffix = '';
                    if (formNum === 1) formSuffix = '|初';else if (formNum === 2) formSuffix = '|中';else if (formNum === 3) formSuffix = '|终';
                    this.textMap[_key].string = name + formSuffix;
                  } else if (_key === 'Class') {
                    var classNum = data['Class'];
                    var classStr = '';
                    if (classNum === 1) classStr = '格斗型';else if (classNum === 2) classStr = '射击型';else if (classNum === 3) classStr = '全能型';
                    this.textMap[_key].string = classStr;
                  } else if (_key === 'Level') {
                    var _data$Level;

                    this.textMap[_key].string = String((_data$Level = data['Level']) != null ? _data$Level : '');
                  } else {
                    var _data$_key;

                    this.textMap[_key].string = String((_data$_key = data[_key]) != null ? _data$_key : '');
                  }
                }
              }

              for (var _key2 in this.nodeMap) {
                var group = this.nodeMap[_key2];

                if (group.left && group.right && group.slash) {
                  var _data$_key2;

                  var currentKey = 'Current' + _key2;
                  var baseValue = (_data$_key2 = data[_key2]) != null ? _data$_key2 : 0;
                  var currentValue = data[currentKey]; // 如果存在 Current 字段（包括值为 0 的情况），显示基础值/当前值

                  if (Object.prototype.hasOwnProperty.call(data, currentKey)) {
                    group.left.string = String(baseValue);
                    group.right.string = String(currentValue != null ? currentValue : 0);
                    group.slash.active = true;
                  } else {
                    // 如果不存在 Current 字段，只显示基础值
                    group.left.string = String(baseValue);
                    group.right.string = '';
                    group.slash.active = false;
                  }
                }
              }

              var barKeys = [{
                key: 'HP',
                max: 'MaxHP',
                cur: 'CurrentHP',
                panel: 'HPpanel'
              }, {
                key: 'MP',
                max: 'MaxMP',
                cur: 'CurrentMP',
                panel: 'MPpanel'
              }, {
                key: 'EXP',
                max: 'MaxEXP',
                cur: 'CurrentEXP',
                panel: 'EXPpanel'
              }];

              for (var item of barKeys) {
                var bar = this.barMap[item.key];

                if (bar && bar.label && bar.bar) {
                  var _data$item$cur, _data$item$max;

                  var cur = (_data$item$cur = data[item.cur]) != null ? _data$item$cur : 0;
                  var max = (_data$item$max = data[item.max]) != null ? _data$item$max : 0; // 只有经验条显示"万"格式，其他属性直接显示数字

                  if (item.key === 'EXP') {
                    bar.label.string = this.formatExpValue(cur) + "/" + this.formatExpValue(max);
                  } else {
                    bar.label.string = cur + "/" + max;
                  }

                  this.setBarWidth(bar.bar, cur, max);
                }
              } // —— 机甲形象展示 —— //
              // 关键修复：即使 success 为 false，也尝试更新 RobotShow（可能包含装备数据）


              if (this.robotShow) {
                // 优先走新的 RobotShow 组件（包含动画 + 装备图标）
                try {
                  var _data$data2;

                  // 关键修复：确保 data 中包含 petId，以便 RobotShow 可以验证数据匹配
                  var dataWithPetId = _extends({}, data, {
                    pet_id: this.currentPetId || petId || data.pet_id || ((_data$data2 = data.data) == null ? void 0 : _data$data2.pet_id) || null
                  });

                  this.robotShow.updateFromRobotData(dataWithPetId);
                } catch (error) {}
              } else if (this.Robot) {
                // 兼容旧逻辑：直接在 Robot 节点上播放动画
                var anim = this.Robot.getComponent(Animation);

                if (anim && Array.isArray(anim.clips) && anim.clips.length > 0) {
                  var clips = anim.clips;
                  var aniID = data['AniID'] || '';

                  if (aniID && typeof aniID === 'string') {
                    var targetClip = clips.find(clip => clip && clip.name === aniID);

                    if (targetClip) {
                      anim.play(aniID);
                    } else {
                      var idx = Math.floor(Math.random() * clips.length);
                      var clip = clips[idx];

                      if (clip && clip.name) {
                        anim.play(clip.name);
                      }
                    }
                  } else {
                    var _idx = Math.floor(Math.random() * clips.length);

                    var _clip = clips[_idx];

                    if (_clip && _clip.name) {
                      anim.play(_clip.name);
                    }
                  }
                }
              } // 关键修复：缓存数据到 DataCacheManager，供其他组件使用
              // 注意：使用 this.currentPetId 或已提取的 petId，因为已经在前面提取并更新了


              var cacheManager = (_crd && DataCacheManager === void 0 ? (_reportPossibleCrUseOfDataCacheManager({
                error: Error()
              }), DataCacheManager) : DataCacheManager).getInstance(); // 使用已更新的 currentPetId 或之前提取的 petId

              var cachePetId = this.currentPetId || petId;

              if (cachePetId) {
                var _data$data3;

                // 确保缓存的数据格式正确（包含 success 字段和 equipment 字段）
                var cacheData = _extends({
                  success: true,
                  pet_id: cachePetId,
                  equipment: ((_data$data3 = data.data) == null ? void 0 : _data$data3.equipment) || data.equipment || {}
                }, data);

                cacheManager.setRobotPetInfoCache(cachePetId, cacheData);
              }
            } catch (e) {}
          };
        }

        /** 统一 pet_id 比较（避免大小写/空白导致误判为「另一只」） */
        normPetId(pid) {
          if (pid === null || pid === undefined) return null;
          var s = String(pid).trim();
          return s.length ? s.toLowerCase() : null;
        }

        start() {
          // 性能优化：立即初始化，不延迟
          // 延迟会导致第一次打开面板时等待初始化
          this.initializationPromise = this.initializeAsync();
        }
        /**
         * 异步初始化组件
         */


        initializeAsync() {
          var _this = this;

          return _asyncToGenerator(function* () {
            try {
              // 分步初始化，避免一次性处理太多
              yield _this.initializeTextComponents();
              yield _this.initializeNodeComponents();
              yield _this.initializeBarComponents();
              yield _this.initializeButton(); // 标记初始化完成

              _this.isInitialized = true; // 最后启动悬浮效果

              if (_this.enableFloat) {
                _this.startFloatEffect();
              }
            } catch (error) {}
          })();
        }
        /**
         * 初始化文本组件
         */


        initializeTextComponents() {
          var _this2 = this;

          return _asyncToGenerator(function* () {
            return new Promise(resolve => {
              // 普通文本型
              var textKeys = ['Growth', 'Comprehension', 'StarLevel', 'Star', 'RobotName', 'Level', 'Class'];

              for (var _key3 of textKeys) {
                var parent = _this2[_key3];

                if (parent) {
                  var labelNode = parent.getChildByName('NumericalValue');

                  if (labelNode) {
                    _this2.textMap[_key3] = labelNode.getComponent(Label) || null;
                  }
                }
              }

              resolve();
            });
          })();
        }
        /**
         * 初始化节点组件
         */


        initializeNodeComponents() {
          var _this3 = this;

          return _asyncToGenerator(function* () {
            return new Promise(resolve => {
              // 分割型
              var keys = ['Melee', 'Armor', 'Accuracy', 'Corrosion', 'Initiative', 'Block', 'ParticleShield', 'ArmorPenetration', 'Shooting', 'Evasion', 'Lethality', 'Resistance', 'Counterattack'];

              for (var _key4 of keys) {
                var parent = _this3[_key4];

                if (parent) {
                  var layoutNode = parent.getChildByName('Node');

                  if (layoutNode) {
                    var _layoutNode$getChildB, _layoutNode$getChildB2;

                    _this3.nodeMap[_key4] = {
                      left: ((_layoutNode$getChildB = layoutNode.getChildByName('LeftLabel')) == null ? void 0 : _layoutNode$getChildB.getComponent(Label)) || null,
                      right: ((_layoutNode$getChildB2 = layoutNode.getChildByName('RightLabel')) == null ? void 0 : _layoutNode$getChildB2.getComponent(Label)) || null,
                      slash: layoutNode.getChildByName('SlashSprite') || null
                    };
                  }
                }
              }

              resolve();
            });
          })();
        }
        /**
         * 初始化进度条组件
         */


        initializeBarComponents() {
          var _this4 = this;

          return _asyncToGenerator(function* () {
            return new Promise(resolve => {
              // HP/MP/EXP 进度条和数值（panel名称分别为HPpanel、MPpanel、EXPpanel）
              var barKeys = [{
                key: 'HP',
                max: 'MaxHP',
                cur: 'CurrentHP',
                panel: 'HPpanel'
              }, {
                key: 'MP',
                max: 'MaxMP',
                cur: 'CurrentMP',
                panel: 'MPpanel'
              }, {
                key: 'EXP',
                max: 'MaxEXP',
                cur: 'CurrentEXP',
                panel: 'EXPpanel'
              }];

              for (var item of barKeys) {
                var parent = _this4[item.key];

                if (parent) {
                  var panel = parent.getChildByName(item.panel);
                  var barNode = panel == null ? void 0 : panel.getChildByName(item.cur); // CurrentHP/CurrentMP/CurrentEXP

                  var labelNode = panel == null ? void 0 : panel.getChildByName('NumericalValue');

                  if (barNode && labelNode) {
                    _this4.barMap[item.key] = {
                      bar: barNode,
                      label: labelNode.getComponent(Label) || null
                    };
                  }
                }
              }

              resolve();
            });
          })();
        }
        /**
         * 初始化按钮
         */


        initializeButton() {
          var _this5 = this;

          return _asyncToGenerator(function* () {
            return new Promise(resolve => {
              if (_this5.FetchButton) {
                _this5.FetchButton.node.on('click', _this5.onFetchClick, _this5);
              }

              resolve();
            });
          })();
        } // 启动悬浮效果


        startFloatEffect() {
          if (!this.enableFloat || this.floatNodes.length === 0) return;
          this.originalPosMap.clear();
          this.floatPhaseMap.clear();
          this.floatTime = 0;
          this.floatNodes.forEach((node, index) => {
            if (!node) return;
            this.originalPosMap.set(node, node.position.clone());
            this.floatPhaseMap.set(node, index * 0.35);
          });
        } // 为单个节点启动悬浮效果


        startNodeFloat(node, index) {} // 创建悬浮tween动画


        createFloatTween(node, originalPos, offset, duration, index) {} // 停止悬浮效果


        stopFloatEffect() {
          this.floatNodes.forEach(node => {
            if (!node) return;
            var orig = this.originalPosMap.get(node);
            if (orig) node.setPosition(orig);
          });
          this.originalPosMap.clear();
          this.floatPhaseMap.clear();
          this.floatTime = 0;
        } // 重新启动悬浮效果


        restartFloatEffect() {
          this.stopFloatEffect();

          if (this.enableFloat) {
            this.startFloatEffect();
          }
        } // 动态添加悬浮节点


        addFloatNode(node) {
          if (node && this.floatNodes.indexOf(node) === -1) {
            this.floatNodes.push(node);

            if (this.enableFloat) {
              this.startNodeFloat(node, this.floatNodes.length - 1);
            }
          }
        } // 移除悬浮节点


        removeFloatNode(node) {
          var index = this.floatNodes.indexOf(node);

          if (index !== -1) {
            // 停止该节点的悬浮动画
            if (node) {
              tween(node).stop();
            }

            this.floatNodes.splice(index, 1); // 重新启动所有节点的悬浮效果

            this.restartFloatEffect();
          }
        } // 清空所有悬浮节点


        clearFloatNodes() {
          this.stopFloatEffect();
          this.floatNodes = [];
        } // 设置悬浮参数


        setFloatParams(amplitude, duration) {
          this.floatAmplitude = amplitude;
          this.floatDuration = duration;

          if (this.enableFloat) {
            this.restartFloatEffect();
          }
        } // 切换悬浮效果开关


        toggleFloatEffect() {
          this.enableFloat = !this.enableFloat;

          if (this.enableFloat) {
            this.startFloatEffect();
          } else {
            this.stopFloatEffect();
          }
        }

        update(dt) {
          if (!this.enableFloat || this.floatNodes.length === 0) return;
          this.floatTime += dt;
          var omega = Math.PI * 2 / Math.max(0.0001, this.floatDuration);

          for (var node of this.floatNodes) {
            if (!node) continue;
            var orig = this.originalPosMap.get(node);
            if (!orig) continue;
            var phase = this.floatPhaseMap.get(node) || 0;
            var y = orig.y + Math.sin(this.floatTime * omega + phase) * this.floatAmplitude;
            var x = orig.x;
            var z = orig.z;

            if (this.pixelSnap) {
              node.setPosition(Math.round(x), Math.round(y), Math.round(z));
            } else {
              node.setPosition(x, y, z);
            }
          }
        }
        /**
         * 格式化经验值显示（仅用于经验条）
         * 超过1万显示为"X万"（四舍五入），不超过显示阿拉伯数字
         */


        formatExpValue(val) {
          if (val >= 10000) {
            var wanValue = Math.round(val / 10000);
            return wanValue + "\u4E07";
          }

          return String(val);
        }

        setBarWidth(barNode, cur, max) {
          if (!barNode) return;
          var percent = Math.max(0, Math.min(1, max > 0 ? cur / max : 0));
          var width = Math.max(1, 147 * percent);
          var uiTrans = barNode.getComponent(UITransform);

          if (uiTrans) {
            uiTrans.setContentSize(width, uiTrans.height);
          }
        }

        onFetchClick() {
          var _this6 = this;

          return _asyncToGenerator(function* () {
            try {
              // 检查初始化状态
              if (!_this6.isInitialized) {
                if (_this6.initializationPromise) {
                  yield _this6.initializationPromise;
                } else {
                  yield new Promise(resolve => setTimeout(resolve, 1000));
                }
              } // 再次检查初始化状态


              if (!_this6.isInitialized) {
                return;
              }

              _this6.wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
                error: Error()
              }), WebSocketManager) : WebSocketManager).getInstance(); // 注册消息监听（只注册一次）

              if (!_this6.isListenerRegistered) {
                _this6.wsManager.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                  error: Error()
                }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_INFO, _this6.onRobotInfo, _this6);

                _this6.wsManager.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                  error: Error()
                }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, _this6.onRobotInfo, _this6);

                _this6.isListenerRegistered = true;
              }

              _this6.wsManager.send({
                type: (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                  error: Error()
                }), GameConfig) : GameConfig).MESSAGE_TYPES.GET_RANDOM_ROBOT
              }, false);

              return;
            } catch (err) {}
          })();
        }

        /**
         * 根据pet_id获取并显示指定的机甲信息
         * @param petId 机甲宠物的_id
         */
        showSelectedRobot(petId) {
          var _this7 = this;

          return _asyncToGenerator(function* () {
            try {
              // 关键修复：设置当前应该显示的机甲ID
              var wantedId = petId ? String(petId).trim() : null;
              _this7.currentPetId = wantedId; // 关键修复：先尝试使用缓存数据，解决首次打开不显示的问题

              var cacheManager = (_crd && DataCacheManager === void 0 ? (_reportPossibleCrUseOfDataCacheManager({
                error: Error()
              }), DataCacheManager) : DataCacheManager).getInstance();
              var cachedData = wantedId ? cacheManager.getRobotPetInfoCache(wantedId) : null; // 关键修复：通知 MechEquipment 组件设置 currentPetId
              // 这样 MechEquipment 可以在 onEnable 时使用缓存

              var mechEquipment = null;

              if (_this7.node && _this7.node.parent) {
                mechEquipment = _this7.node.parent.getComponentInChildren(_crd && MechEquipment === void 0 ? (_reportPossibleCrUseOfMechEquipment({
                  error: Error()
                }), MechEquipment) : MechEquipment);
              }

              if (!mechEquipment && _this7.node && _this7.node.scene) {
                mechEquipment = _this7.node.scene.getComponentInChildren(_crd && MechEquipment === void 0 ? (_reportPossibleCrUseOfMechEquipment({
                  error: Error()
                }), MechEquipment) : MechEquipment);
              }

              if (mechEquipment && typeof mechEquipment.setCurrentPetId === 'function') {
                mechEquipment.setCurrentPetId(wantedId || '');
              } // 若缓存条目内的 pet_id 与当前选择不一致，不要用（避免错键或脏数据）


              if (cachedData && wantedId) {
                var _cachedData$pet_id, _cachedData$data;

                var cRaw = (_cachedData$pet_id = cachedData.pet_id) != null ? _cachedData$pet_id : (_cachedData$data = cachedData.data) == null ? void 0 : _cachedData$data.pet_id;
                var cStr = cRaw !== undefined && cRaw !== null ? String(cRaw).trim() : '';

                var cachePetOk = !cStr || _this7.normPetId(cRaw) === _this7.normPetId(wantedId);

                if (cachePetOk) {
                  _this7.onRobotInfo(cachedData);
                }
              } // 性能优化：立即发送请求，不阻塞等待初始化
              // 这样可以先发送请求，然后在后台等待初始化完成


              _this7.wsManager = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
                error: Error()
              }), WebSocketManager) : WebSocketManager).getInstance();

              if (!_this7.wsManager) {
                return;
              } // 注册消息监听（只注册一次）


              if (!_this7.isListenerRegistered) {
                _this7.wsManager.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                  error: Error()
                }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_INFO, _this7.onRobotInfo, _this7);

                _this7.wsManager.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                  error: Error()
                }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, _this7.onRobotInfo, _this7);

                _this7.isListenerRegistered = true;
              } // 优化：使用request方法，自动生成request_id并匹配响应
              // 即使有缓存，也请求最新数据以确保数据实时性


              _this7.wsManager.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
                error: Error()
              }), GameConfig) : GameConfig).MESSAGE_TYPES.GET_ROBOT_PET_INFO, {
                pet_id: wantedId || petId
              }, response => {
                // 快速切换机甲时丢弃晚到的响应，避免详情页刷成上一只
                if (wantedId && _this7.normPetId(_this7.currentPetId) !== _this7.normPetId(wantedId)) {
                  return;
                }

                _this7.onRobotInfo(response);
              }, true, // 需要认证
              10000 // 10秒超时
              ); // 如果还没初始化完成，在后台等待（不阻塞请求）


              if (!_this7.isInitialized) {
                if (_this7.initializationPromise) {
                  // 后台等待初始化完成（响应会被缓存并在初始化完成后处理）
                  _this7.initializationPromise.catch(() => {});
                } else {
                  // 如果初始化还没开始，启动它
                  _this7.initializationPromise = _this7.initializeAsync();
                }
              }
            } catch (err) {}
          })();
        }

        onDestroy() {
          // 清理事件监听
          if (this.wsManager && this.isListenerRegistered) {
            this.wsManager.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_INFO, this.onRobotInfo, this);
            this.wsManager.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotInfo, this);
            this.isListenerRegistered = false;
          }
        }

      }, _class3.SERVER_IP = '192.168.2.7', _class3.SERVER_PORT = 8001, _class3), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "floatAmplitude", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 10;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "floatDuration", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 2;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "enableFloat", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return false;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "pixelSnap", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return true;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "floatNodes", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "Growth", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "Comprehension", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "StarLevel", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "Star", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "Melee", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "Armor", [_dec12], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "Accuracy", [_dec13], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor13 = _applyDecoratedDescriptor(_class2.prototype, "Corrosion", [_dec14], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor14 = _applyDecoratedDescriptor(_class2.prototype, "Initiative", [_dec15], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor15 = _applyDecoratedDescriptor(_class2.prototype, "Block", [_dec16], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor16 = _applyDecoratedDescriptor(_class2.prototype, "ParticleShield", [_dec17], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor17 = _applyDecoratedDescriptor(_class2.prototype, "ArmorPenetration", [_dec18], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor18 = _applyDecoratedDescriptor(_class2.prototype, "Shooting", [_dec19], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor19 = _applyDecoratedDescriptor(_class2.prototype, "Evasion", [_dec20], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor20 = _applyDecoratedDescriptor(_class2.prototype, "Lethality", [_dec21], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor21 = _applyDecoratedDescriptor(_class2.prototype, "Resistance", [_dec22], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor22 = _applyDecoratedDescriptor(_class2.prototype, "Counterattack", [_dec23], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor23 = _applyDecoratedDescriptor(_class2.prototype, "HP", [_dec24], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor24 = _applyDecoratedDescriptor(_class2.prototype, "MP", [_dec25], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor25 = _applyDecoratedDescriptor(_class2.prototype, "EXP", [_dec26], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor26 = _applyDecoratedDescriptor(_class2.prototype, "FetchButton", [_dec27], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor27 = _applyDecoratedDescriptor(_class2.prototype, "RobotName", [_dec28], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor28 = _applyDecoratedDescriptor(_class2.prototype, "Level", [_dec29], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor29 = _applyDecoratedDescriptor(_class2.prototype, "Class", [_dec30], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor30 = _applyDecoratedDescriptor(_class2.prototype, "Robot", [_dec31], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor31 = _applyDecoratedDescriptor(_class2.prototype, "robotShow", [_dec32], {
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
//# sourceMappingURL=d2c97787655588f926918b903e3673f1c55eeeae.js.map