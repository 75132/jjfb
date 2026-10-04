System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Sprite, SpriteFrame, Animation, AnimationClip, Label, UITransform, tween, UIOpacity, JsonAsset, instantiate, Vec3, Color, ResourceManager, Logger, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _class3, _crd, ccclass, property, RobotShow;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfResourceManager(extras) {
    _reporterNs.report("ResourceManager", "./ResourceManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfLogger(extras) {
    _reporterNs.report("Logger", "../global/Logger", _context.meta, extras);
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
      Sprite = _cc.Sprite;
      SpriteFrame = _cc.SpriteFrame;
      Animation = _cc.Animation;
      AnimationClip = _cc.AnimationClip;
      Label = _cc.Label;
      UITransform = _cc.UITransform;
      tween = _cc.tween;
      UIOpacity = _cc.UIOpacity;
      JsonAsset = _cc.JsonAsset;
      instantiate = _cc.instantiate;
      Vec3 = _cc.Vec3;
      Color = _cc.Color;
    }, function (_unresolved_2) {
      ResourceManager = _unresolved_2.ResourceManager;
    }, function (_unresolved_3) {
      Logger = _unresolved_3.Logger;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "0abcdFFcEdK0opfXm/LyZ5x", "RobotShow", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Sprite', 'SpriteFrame', 'Animation', 'AnimationClip', 'Label', 'UITransform', 'tween', 'Tween', 'UIOpacity', 'JsonAsset', 'instantiate', 'Vec3', 'Color']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("RobotShow", RobotShow = (_dec = ccclass('RobotShow'), _dec2 = property({
        type: Node,
        tooltip: '机甲本体节点（挂有 Animation 的那个 Robot 节点）'
      }), _dec3 = property({
        type: Node,
        tooltip: '武器图标节点（Weapon）'
      }), _dec4 = property({
        type: Node,
        tooltip: '枪械图标节点（Gun）'
      }), _dec5 = property({
        type: Node,
        tooltip: '盾牌图标节点（Dun）'
      }), _dec6 = property({
        type: Node,
        tooltip: '机翼图标节点（Wing）'
      }), _dec7 = property({
        type: Node,
        tooltip: 'Number 空节点，其下 1 个精灵模板，按伤害位数复制并居中对齐'
      }), _dec8 = property({
        type: Node,
        tooltip: '技能特效节点 Skill（挂 Animation，默认隐藏；播放技能时临时显示）'
      }), _dec(_class = (_class2 = (_class3 = class RobotShow extends Component {
        constructor() {
          super(...arguments);

          // 机体本体（动画在这里）
          _initializerDefineProperty(this, "body", _descriptor, this);

          // 四个装备图标节点（按预制体子节点命名）
          _initializerDefineProperty(this, "weaponIcon", _descriptor2, this);

          _initializerDefineProperty(this, "gunIcon", _descriptor3, this);

          _initializerDefineProperty(this, "dunIcon", _descriptor4, this);

          _initializerDefineProperty(this, "wingIcon", _descriptor5, this);

          /** 伤害/治疗数字父节点（空节点，下有 1 个精灵模板 Sprite，按位数复制显示） */
          _initializerDefineProperty(this, "numberNode", _descriptor6, this);

          /**
           * 技能特效节点（预制体内名为 Skill，挂着 cc.Animation，播放列表已拖入全部技能动画）。
           * 默认隐藏；播放技能时临时激活，播完自动隐藏。
           */
          _initializerDefineProperty(this, "skillNode", _descriptor7, this);

          /** 数字精灵模板（Number 下唯一的 Sprite 子节点，复制用） */
          this.digitTemplateNode = null;

          /** 当前在飞的伤害数字「容器」节点（每次攻击一个独立容器，互不干扰，形成连击轨迹） */
          this.activeDamageNodes = [];

          /** 兼容旧字段：当前正在跑的 tween 列表 */
          this.damageTween = null;

          /** 战斗血条结构（与机甲属性面板一致：HP/MP 下 HPpanel/CurrentHP/NumericalValue） */
          this.battleBarMap = new Map();
          // 关键修复：缓存最后一次更新的数据，资源加载完成后重新应用
          this.lastRobotData = null;
          this.lastPetId = null;
          // 跟踪当前显示的机甲ID
          this.applyReadyTimers = [];
          // ===== 技能特效（Skill 节点） =====

          /** Skill 节点的 Animation 组件缓存 */
          this._skillAnim = null;

          /** 本次技能播放的结束回调（注册在 Animation.EventType.FINISHED 上） */
          this._skillEndHandler = null;

          /** 兜底收尾调度：FINISHED 未触发时按时长强制隐藏，避免 Skill 节点一直显形 */
          this._skillFallback = null;
        }

        /**
         * 从 equip_position.json 中查找位置：
         * - 先精确匹配 AniID
         * - 再做常见归一化（trim/去扩展名/截断分隔符）
         * - 最后做前缀匹配兜底（例如 AniID= "xm_L3_idle" 命中 "xm_L3"）
         */
        static resolveEquipPosition(aniId, slotName, spriteIndex) {
          if (!aniId) return {};
          var raw = String(aniId);
          var candidates = [];

          var push = s => {
            var v = s == null ? void 0 : s.trim();
            if (!v) return; // 兼容较低 TS lib：不用 Array.prototype.includes

            if (candidates.indexOf(v) === -1) candidates.push(v);
          }; // 1) 原始值


          push(raw); // 2) 去掉常见扩展名/参数
          //    e.g. "xm_L3.anim" / "xm_L3?x=1" / "xm_L3#tag"

          push(raw.split('?')[0]);
          push(raw.split('#')[0]);
          push(raw.split('.')[0]); // 3) 常见分隔符截断（避免服务端返回 "xm_L3_idle" 这类）

          var seps = ['@', '|', ':', ' ', '\t', '\n', '\r', '-', '_'];

          for (var sep of seps) {
            var idx = raw.indexOf(sep);
            if (idx > 0) push(raw.slice(0, idx));
          } // 精确匹配候选


          for (var key of candidates) {
            var aniMap = this.equipPositions.get(key);
            var typeMap = aniMap == null ? void 0 : aniMap.get(slotName);
            var pos = typeMap == null ? void 0 : typeMap.get(spriteIndex);
            if (pos) return {
              pos,
              matchedAniId: key
            };
          } // 前缀匹配兜底：jsonKey 是 aniId 的前缀 / 或 aniId 是 jsonKey 的前缀
          // （避免 AniID 拼接了动作名/等级名）


          for (var [jsonKey, _aniMap] of this.equipPositions.entries()) {
            var a = raw.trim();
            if (!a) continue;
            if (!a.startsWith(jsonKey) && !jsonKey.startsWith(a)) continue;

            var _typeMap = _aniMap.get(slotName);

            var _pos = _typeMap == null ? void 0 : _typeMap.get(spriteIndex);

            if (_pos) return {
              pos: _pos,
              matchedAniId: jsonKey
            };
          }

          return {};
        }

        onLoad() {
          RobotShow.ensureConfigsLoaded(); // 关键修复：清空 petId，确保新实例不会使用旧数据

          this.lastPetId = null;
          this.lastRobotData = null;
          this.initNumberDigits();
          this.initBattleBars();
        }
        /** 初始化伤害数字：取 Number 下唯一的精灵作为模板并隐藏 */


        initNumberDigits() {
          var root = this.numberNode || this.node.getChildByName('Number') || null;
          if (!root) return; // 关键：Number 容器在 prefab 里默认 active=false。若父节点未激活，
          //   在其下运行时创建的 DamagePop 数字节点不会被渲染 → 战斗看不到伤害数字。

          root.active = true;
          this.numberNode = root;
          var template = root.getChildByName('Sprite') || root.children[0] || null;

          if (template) {
            this.digitTemplateNode = template;
            template.active = false; // 模板本体隐藏，仅用于 instantiate 复制
          }
        }
        /** 初始化战斗血条结构（与机甲属性面板一致：HP/MP 下 HPpanel、CurrentHP、NumericalValue） */


        initBattleBars() {
          var bars = [{
            key: 'HP',
            panel: 'HPpanel',
            cur: 'CurrentHP'
          }, {
            key: 'MP',
            panel: 'MPpanel',
            cur: 'CurrentMP'
          }];

          for (var item of bars) {
            var parent = this.node.getChildByName(item.key) || null;
            if (!parent) continue;
            var panel = parent.getChildByName(item.panel) || null;
            var barNode = (panel == null ? void 0 : panel.getChildByName(item.cur)) || null;
            var labelNode = (panel == null ? void 0 : panel.getChildByName('NumericalValue')) || null;
            var label = (labelNode == null ? void 0 : labelNode.getComponent(Label)) || null;
            if (barNode || label) this.battleBarMap.set(item.key, {
              bar: barNode || null,
              label
            });
          }
        } // ===== 对外接口 =====

        /**
         * 根据服务器返回的机甲数据更新展示
         * @param data robot_pet_info_response 的 data
         */


        updateFromRobotData(data) {
          var _data$pet_id, _data$data, _data$data2;

          if (!data) return;
          this.resetVisualState(); // 关键修复：提取并保存 petId，用于验证数据是否匹配

          var rawPetId = (_data$pet_id = data.pet_id) != null ? _data$pet_id : (_data$data = data.data) == null ? void 0 : _data$data.pet_id;
          var petId = rawPetId !== undefined && rawPetId !== null ? String(rawPetId) : null; // 关键修复：如果 petId 发生变化，清空旧数据，避免显示错误的机甲

          if (this.lastPetId !== null && petId !== null && this.lastPetId !== petId) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug("\u26A0\uFE0F [RobotShow] petId \u53D8\u5316\uFF0C\u6E05\u7A7A\u65E7\u6570\u636E (\u65E7: " + this.lastPetId + ", \u65B0: " + petId + ")");
            this.lastRobotData = null;
          } // 如果当前已有有效的 petId，但本次数据缺失 petId，直接跳过，避免误覆盖


          if (this.lastPetId && !petId) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug('⚠️ [RobotShow] 跳过更新：收到的数据缺少 petId，保持当前展示');
            return;
          } // 只有在提供了 petId 时才更新 lastPetId，避免被无效数据覆盖


          if (petId) {
            this.lastPetId = petId;
          } // 关键修复：缓存数据，即使资源未加载完成也保存


          this.lastRobotData = data; // 1. 播放机体动画（沿用 MechAttributeTEST 里的 AniID 逻辑）

          this.updateBodyAnimation(data); // 2. 更新装备图标（如果资源已加载）

          var equipment = data.equipment || ((_data$data2 = data.data) == null ? void 0 : _data$data2.equipment) || {};
          var aniId = data['AniID'] || '';
          this.updateEquipmentIcons(equipment, aniId); // 关键修复：如果资源还没加载完，设置重试检查，直到就绪（最多1秒）

          if (!this.areResourcesReady()) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug("\u26A0\uFE0F [RobotShow] \u8D44\u6E90\u672A\u52A0\u8F7D\u5B8C\u6210\uFF0C\u88C5\u5907\u56FE\u6807\u5C06\u5728\u8D44\u6E90\u52A0\u8F7D\u540E\u66F4\u65B0 (pet_id: " + petId + ")");
            this.scheduleApplyWhenReady(petId, 0);
          }
        }
        /** 恢复击破/渐变后的显示状态，避免连续多场战斗时机甲形象不可见 */


        resetVisualState() {
          var _this$node, _this$body;

          if (!((_this$node = this.node) != null && _this$node.isValid)) return;
          this.node.active = true;
          if ((_this$body = this.body) != null && _this$body.isValid) this.body.active = true;
          var sprites = this.node.getComponentsInChildren(Sprite);
          sprites.forEach(s => {
            var _s$node;

            if (!(s != null && (_s$node = s.node) != null && _s$node.isValid)) return;
            var c = s.color;
            s.color = new Color(c.r, c.g, c.b, 255);
          }); // 技能特效按「默认隐藏」处理：新一场战斗开始时收掉上一场残留的 Skill 节点

          this.stopSkillEffect(true);
        } // ===== 战斗内：伤害数字 + 局内血条（仅战斗时显示） =====

        /** 数字存活时长（秒） */


        /**
         * 显示伤害/治疗数字（Arc 版）。
         * ------------------------------------------------------------------
         * 表现规则（用户口径 · 2026-09-28 更新）：
         *   - 每次调用**独立**生成一个数字容器，**不销毁**之前的数字 —— 支持「连续冒出」；
         *   - 数字从受击者身上**冒出**，然后沿**抛物线（弧形）**向受击者**身后**（被击退的方向）
         *     **倒退飞出**，一边飞一边淡出消失；
         *   - 攻击方在左 → 数字向右上抛出、向右下坠落（先上后下，弧线向右）；
         *     攻击方在右 → 数字向左上抛出、向左下坠落（弧线向左）。
         *   - 「自己方受击」同样适用：数字从自己身上向自己身后（远离攻击方）飞出。
         *
         * @param value      伤害/治疗值
         * @param isHeal     是否治疗（用 bloodreturning 图集）
         * @param dirX       水平方向（正=向右，负=向左；0=仅在原地弧线）
         * @param dirY       保留参数（弧形由重力自动生成，不再直接使用；兼容旧调用）
         * @param life       存活时长（秒，默认 0.9）
         */
        showDamageNumber(value, isHeal, dirX, dirY, life) {
          if (isHeal === void 0) {
            isHeal = false;
          }

          if (life === void 0) {
            life = RobotShow.DAMAGE_LIFE;
          }

          // 整体 try/catch：伤害数字只是表现层，绝不能因为它抛异常而中断战斗结算链（会导致战斗卡死）
          try {
            this.showDamageNumberInternal(value, isHeal, dirX, dirY, life);
          } catch (e) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[RobotShow] showDamageNumber 异常（已吞掉，不影响战斗流程）:', e);
          }
        }

        showDamageNumberInternal(value, isHeal, dirX, dirY, life) {
          if (life === void 0) {
            life = RobotShow.DAMAGE_LIFE;
          }

          var parent = this.numberNode || this.node.getChildByName('Number');
          var template = this.digitTemplateNode;

          if (!parent || !template || !RobotShow.numberFramesLoaded) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn("[\u6570\u5B57\u8BCA\u65AD] showDamageNumber \u63D0\u524D\u8FD4\u56DE\uFF1Aparent=" + !!parent + " template=" + !!template + " framesLoaded=" + RobotShow.numberFramesLoaded + " value=" + value);
            return;
          } // 双保险：确保容器激活（prefab 里 Number 默认 inactive）


          if (!parent.activeInHierarchy) parent.active = true;
          value = Math.max(0, Math.floor(value));
          var str = String(value);
          if (str.length === 0) return; // 每次攻击一个独立容器（不再复用单个节点，支持连续冒出）
          // 容器挂到 Number 自身：层级最简单最稳，避免跨层级坐标换算引入异常。
          //   Number 已由 initNumberDigits 保证存在且 active。

          var box = new Node('DamagePop');
          box.setParent(parent); // 起始点：Number 原点上方一点点（数字在受击者身上冒出）

          box.setPosition(0, 10, 0);
          box.setSiblingIndex(parent.children.length - 1); // 置顶

          var anchor = new Vec3(0, 10, 0);
          var prefix = isHeal ? 'bloodreturning-' : 'Damage-';
          var digitWidth = 24;
          var totalW = str.length * digitWidth;
          var digitStartX = -totalW / 2 + digitWidth / 2;
          var digits = [];

          for (var i = 0; i < str.length; i++) {
            var d = str.charAt(i);
            var frame = RobotShow.numberFramesMap.get(prefix + d);
            if (!frame) continue;
            var clone = instantiate(template);
            clone.active = true;
            clone.setPosition(digitStartX + i * digitWidth, 0, 0);
            var sp = clone.getComponent(Sprite);
            if (sp) sp.spriteFrame = frame;
            var uiOpacity = clone.getComponent(UIOpacity) || clone.addComponent(UIOpacity);
            uiOpacity.opacity = 255;
            box.addChild(clone);
            digits.push(clone);
          }

          if (digits.length === 0) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn("[\u6570\u5B57\u8BCA\u65AD] showDamageNumber \u65E0\u53EF\u7528\u6570\u5B57\u5E27\uFF1Avalue=" + value + " prefix=" + prefix + " mapSize=" + RobotShow.numberFramesMap.size);
            box.destroy();
            return;
          }

          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).warn("[\u6570\u5B57\u8BCA\u65AD] \u5F39\u51FA\u6570\u5B57 " + value + " \u4F4D\u6570=" + digits.length + " parentActive=" + parent.activeInHierarchy + " parentWorldPos=" + parent.worldPosition.x.toFixed(0) + "," + parent.worldPosition.y.toFixed(0)); // 漂移方向：dirX 传「期望的屏幕方向」（+1=屏幕上向右，-1=向左）。
          //   数字节点挂在 Number 下，其局部 +x 方向在屏幕上可能被祖先的负 scale 翻转，
          //   这里用「Number 的世界矩阵 x 轴符号」把屏幕方向换算成局部方向，避免逐层猜 scale。

          var screenDir = dirX === undefined || dirX === 0 ? -1 : dirX > 0 ? 1 : -1; // 局部 +x 在屏幕上的朝向：>0 表示与屏幕同向，<0 表示反向

          var wm = parent.worldMatrix;
          var localXAxisOnScreen = wm && wm.m00 < 0 ? -1 : 1;
          var sign = screenDir * localXAxisOnScreen;
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).warn("[\u65B9\u5411\u8BCA\u65AD] \u671F\u671B\u5C4F\u5E55\u65B9\u5411=" + screenDir + " \u5C40\u90E8x\u8F74\u5C4F\u5E55\u671D\u5411=" + localXAxisOnScreen + " \u2192 \u5C40\u90E8sign=" + sign);
          var dur = Math.max(0.25, life); // 效果：受击后数字从身上「向身后斜抛出去 → 到达最高点 → 自由下坠落地 → 消失」的小弧线。
          //   采用真抛物线：x(t)=vx·t（水平减速），y(t)=vy·t − ½g·t²（上抛后重力下坠）。

          var flightX = 46; // 水平飞出总距离（像素，朝受击者身后）

          var arcH = 20; // 弧线最高点相对起点的抬升（像素，小弧）

          var dropY = -14; // 落点相对起点下沉（像素，负=向下）

          this.activeDamageNodes.push(box);
          (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
            error: Error()
          }), Logger) : Logger).warn("[\u6570\u5B57\u8BCA\u65AD] \u521B\u5EFA\u6570\u5B57\u8282\u70B9 value=" + value + " \u4F4D\u6570=" + digits.length + " \u65B9\u5411sign=" + sign); // 单一代理 tween 驱动：水平位移 + 真抛物线弧线 + 淡出（避免多 tween 各自丢回调）

          var proxy = {
            p: 0
          };
          var startX = anchor.x;
          var startY = anchor.y;
          var tw;
          tw = tween(proxy).to(dur, {
            p: 1
          }, {
            easing: 'linear',
            onUpdate: () => {
              if (!box.isValid) return;
              var t = proxy.p; // 水平：先快后慢（抛出感），缓出

              var easeX = 1 - Math.pow(1 - t, 1.8);
              var x = startX + sign * flightX * easeX; // 垂直：抛物拱（最高点在 t=0.5）+ 整体下沉，形成「抛出→落底」弧线
              //   arcH*4t(1-t) 为拱起项（两端 0，中间峰值）；t*dropY 让终点落地更低

              var y = startY + arcH * 4 * t * (1 - t) + dropY * t;
              box.setPosition(x, y, 0); // 淡出：前半段全亮（看清数字），后半段淡出，落地即消失

              var fade = t < 0.5 ? 1 : Math.max(0, 1 - (t - 0.5) / 0.5);
              var opacity = Math.round(255 * fade);
              digits.forEach(n => {
                if (!n.isValid) return;
                var u = n.getComponent(UIOpacity);
                if (u != null && u.isValid) u.opacity = opacity;
              });
            }
          }).call(() => {
            var idx = this.activeDamageNodes.indexOf(box);
            if (idx >= 0) this.activeDamageNodes.splice(idx, 1);
            if (box.isValid) box.destroy();
            if (this.damageTween === tw) this.damageTween = null;
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn("[\u6570\u5B57\u8BCA\u65AD] \u6570\u5B57\u8282\u70B9\u5DF2\u9500\u6BC1 value=" + value);
          }).start();
          this.damageTween = tw;
        }
        /** 更新战斗血条与数值（与机甲属性面板一致）；仅当已显示血条时刷新 */


        updateBattleBars(hp, maxHp, mp, maxMp) {
          var BAR_MAX_WIDTH = 147;

          var setBar = (key, cur, max) => {
            var entry = this.battleBarMap.get(key);
            if (!entry) return;
            if (entry.label) entry.label.string = Math.max(0, Math.floor(cur)) + "/" + Math.max(0, Math.floor(max));

            if (entry.bar) {
              var percent = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
              var ui = entry.bar.getComponent(UITransform);
              if (ui) ui.setContentSize(Math.max(1, BAR_MAX_WIDTH * percent), ui.height);
            }
          };

          setBar('HP', hp, maxHp);
          if (mp !== undefined && maxMp !== undefined) setBar('MP', mp, maxMp);
        }
        /** 战斗时显示/隐藏局内血条（HP、MP 节点） */


        setBattleBarsVisible(visible) {
          var hpRoot = this.node.getChildByName('HP');
          var mpRoot = this.node.getChildByName('MP');
          if (hpRoot) hpRoot.active = visible;
          if (mpRoot) mpRoot.active = visible;
        }
        /**
         * 检查资源是否已加载完成
         */


        areResourcesReady() {
          return RobotShow.weaponConfig.size > 0 && RobotShow.gunConfig.size > 0 && RobotShow.dunConfig.size > 0 && RobotShow.wingConfig.size > 0 && RobotShow.weaponFrames !== null && RobotShow.gunFrames !== null && RobotShow.dunFrames !== null && RobotShow.wingFrames !== null;
        }
        /**
         * 应用缓存的数据（资源加载完成后调用）
         * @param expectedPetId 期望的机甲ID（可选，用于验证）
         */


        applyCachedData(expectedPetId) {
          // 关键修复：验证 petId 是否匹配，防止显示错误的机甲
          if (expectedPetId !== undefined && expectedPetId !== null && this.lastPetId !== expectedPetId) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug("\u26A0\uFE0F [RobotShow] \u8DF3\u8FC7\u66F4\u65B0\uFF1ApetId \u4E0D\u5339\u914D (\u671F\u671B: " + expectedPetId + ", \u5F53\u524D: " + this.lastPetId + ")");
            return;
          }

          if (this.lastRobotData && this.areResourcesReady()) {
            var _this$lastRobotData$d;

            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug("\u2705 [RobotShow] \u8D44\u6E90\u52A0\u8F7D\u5B8C\u6210\uFF0C\u91CD\u65B0\u5E94\u7528\u7F13\u5B58\u6570\u636E (pet_id: " + this.lastPetId + ")");
            var equipment = this.lastRobotData.equipment || ((_this$lastRobotData$d = this.lastRobotData.data) == null ? void 0 : _this$lastRobotData$d.equipment) || {};
            var aniId = this.lastRobotData['AniID'] || '';
            this.updateEquipmentIcons(equipment, aniId);
          }
        }
        /**
         * 资源未就绪时，重复检查并应用缓存（最多重试5次，间隔递增）
         */


        scheduleApplyWhenReady(expectedPetId, retry) {
          if (retry >= 5) return; // 最多重试5次（~1秒）

          var handle = setTimeout(() => {
            var _this$node2;

            var idx = this.applyReadyTimers.indexOf(handle);
            if (idx >= 0) this.applyReadyTimers.splice(idx, 1);
            if (!((_this$node2 = this.node) != null && _this$node2.isValid)) return; // 再次确认petId匹配

            if (expectedPetId !== null && this.lastPetId !== expectedPetId) return;

            if (this.areResourcesReady()) {
              this.applyCachedData(expectedPetId);
            } else {
              // 递增延迟：100ms, 200ms, 300ms, 400ms, 500ms
              this.scheduleApplyWhenReady(expectedPetId, retry + 1);
            }
          }, 100 * (retry + 1));
          this.applyReadyTimers.push(handle);
        } // ===== 机体动画 =====


        updateBodyAnimation(data) {
          if (!this.body) return;
          var anim = this.body.getComponent(Animation);

          if (!anim) {
            return;
          }

          var clips = Array.isArray(anim.clips) ? anim.clips : [];
          var aniID = data['AniID'] || '';

          if (aniID && typeof aniID === 'string') {
            var targetClip = clips.find(clip => clip && clip.name === aniID);

            if (targetClip) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug("\uD83C\uDFAC [RobotShow] \u64AD\u653E\u52A8\u753B: " + aniID);
              anim.play(aniID);
              return;
            } // 预制体只静态挂了 Robot 的动画（如 bl_L2），怪物动画（如 kgml_L1 / tb_2_L3）
            // 不在其中 —— 必须运行时从 resources/Monster/ani 动态加载，
            // 否则会掉进下面的随机兜底，导致「每打一次换一个形象」。


            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug("\uD83D\uDD0E [RobotShow] \u9884\u5236\u4F53\u65E0\u52A8\u753B " + aniID + "\uFF0C\u5C1D\u8BD5\u52A8\u6001\u52A0\u8F7D");
            this.loadAndPlayAnim(anim, aniID);
            return;
          } // 没有 AniID 时才随机兜底


          if (clips.length === 0) return;
          var idx = Math.floor(Math.random() * clips.length);
          var clip = clips[idx];

          if (clip && clip.name) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug("\uD83C\uDFB2 [RobotShow] \u968F\u673A\u64AD\u653E\u52A8\u753B: " + clip.name);
            anim.play(clip.name);
          }
        }
        /** 已动态加载过的动画缓存：AniID -> AnimationClip */


        /**
         * 运行时按 AniID 从 resources 加载 cc.AnimationClip 并挂到 Animation 组件上播放。
         * 资源来源：assets/resources/Monster/ani/{AniID}.anim（由 monster_port.py 双写生成）。
         */
        loadAndPlayAnim(anim, aniID) {
          var cached = RobotShow.dynamicClipCache.get(aniID);

          if (cached) {
            this.attachAndPlay(anim, aniID, cached);
            return;
          }

          var pending = RobotShow.dynamicClipLoading.get(aniID);

          if (pending) {
            pending.push(clip => this.attachAndPlay(anim, aniID, clip));
            return;
          }

          RobotShow.dynamicClipLoading.set(aniID, [clip => this.attachAndPlay(anim, aniID, clip)]);

          var finish = clip => {
            var cbs = RobotShow.dynamicClipLoading.get(aniID) || [];
            RobotShow.dynamicClipLoading.delete(aniID);
            if (clip) RobotShow.dynamicClipCache.set(aniID, clip);
            cbs.forEach(cb => cb && cb(clip));
          };

          (_crd && ResourceManager === void 0 ? (_reportPossibleCrUseOfResourceManager({
            error: Error()
          }), ResourceManager) : ResourceManager).getInstance().loadAsset("Monster/ani/" + aniID, AnimationClip, (err, clip) => {
            if (err || !clip) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn("\u26A0\uFE0F [RobotShow] \u52A8\u6001\u52A0\u8F7D\u52A8\u753B\u5931\u8D25: " + aniID, err);
              finish(null);
              return;
            }

            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).debug("\u2705 [RobotShow] \u52A8\u6001\u52A0\u8F7D\u52A8\u753B\u6210\u529F: " + aniID);
            finish(clip);
          });
        }
        /** 把动态加载到的 clip 补进 Animation.clips 并播放 */


        attachAndPlay(anim, aniID, clip) {
          if (!anim || !anim.isValid || !clip) return;
          var clips = Array.isArray(anim.clips) ? anim.clips : [];

          if (!clips.some(c => c && c.name === aniID)) {
            clips.push(clip);
            anim.clips = clips;
          }

          anim.play(aniID);
        }

        /** 解析 Skill 节点：优先用属性绑定，其次按预制体固定节点名兜底 */
        resolveSkillNode() {
          var _this$node3;

          if (this.skillNode && this.skillNode.isValid) return this.skillNode;
          var n = ((_this$node3 = this.node) == null ? void 0 : _this$node3.getChildByName('Skill')) || null;
          if (n) this.skillNode = n;
          return n;
        }
        /**
         * 播放技能特效：Skill 节点默认隐藏 → 播放时激活 → 播完自动隐藏。
         * ------------------------------------------------------------------
         * @param clipName  播放列表中的动画名（如 'quan01'），即 Image/Skill/ani/*.anim
         * @param playCount 播放遍数（普攻 quan01 传 2，即连播两遍）
         * @param onDone    特效播完回调（**纯表现层，不参与战斗结算**，省略亦可）
         *
         * 设计要点：整个方法 try/catch，任何异常都只记日志 —— 特效绝不能拖垮战斗结算链。
         */


        playSkillEffect(clipName, playCount, onDone) {
          if (playCount === void 0) {
            playCount = 1;
          }

          try {
            var node = this.resolveSkillNode();

            if (!node) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('#[RobotShow] 未找到 Skill 技能节点，跳过技能特效');
              if (onDone) onDone();
              return;
            }

            var anim = this._skillAnim && this._skillAnim.isValid ? this._skillAnim : node.getComponent(Animation);

            if (!anim) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('[RobotShow] Skill 节点缺少 Animation 组件');
              if (onDone) onDone();
              return;
            }

            this._skillAnim = anim; // 关键顺序：Skill 节点默认 active=false，而 Animation 的 __preload 只有在节点被激活时
            // 才会为 _clips 逐个 createState —— 否则 getState() 返回 null，动画永远播不出来。
            // 因此必须先激活节点，再取 state。

            node.active = true;

            var _state = anim.getState ? anim.getState(clipName) : null;

            if (!_state) {
              // 兜底：状态尚未建立时，用 _clips 里的同名 clip 手动补建 state
              var clips = Array.isArray(anim.clips) ? anim.clips : [];

              var _clip = clips.find(c => c && c.name === clipName);

              if (_clip && typeof anim.createState === 'function') {
                _state = anim.createState(_clip);
              }
            }

            if (!_state) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn("[RobotShow] Skill \u64AD\u653E\u5217\u8868\u4E2D\u6CA1\u6709\u52A8\u753B\u300C" + clipName + "\u300D");
              node.active = false;
              if (onDone) onDone();
              return;
            } // 连续触发（连击 / 攻守双方同帧各播一次）时先收掉上一次，避免状态串台


            this.stopSkillEffect(false);
            _state.repeatCount = Math.max(1, Math.floor(playCount));
            _state.speed = 1;
            var onFinished;

            var cleanup = () => {
              if (this._skillEndHandler === onFinished) {
                anim.off(Animation.EventType.FINISHED, onFinished, this);
                this._skillEndHandler = null;
              }

              if (this._skillFallback) {
                this.unschedule(this._skillFallback);
                this._skillFallback = null;
              }
            };

            onFinished = (_type, st) => {
              if (st && st !== _state) return; // 只认本次 state 的结束事件

              cleanup();
              if (node.isValid) node.active = false;
              if (onDone) onDone();
            };

            this._skillEndHandler = onFinished;
            anim.on(Animation.EventType.FINISHED, onFinished, this); // 兜底：引擎丢事件 / 节点中途被停用时，按时长强制收尾

            var once = Number(_state.duration) > 0 ? Number(_state.duration) : 0.5;

            var fallback = () => {
              this._skillFallback = null;
              cleanup();
              if (node.isValid) node.active = false;
              if (onDone) onDone();
            };

            this._skillFallback = fallback;
            this.scheduleOnce(fallback, once * _state.repeatCount + 0.2);
            anim.play(clipName);
          } catch (e) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[RobotShow] playSkillEffect 异常（已吞掉，不影响战斗流程）:', e);
            if (onDone) onDone();
          }
        }
        /** 停止技能特效；hide=true 时顺带把 Skill 节点恢复为隐藏 */


        stopSkillEffect(hide) {
          if (hide === void 0) {
            hide = true;
          }

          try {
            if (this._skillAnim && this._skillAnim.isValid) {
              if (this._skillEndHandler) {
                this._skillAnim.off(Animation.EventType.FINISHED, this._skillEndHandler, this);
              }

              this._skillAnim.stop();
            }

            this._skillEndHandler = null;

            if (this._skillFallback) {
              this.unschedule(this._skillFallback);
              this._skillFallback = null;
            }

            if (hide) {
              var n = this.resolveSkillNode();
              if (n) n.active = false;
            }
          } catch (e) {
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).error('[RobotShow] stopSkillEffect 异常（已吞掉）:', e);
          }
        } // ===== 装备图标 =====


        updateEquipmentIcons(equipment, aniId) {
          this.setSlotSprite('Weapon', this.weaponIcon, equipment == null ? void 0 : equipment.Weapon, RobotShow.weaponConfig, RobotShow.weaponFrames, RobotShow.weaponFrameMap, aniId);
          this.setSlotSprite('Gun', this.gunIcon, equipment == null ? void 0 : equipment.Gun, RobotShow.gunConfig, RobotShow.gunFrames, RobotShow.gunFrameMap, aniId);
          this.setSlotSprite('Dun', this.dunIcon, equipment == null ? void 0 : equipment.Dun, RobotShow.dunConfig, RobotShow.dunFrames, RobotShow.dunFrameMap, aniId);
          this.setSlotSprite('Wing', this.wingIcon, equipment == null ? void 0 : equipment.Wing, RobotShow.wingConfig, RobotShow.wingFrames, RobotShow.wingFrameMap, aniId);
        }

        setSlotSprite(slotName, iconNode, equipData, configMap, frames, frameMap, aniId) {
          if (!iconNode) return;
          var sprite = iconNode.getComponent(Sprite);
          if (!sprite) return;

          if (!equipData || !equipData.item_id || !frames && frameMap.size === 0 || configMap.size === 0) {
            // 没装备 / 资源没准备好：隐藏
            iconNode.active = false;
            return;
          }

          var itemId = Number(equipData.item_id);
          var cfg = configMap.get(itemId);

          if (!cfg || cfg.img === undefined || cfg.img === null) {
            iconNode.active = false;
            return;
          }

          var imgIndex = Number(cfg.img); // 先按 name->frame 映射找（防止 loadDir 顺序乱）

          var frame = frameMap.get(imgIndex); // 再按数组索引兜底

          if (!frame && frames && frames.length > 0) {
            frame = frames[imgIndex];
          }

          if (!frame) {
            iconNode.active = false;
            return;
          }

          sprite.spriteFrame = frame;
          iconNode.active = true; // 根据 AniID、装备图的 spriteIndex 和类型调整装备图标位置
          // 注意：直接使用配表中的绝对坐标，不做偏移；其他属性保持不变

          if (aniId && equipData && equipData.item_id) {
            // 关键修复：equip_position.json 的第二列对应的是图集索引(img)，不是装备 item_id
            // 例：["xm_L3","30",-4,118,"Wing"] 这里的 30 是 Wing 图集里的 sprite 索引
            var _cfg = configMap.get(Number(equipData.item_id));

            var spriteIndex = _cfg && _cfg.img != null ? Number(_cfg.img) : NaN;

            if (!isNaN(spriteIndex)) {
              var resolved = RobotShow.resolveEquipPosition(aniId, slotName, spriteIndex);

              if (resolved.pos) {
                var currentZ = iconNode.position.z;
                iconNode.setPosition(resolved.pos.x, resolved.pos.y, currentZ);

                if (resolved.matchedAniId && resolved.matchedAniId !== aniId) {
                  (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                    error: Error()
                  }), Logger) : Logger).debug("\uD83D\uDCCD [RobotShow] \u88C5\u5907\u4F4D\u7F6E\u8BBE\u7F6E(\u515C\u5E95\u547D\u4E2D): " + slotName + " spriteIndex:" + spriteIndex + " AniID:" + aniId + " -> \u4F7F\u7528Key:" + resolved.matchedAniId + " \u5750\u6807(" + resolved.pos.x + ", " + resolved.pos.y + ")");
                } else {
                  (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                    error: Error()
                  }), Logger) : Logger).debug("\uD83D\uDCCD [RobotShow] \u88C5\u5907\u4F4D\u7F6E\u8BBE\u7F6E: " + slotName + " spriteIndex:" + spriteIndex + " -> (" + resolved.pos.x + ", " + resolved.pos.y + ") for AniID:" + aniId);
                }
              } else {
                // 关键诊断：没命中就打印一次上下文，方便你核对 AniID / 图索引 / 类型
                var hasAni = RobotShow.equipPositions.has(String(aniId).trim());
                (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                  error: Error()
                }), Logger) : Logger).warn("\u26A0\uFE0F [RobotShow] \u672A\u547D\u4E2D\u88C5\u5907\u5750\u6807: AniID=\"" + aniId + "\"(exists=" + hasAni + ") slot=" + slotName + " spriteIndex=" + spriteIndex + ". " + "\u8BF7\u786E\u8BA4 equip_position.json \u7B2C\u4E8C\u5217\u4E0E Wing.json/Gun.json/Weapon.json \u91CC\u7684 img \u5B57\u6BB5\u4E00\u81F4\uFF08\u5982 \"30\"\uFF09\u3002");
              }
            } else {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn("\u26A0\uFE0F [RobotShow] \u672A\u80FD\u83B7\u53D6\u88C5\u5907\u56FE\u7D22\u5F15(img)\uFF0Cslot=" + slotName + " item_id=" + equipData.item_id);
            }
          }
        } // ===== 静态初始化逻辑 =====

        /**
         * 预加载所有资源（可在场景加载时调用，减少延迟）
         */


        static preloadResources() {
          this.ensureConfigsLoaded();
        }

        static ensureConfigsLoaded() {
          if (this.configsLoaded) return;
          this.configsLoaded = true;
          var resourceMgr = (_crd && ResourceManager === void 0 ? (_reportPossibleCrUseOfResourceManager({
            error: Error()
          }), ResourceManager) : ResourceManager).getInstance();

          var scheduleConfigStep = (fn, delayMs) => {
            var handle = setTimeout(() => {
              var i = this.configLoadTimers.indexOf(handle);
              if (i >= 0) this.configLoadTimers.splice(i, 1);
              fn();
            }, delayMs);
            this.configLoadTimers.push(handle);
          }; // 使用陆续加载方式，避免一次性加载造成卡顿
          // 1. 先加载装备位置配表（单独处理，因为需要特殊解析）


          resourceMgr.loadAsset('json/equip_position', JsonAsset, (err, asset) => {
            if (!err && asset) {
              var positionData = asset.json;
              this.equipPositions.clear();
              positionData.forEach(entry => {
                var [aniId, equipIdStr, x, y, equipType] = entry;
                var equipId = Number(equipIdStr);

                if (!this.equipPositions.has(aniId)) {
                  this.equipPositions.set(aniId, new Map());
                }

                var aniMap = this.equipPositions.get(aniId);

                if (!aniMap.has(equipType)) {
                  aniMap.set(equipType, new Map());
                }

                var typeMap = aniMap.get(equipType);
                typeMap.set(equipId, {
                  x: Number(x),
                  y: Number(y)
                });
              });
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug("\u2705 [RobotShow] equip_position.json \u52A0\u8F7D\u5B8C\u6210\uFF0CAniID \u6570\u91CF: " + this.equipPositions.size);
            } else if (err) {
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).warn('⚠️ [RobotShow] 加载 equip_position.json 失败:', err);
            }
          }); // 2. 陆续加载 JSON 配表（使用 preloadAssets 实现陆续加载）

          var jsonAssets = [{
            path: 'json/Weapon',
            type: JsonAsset,
            handler: asset => {
              var arr = asset.json;
              arr.forEach(item => {
                var id = Number(item.id);

                if (!isNaN(id)) {
                  this.weaponConfig.set(id, item);
                }
              });
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug("\u2705 [RobotShow] Weapon.json \u52A0\u8F7D\u5B8C\u6210\uFF0C\u6761\u76EE\u6570: " + this.weaponConfig.size);
              this.notifyAllInstancesToUpdate();
            }
          }, {
            path: 'json/Gun',
            type: JsonAsset,
            handler: asset => {
              var arr = asset.json;
              arr.forEach(item => {
                var id = Number(item.id);

                if (!isNaN(id)) {
                  this.gunConfig.set(id, item);
                }
              });
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug("\u2705 [RobotShow] Gun.json \u52A0\u8F7D\u5B8C\u6210\uFF0C\u6761\u76EE\u6570: " + this.gunConfig.size);
              this.notifyAllInstancesToUpdate();
            }
          }, {
            path: 'json/Dun',
            type: JsonAsset,
            handler: asset => {
              var arr = asset.json;
              arr.forEach(item => {
                var id = Number(item.id);

                if (!isNaN(id)) {
                  this.dunConfig.set(id, item);
                }
              });
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug("\u2705 [RobotShow] Dun.json \u52A0\u8F7D\u5B8C\u6210\uFF0C\u6761\u76EE\u6570: " + this.dunConfig.size);
              this.notifyAllInstancesToUpdate();
            }
          }, {
            path: 'json/Wing',
            type: JsonAsset,
            handler: asset => {
              var arr = asset.json;
              arr.forEach(item => {
                var id = Number(item.id);

                if (!isNaN(id)) {
                  this.wingConfig.set(id, item);
                }
              });
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug("\u2705 [RobotShow] Wing.json \u52A0\u8F7D\u5B8C\u6210\uFF0C\u6761\u76EE\u6570: " + this.wingConfig.size);
              this.notifyAllInstancesToUpdate();
            }
          }]; // 陆续加载 JSON 配表（每次加载2个，每个完成后延迟50ms）

          var jsonIndex = 0;

          var loadNextJson = () => {
            if (jsonIndex >= jsonAssets.length) return;
            var {
              path,
              type,
              handler
            } = jsonAssets[jsonIndex];
            jsonIndex++;
            resourceMgr.loadAsset(path, type, (err, asset) => {
              if (!err && asset) {
                handler(asset);
              } else {
                (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                  error: Error()
                }), Logger) : Logger).warn("\u26A0\uFE0F [RobotShow] \u52A0\u8F7D " + path + " \u5931\u8D25:", err);
              } // 延迟后加载下一个（给主线程喘息时间）


              if (jsonIndex < jsonAssets.length) {
                scheduleConfigStep(() => loadNextJson(), 50);
              }
            });
          }; // 启动第一批加载（同时加载2个）


          var batchSize = 2;

          for (var i = 0; i < Math.min(batchSize, jsonAssets.length); i++) {
            scheduleConfigStep(() => loadNextJson(), i * 50); // 错开启动时间
          } // 3. 陆续加载图集目录（使用 preloadDirs 实现陆续加载）


          var spriteDirs = [{
            path: 'Weapon/Weapon',
            handler: assets => {
              this.weaponFrames = assets;
              this.weaponFrameMap.clear();
              assets.forEach(sf => {
                var key = Number(sf.name);

                if (!isNaN(key)) {
                  this.weaponFrameMap.set(key, sf);
                }
              });
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug("\u2705 [RobotShow] Weapon \u56FE\u96C6\u52A0\u8F7D\u5B8C\u6210\uFF0C\u6570\u91CF: " + assets.length);
              this.notifyAllInstancesToUpdate();
            }
          }, {
            path: 'Weapon/Gun',
            handler: assets => {
              this.gunFrames = assets;
              this.gunFrameMap.clear();
              assets.forEach(sf => {
                var key = Number(sf.name);

                if (!isNaN(key)) {
                  this.gunFrameMap.set(key, sf);
                }
              });
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug("\u2705 [RobotShow] Gun \u56FE\u96C6\u52A0\u8F7D\u5B8C\u6210\uFF0C\u6570\u91CF: " + assets.length);
              this.notifyAllInstancesToUpdate();
            }
          }, {
            path: 'Weapon/Dun',
            handler: assets => {
              this.dunFrames = assets;
              this.dunFrameMap.clear();
              assets.forEach(sf => {
                var key = Number(sf.name);

                if (!isNaN(key)) {
                  this.dunFrameMap.set(key, sf);
                }
              });
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug("\u2705 [RobotShow] Dun \u56FE\u96C6\u52A0\u8F7D\u5B8C\u6210\uFF0C\u6570\u91CF: " + assets.length);
              this.notifyAllInstancesToUpdate();
            }
          }, {
            path: 'Weapon/Wing',
            handler: assets => {
              this.wingFrames = assets;
              this.wingFrameMap.clear();
              assets.forEach(sf => {
                var key = Number(sf.name);

                if (!isNaN(key)) {
                  this.wingFrameMap.set(key, sf);
                }
              });
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug("\u2705 [RobotShow] Wing \u56FE\u96C6\u52A0\u8F7D\u5B8C\u6210\uFF0C\u6570\u91CF: " + assets.length);
              this.notifyAllInstancesToUpdate();
            }
          }]; // 陆续加载图集目录（每次加载1个，因为图集比较大）

          var dirIndex = 0;

          var loadNextDir = () => {
            if (dirIndex >= spriteDirs.length) return;
            var {
              path,
              handler
            } = spriteDirs[dirIndex];
            dirIndex++;
            resourceMgr.loadDir(path, SpriteFrame, (err, assets) => {
              if (!err && assets) {
                handler(assets);
              } else {
                (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                  error: Error()
                }), Logger) : Logger).warn("\u26A0\uFE0F [RobotShow] \u52A0\u8F7D " + path + " \u56FE\u96C6\u5931\u8D25:", err);
              } // 延迟后加载下一个（图集较大，延迟更久一些）


              if (dirIndex < spriteDirs.length) {
                scheduleConfigStep(() => loadNextDir(), 100); // 图集较大，延迟100ms
              }
            });
          }; // 延迟启动图集加载（等 JSON 配表加载一些后再开始）


          scheduleConfigStep(() => loadNextDir(), 200); // 4. 加载伤害/治疗数字图（resources/NumberIcon：Damage-0～9, bloodreturning-0～9，每张 24x32）

          resourceMgr.loadDir('NumberIcon', SpriteFrame, (err, assets) => {
            if (err || !assets) {
              try {
                (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                  error: Error()
                }), Logger) : Logger).warn('⚠️ [RobotShow] 加载 NumberIcon 失败，伤害数字不可用:', err);
              } catch (_unused) {}

              return;
            }

            this.numberFramesMap.clear();
            var allNames = [];
            assets.forEach(sf => {
              var name = sf.name || '';
              allNames.push(name);

              if (name.startsWith('Damage-') || name.startsWith('bloodreturning-')) {
                this.numberFramesMap.set(name, sf);
              }
            });
            this.numberFramesLoaded = true;
            (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
              error: Error()
            }), Logger) : Logger).warn("[\u6570\u5B57\u8BCA\u65AD] NumberIcon \u52A0\u8F7D\u5B8C\u6210\uFF0C\u603B\u5E27=" + assets.length + " \u547D\u4E2D=" + this.numberFramesMap.size + " \u540D\u79F0\u6837\u4F8B=" + allNames.slice(0, 12).join(','));
          });
        } // 关键修复：跟踪所有实例，资源加载完成后通知它们更新


        onEnable() {
          RobotShow.instances.add(this); // 关键修复：不在 onEnable 时自动应用缓存数据，避免显示错误的机甲
          // 只在明确调用 updateFromRobotData 时才更新
        }

        onDisable() {
          RobotShow.instances.delete(this);
        }

        onDestroy() {
          for (var h of this.applyReadyTimers) {
            clearTimeout(h);
          }

          this.applyReadyTimers.length = 0;
          RobotShow.instances.delete(this);
        } // 关键修复：防止重复通知，只在所有资源都加载完成时通知一次


        /**
         * 通知所有实例重新应用缓存数据（资源加载完成后调用）
         * 关键修复：移除全局通知机制，改为每个实例在 updateFromRobotData 时自己检查资源
         */
        static notifyAllInstancesToUpdate() {
          // 检查资源是否全部加载完成
          if (this.weaponConfig.size > 0 && this.gunConfig.size > 0 && this.dunConfig.size > 0 && this.wingConfig.size > 0 && this.weaponFrames !== null && this.gunFrames !== null && this.dunFrames !== null && this.wingFrames !== null) {
            // 关键修复：资源加载完成后，按实例当前的petId安全地重新应用缓存
            if (!this.allResourcesReadyNotified) {
              this.allResourcesReadyNotified = true;
              (_crd && Logger === void 0 ? (_reportPossibleCrUseOfLogger({
                error: Error()
              }), Logger) : Logger).debug('✅ [RobotShow] 所有资源加载完成，通知实例重新应用缓存');
              this.instances.forEach(instance => {
                if (instance && instance.isValid) {
                  instance.applyCachedData(instance.lastPetId);
                }
              });
            }
          }
        }

      }, _class3.configsLoaded = false, _class3.weaponConfig = new Map(), _class3.gunConfig = new Map(), _class3.dunConfig = new Map(), _class3.wingConfig = new Map(), _class3.weaponFrames = null, _class3.gunFrames = null, _class3.dunFrames = null, _class3.wingFrames = null, _class3.weaponFrameMap = new Map(), _class3.gunFrameMap = new Map(), _class3.dunFrameMap = new Map(), _class3.wingFrameMap = new Map(), _class3.equipPositions = new Map(), _class3.numberFramesMap = new Map(), _class3.numberFramesLoaded = false, _class3.DAMAGE_LIFE = 0.9, _class3.dynamicClipCache = new Map(), _class3.dynamicClipLoading = new Map(), _class3.instances = new Set(), _class3.configLoadTimers = [], _class3.allResourcesReadyNotified = false, _class3), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "body", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "weaponIcon", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "gunIcon", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "dunIcon", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "wingIcon", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "numberNode", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "skillNode", [_dec8], {
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
//# sourceMappingURL=6568296bd5d4c57b5ffe9fac5e5c45ebbf32aa45.js.map