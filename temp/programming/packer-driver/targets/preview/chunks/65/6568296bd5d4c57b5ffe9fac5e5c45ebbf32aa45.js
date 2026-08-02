System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Sprite, SpriteFrame, Animation, Label, UITransform, tween, UIOpacity, JsonAsset, instantiate, ResourceManager, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _class3, _crd, ccclass, property, RobotShow;

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
      Sprite = _cc.Sprite;
      SpriteFrame = _cc.SpriteFrame;
      Animation = _cc.Animation;
      Label = _cc.Label;
      UITransform = _cc.UITransform;
      tween = _cc.tween;
      UIOpacity = _cc.UIOpacity;
      JsonAsset = _cc.JsonAsset;
      instantiate = _cc.instantiate;
    }, function (_unresolved_2) {
      ResourceManager = _unresolved_2.ResourceManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "0abcdFFcEdK0opfXm/LyZ5x", "RobotShow", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Sprite', 'SpriteFrame', 'Animation', 'Label', 'UITransform', 'tween', 'Tween', 'UIOpacity', 'JsonAsset', 'instantiate', 'Vec3']);

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

          /** 数字精灵模板（Number 下唯一的 Sprite 子节点，复制用） */
          this.digitTemplateNode = null;

          /** 当前弹出的数字克隆节点，用于渐变后销毁 */
          this.digitCloneNodes = [];

          /** 当前伤害数字的 tween，用于下次弹出时先停止 */
          this.damageTween = null;

          /** 战斗血条结构（与机甲属性面板一致：HP/MP 下 HPpanel/CurrentHP/NumericalValue） */
          this.battleBarMap = new Map();
          // 关键修复：缓存最后一次更新的数据，资源加载完成后重新应用
          this.lastRobotData = null;
          this.lastPetId = null;
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

        // 跟踪当前显示的机甲ID
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
          if (!root) return;
          var template = root.getChildByName('Sprite') || root.children[0] || null;

          if (template) {
            this.digitTemplateNode = template;
            template.active = false;
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

          if (!data) return; // 关键修复：提取并保存 petId，用于验证数据是否匹配

          var rawPetId = (_data$pet_id = data.pet_id) != null ? _data$pet_id : (_data$data = data.data) == null ? void 0 : _data$data.pet_id;
          var petId = rawPetId !== undefined && rawPetId !== null ? String(rawPetId) : null; // 关键修复：如果 petId 发生变化，清空旧数据，避免显示错误的机甲

          if (this.lastPetId !== null && petId !== null && this.lastPetId !== petId) {
            console.log("\u26A0\uFE0F [RobotShow] petId \u53D8\u5316\uFF0C\u6E05\u7A7A\u65E7\u6570\u636E (\u65E7: " + this.lastPetId + ", \u65B0: " + petId + ")");
            this.lastRobotData = null;
          } // 如果当前已有有效的 petId，但本次数据缺失 petId，直接跳过，避免误覆盖


          if (this.lastPetId && !petId) {
            console.log('⚠️ [RobotShow] 跳过更新：收到的数据缺少 petId，保持当前展示');
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
            console.log("\u26A0\uFE0F [RobotShow] \u8D44\u6E90\u672A\u52A0\u8F7D\u5B8C\u6210\uFF0C\u88C5\u5907\u56FE\u6807\u5C06\u5728\u8D44\u6E90\u52A0\u8F7D\u540E\u66F4\u65B0 (pet_id: " + petId + ")");
            this.scheduleApplyWhenReady(petId, 0);
          }
        } // ===== 战斗内：伤害数字 + 局内血条（仅战斗时显示） =====

        /** 掉落偏移（左下方向）：X 负为左，Y 负为下，单位像素 */


        /** 显示伤害或治疗数字：按位数复制模板精灵，居中对齐，先停顿再往左下掉落并渐变消失 */
        showDamageNumber(value, isHeal) {
          if (isHeal === void 0) {
            isHeal = false;
          }

          var root = this.numberNode || this.node.getChildByName('Number');
          var template = this.digitTemplateNode;
          if (!root || !template || !RobotShow.numberFramesLoaded) return;
          value = Math.max(0, Math.floor(value));
          var str = String(value);
          if (str.length === 0) return;
          if (this.damageTween) this.damageTween.stop();
          this.digitCloneNodes.forEach(n => {
            n.destroy();
          });
          this.digitCloneNodes = [];
          var prefix = isHeal ? 'bloodreturning-' : 'Damage-';
          var digitWidth = 24;
          var totalW = str.length * digitWidth;
          var startX = -totalW / 2 + digitWidth / 2;

          for (var i = 0; i < str.length; i++) {
            var d = str.charAt(i);
            var frame = RobotShow.numberFramesMap.get(prefix + d);
            if (!frame) continue;
            var clone = instantiate(template);
            clone.active = true;
            clone.setPosition(startX + i * digitWidth, 0, 0);
            var sp = clone.getComponent(Sprite);
            if (sp) sp.spriteFrame = frame;
            var uiOpacity = clone.getComponent(UIOpacity) || clone.addComponent(UIOpacity);
            uiOpacity.opacity = 255;
            root.addChild(clone);
            this.digitCloneNodes.push(clone);
          }

          root.active = true;
          var startPos = root.position.clone();
          var drop = RobotShow.DAMAGE_DROP_OFFSET;
          var proxy = {
            t: 0
          };
          this.damageTween = tween(proxy).delay(0.25).to(1, {
            t: 1
          }, {
            onUpdate: () => {
              var t = proxy.t;
              root.setPosition(startPos.x + drop.x * t, startPos.y + drop.y * t, startPos.z);
              var opacity = Math.max(0, Math.round(255 * (1 - t)));
              this.digitCloneNodes.forEach(n => {
                var u = n.getComponent(UIOpacity);
                if (u) u.opacity = opacity;
              });
            }
          }).call(() => {
            this.digitCloneNodes.forEach(n => n.destroy());
            this.digitCloneNodes = [];
            root.setPosition(startPos);
            root.active = false;
            this.damageTween = null;
          }).start();
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
            console.log("\u26A0\uFE0F [RobotShow] \u8DF3\u8FC7\u66F4\u65B0\uFF1ApetId \u4E0D\u5339\u914D (\u671F\u671B: " + expectedPetId + ", \u5F53\u524D: " + this.lastPetId + ")");
            return;
          }

          if (this.lastRobotData && this.areResourcesReady()) {
            var _this$lastRobotData$d;

            console.log("\u2705 [RobotShow] \u8D44\u6E90\u52A0\u8F7D\u5B8C\u6210\uFF0C\u91CD\u65B0\u5E94\u7528\u7F13\u5B58\u6570\u636E (pet_id: " + this.lastPetId + ")");
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

          setTimeout(() => {
            // 再次确认petId匹配
            if (expectedPetId !== null && this.lastPetId !== expectedPetId) return;

            if (this.areResourcesReady()) {
              this.applyCachedData(expectedPetId);
            } else {
              // 递增延迟：100ms, 200ms, 300ms, 400ms, 500ms
              this.scheduleApplyWhenReady(expectedPetId, retry + 1);
            }
          }, 100 * (retry + 1));
        } // ===== 机体动画 =====


        updateBodyAnimation(data) {
          if (!this.body) return;
          var anim = this.body.getComponent(Animation);

          if (!anim || !Array.isArray(anim.clips) || anim.clips.length === 0) {
            return;
          }

          var clips = anim.clips;
          var aniID = data['AniID'] || '';

          if (aniID && typeof aniID === 'string') {
            var targetClip = clips.find(clip => clip && clip.name === aniID);

            if (targetClip) {
              console.log("\uD83C\uDFAC [RobotShow] \u64AD\u653E\u52A8\u753B: " + aniID);
              anim.play(aniID);
              return;
            } else {
              console.warn("\u26A0\uFE0F [RobotShow] \u672A\u627E\u5230\u52A8\u753B\u7247\u6BB5: " + aniID + "\uFF0C\u53EF\u7528\u7684\u52A8\u753B:", clips.map(c => c == null ? void 0 : c.name).join(', '));
            }
          } // 找不到指定动画或没有 AniID，随机播放一个


          var idx = Math.floor(Math.random() * clips.length);
          var clip = clips[idx];

          if (clip && clip.name) {
            console.log("\uD83C\uDFB2 [RobotShow] \u968F\u673A\u64AD\u653E\u52A8\u753B: " + clip.name);
            anim.play(clip.name);
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
                  console.log("\uD83D\uDCCD [RobotShow] \u88C5\u5907\u4F4D\u7F6E\u8BBE\u7F6E(\u515C\u5E95\u547D\u4E2D): " + slotName + " spriteIndex:" + spriteIndex + " AniID:" + aniId + " -> \u4F7F\u7528Key:" + resolved.matchedAniId + " \u5750\u6807(" + resolved.pos.x + ", " + resolved.pos.y + ")");
                } else {
                  console.log("\uD83D\uDCCD [RobotShow] \u88C5\u5907\u4F4D\u7F6E\u8BBE\u7F6E: " + slotName + " spriteIndex:" + spriteIndex + " -> (" + resolved.pos.x + ", " + resolved.pos.y + ") for AniID:" + aniId);
                }
              } else {
                // 关键诊断：没命中就打印一次上下文，方便你核对 AniID / 图索引 / 类型
                var hasAni = RobotShow.equipPositions.has(String(aniId).trim());
                console.warn("\u26A0\uFE0F [RobotShow] \u672A\u547D\u4E2D\u88C5\u5907\u5750\u6807: AniID=\"" + aniId + "\"(exists=" + hasAni + ") slot=" + slotName + " spriteIndex=" + spriteIndex + ". " + "\u8BF7\u786E\u8BA4 equip_position.json \u7B2C\u4E8C\u5217\u4E0E Wing.json/Gun.json/Weapon.json \u91CC\u7684 img \u5B57\u6BB5\u4E00\u81F4\uFF08\u5982 \"30\"\uFF09\u3002");
              }
            } else {
              console.warn("\u26A0\uFE0F [RobotShow] \u672A\u80FD\u83B7\u53D6\u88C5\u5907\u56FE\u7D22\u5F15(img)\uFF0Cslot=" + slotName + " item_id=" + equipData.item_id);
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
          }), ResourceManager) : ResourceManager).getInstance(); // 使用陆续加载方式，避免一次性加载造成卡顿
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
              console.log("\u2705 [RobotShow] equip_position.json \u52A0\u8F7D\u5B8C\u6210\uFF0CAniID \u6570\u91CF: " + this.equipPositions.size);
            } else if (err) {
              console.warn('⚠️ [RobotShow] 加载 equip_position.json 失败:', err);
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
              console.log("\u2705 [RobotShow] Weapon.json \u52A0\u8F7D\u5B8C\u6210\uFF0C\u6761\u76EE\u6570: " + this.weaponConfig.size);
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
              console.log("\u2705 [RobotShow] Gun.json \u52A0\u8F7D\u5B8C\u6210\uFF0C\u6761\u76EE\u6570: " + this.gunConfig.size);
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
              console.log("\u2705 [RobotShow] Dun.json \u52A0\u8F7D\u5B8C\u6210\uFF0C\u6761\u76EE\u6570: " + this.dunConfig.size);
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
              console.log("\u2705 [RobotShow] Wing.json \u52A0\u8F7D\u5B8C\u6210\uFF0C\u6761\u76EE\u6570: " + this.wingConfig.size);
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
                console.warn("\u26A0\uFE0F [RobotShow] \u52A0\u8F7D " + path + " \u5931\u8D25:", err);
              } // 延迟后加载下一个（给主线程喘息时间）


              if (jsonIndex < jsonAssets.length) {
                setTimeout(() => {
                  loadNextJson();
                }, 50);
              }
            });
          }; // 启动第一批加载（同时加载2个）


          var batchSize = 2;

          for (var i = 0; i < Math.min(batchSize, jsonAssets.length); i++) {
            setTimeout(() => {
              loadNextJson();
            }, i * 50); // 错开启动时间
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
              console.log("\u2705 [RobotShow] Weapon \u56FE\u96C6\u52A0\u8F7D\u5B8C\u6210\uFF0C\u6570\u91CF: " + assets.length);
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
              console.log("\u2705 [RobotShow] Gun \u56FE\u96C6\u52A0\u8F7D\u5B8C\u6210\uFF0C\u6570\u91CF: " + assets.length);
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
              console.log("\u2705 [RobotShow] Dun \u56FE\u96C6\u52A0\u8F7D\u5B8C\u6210\uFF0C\u6570\u91CF: " + assets.length);
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
              console.log("\u2705 [RobotShow] Wing \u56FE\u96C6\u52A0\u8F7D\u5B8C\u6210\uFF0C\u6570\u91CF: " + assets.length);
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
                console.warn("\u26A0\uFE0F [RobotShow] \u52A0\u8F7D " + path + " \u56FE\u96C6\u5931\u8D25:", err);
              } // 延迟后加载下一个（图集较大，延迟更久一些）


              if (dirIndex < spriteDirs.length) {
                setTimeout(() => {
                  loadNextDir();
                }, 100); // 图集较大，延迟100ms
              }
            });
          }; // 延迟启动图集加载（等 JSON 配表加载一些后再开始）


          setTimeout(() => {
            loadNextDir();
          }, 200); // 4. 加载伤害/治疗数字图（resources/NumberIcon：Damage-0～9, bloodreturning-0～9，每张 24x32）

          resourceMgr.loadDir('NumberIcon', SpriteFrame, (err, assets) => {
            if (err || !assets) {
              try {
                console.warn('⚠️ [RobotShow] 加载 NumberIcon 失败，伤害数字不可用:', err);
              } catch (_unused) {}

              return;
            }

            this.numberFramesMap.clear();
            assets.forEach(sf => {
              var name = sf.name || '';

              if (name.startsWith('Damage-') || name.startsWith('bloodreturning-')) {
                this.numberFramesMap.set(name, sf);
              }
            });
            this.numberFramesLoaded = true;

            try {
              console.log("\u2705 [RobotShow] NumberIcon \u52A0\u8F7D\u5B8C\u6210\uFF0C\u6570\u91CF: " + this.numberFramesMap.size);
            } catch (_unused2) {}
          });
        } // 关键修复：跟踪所有实例，资源加载完成后通知它们更新


        onEnable() {
          RobotShow.instances.add(this); // 关键修复：不在 onEnable 时自动应用缓存数据，避免显示错误的机甲
          // 只在明确调用 updateFromRobotData 时才更新
        }

        onDisable() {
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
              console.log('✅ [RobotShow] 所有资源加载完成，通知实例重新应用缓存');
              this.instances.forEach(instance => {
                if (instance && instance.isValid) {
                  instance.applyCachedData(instance.lastPetId);
                }
              });
            }
          }
        }

      }, _class3.configsLoaded = false, _class3.weaponConfig = new Map(), _class3.gunConfig = new Map(), _class3.dunConfig = new Map(), _class3.wingConfig = new Map(), _class3.weaponFrames = null, _class3.gunFrames = null, _class3.dunFrames = null, _class3.wingFrames = null, _class3.weaponFrameMap = new Map(), _class3.gunFrameMap = new Map(), _class3.dunFrameMap = new Map(), _class3.wingFrameMap = new Map(), _class3.equipPositions = new Map(), _class3.numberFramesMap = new Map(), _class3.numberFramesLoaded = false, _class3.DAMAGE_DROP_OFFSET = {
        x: -32,
        y: -48
      }, _class3.instances = new Set(), _class3.allResourcesReadyNotified = false, _class3), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "body", [_dec2], {
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
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=6568296bd5d4c57b5ffe9fac5e5c45ebbf32aa45.js.map