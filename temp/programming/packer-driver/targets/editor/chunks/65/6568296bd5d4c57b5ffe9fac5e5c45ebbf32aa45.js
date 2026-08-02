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
        constructor(...args) {
          super(...args);

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
          const raw = String(aniId);
          const candidates = [];

          const push = s => {
            const v = s == null ? void 0 : s.trim();
            if (!v) return; // 兼容较低 TS lib：不用 Array.prototype.includes

            if (candidates.indexOf(v) === -1) candidates.push(v);
          }; // 1) 原始值


          push(raw); // 2) 去掉常见扩展名/参数
          //    e.g. "xm_L3.anim" / "xm_L3?x=1" / "xm_L3#tag"

          push(raw.split('?')[0]);
          push(raw.split('#')[0]);
          push(raw.split('.')[0]); // 3) 常见分隔符截断（避免服务端返回 "xm_L3_idle" 这类）

          const seps = ['@', '|', ':', ' ', '\t', '\n', '\r', '-', '_'];

          for (const sep of seps) {
            const idx = raw.indexOf(sep);
            if (idx > 0) push(raw.slice(0, idx));
          } // 精确匹配候选


          for (const key of candidates) {
            const aniMap = this.equipPositions.get(key);
            const typeMap = aniMap == null ? void 0 : aniMap.get(slotName);
            const pos = typeMap == null ? void 0 : typeMap.get(spriteIndex);
            if (pos) return {
              pos,
              matchedAniId: key
            };
          } // 前缀匹配兜底：jsonKey 是 aniId 的前缀 / 或 aniId 是 jsonKey 的前缀
          // （避免 AniID 拼接了动作名/等级名）


          for (const [jsonKey, aniMap] of this.equipPositions.entries()) {
            const a = raw.trim();
            if (!a) continue;
            if (!a.startsWith(jsonKey) && !jsonKey.startsWith(a)) continue;
            const typeMap = aniMap.get(slotName);
            const pos = typeMap == null ? void 0 : typeMap.get(spriteIndex);
            if (pos) return {
              pos,
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
          const root = this.numberNode || this.node.getChildByName('Number') || null;
          if (!root) return;
          const template = root.getChildByName('Sprite') || root.children[0] || null;

          if (template) {
            this.digitTemplateNode = template;
            template.active = false;
          }
        }
        /** 初始化战斗血条结构（与机甲属性面板一致：HP/MP 下 HPpanel、CurrentHP、NumericalValue） */


        initBattleBars() {
          const bars = [{
            key: 'HP',
            panel: 'HPpanel',
            cur: 'CurrentHP'
          }, {
            key: 'MP',
            panel: 'MPpanel',
            cur: 'CurrentMP'
          }];

          for (const item of bars) {
            const parent = this.node.getChildByName(item.key) || null;
            if (!parent) continue;
            const panel = parent.getChildByName(item.panel) || null;
            const barNode = (panel == null ? void 0 : panel.getChildByName(item.cur)) || null;
            const labelNode = (panel == null ? void 0 : panel.getChildByName('NumericalValue')) || null;
            const label = (labelNode == null ? void 0 : labelNode.getComponent(Label)) || null;
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

          const rawPetId = (_data$pet_id = data.pet_id) != null ? _data$pet_id : (_data$data = data.data) == null ? void 0 : _data$data.pet_id;
          const petId = rawPetId !== undefined && rawPetId !== null ? String(rawPetId) : null; // 关键修复：如果 petId 发生变化，清空旧数据，避免显示错误的机甲

          if (this.lastPetId !== null && petId !== null && this.lastPetId !== petId) {
            console.log(`⚠️ [RobotShow] petId 变化，清空旧数据 (旧: ${this.lastPetId}, 新: ${petId})`);
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

          const equipment = data.equipment || ((_data$data2 = data.data) == null ? void 0 : _data$data2.equipment) || {};
          const aniId = data['AniID'] || '';
          this.updateEquipmentIcons(equipment, aniId); // 关键修复：如果资源还没加载完，设置重试检查，直到就绪（最多1秒）

          if (!this.areResourcesReady()) {
            console.log(`⚠️ [RobotShow] 资源未加载完成，装备图标将在资源加载后更新 (pet_id: ${petId})`);
            this.scheduleApplyWhenReady(petId, 0);
          }
        } // ===== 战斗内：伤害数字 + 局内血条（仅战斗时显示） =====

        /** 掉落偏移（左下方向）：X 负为左，Y 负为下，单位像素 */


        /** 显示伤害或治疗数字：按位数复制模板精灵，居中对齐，先停顿再往左下掉落并渐变消失 */
        showDamageNumber(value, isHeal = false) {
          const root = this.numberNode || this.node.getChildByName('Number');
          const template = this.digitTemplateNode;
          if (!root || !template || !RobotShow.numberFramesLoaded) return;
          value = Math.max(0, Math.floor(value));
          const str = String(value);
          if (str.length === 0) return;
          if (this.damageTween) this.damageTween.stop();
          this.digitCloneNodes.forEach(n => {
            n.destroy();
          });
          this.digitCloneNodes = [];
          const prefix = isHeal ? 'bloodreturning-' : 'Damage-';
          const digitWidth = 24;
          const totalW = str.length * digitWidth;
          const startX = -totalW / 2 + digitWidth / 2;

          for (let i = 0; i < str.length; i++) {
            const d = str.charAt(i);
            const frame = RobotShow.numberFramesMap.get(prefix + d);
            if (!frame) continue;
            const clone = instantiate(template);
            clone.active = true;
            clone.setPosition(startX + i * digitWidth, 0, 0);
            const sp = clone.getComponent(Sprite);
            if (sp) sp.spriteFrame = frame;
            const uiOpacity = clone.getComponent(UIOpacity) || clone.addComponent(UIOpacity);
            uiOpacity.opacity = 255;
            root.addChild(clone);
            this.digitCloneNodes.push(clone);
          }

          root.active = true;
          const startPos = root.position.clone();
          const drop = RobotShow.DAMAGE_DROP_OFFSET;
          const proxy = {
            t: 0
          };
          this.damageTween = tween(proxy).delay(0.25).to(1, {
            t: 1
          }, {
            onUpdate: () => {
              const t = proxy.t;
              root.setPosition(startPos.x + drop.x * t, startPos.y + drop.y * t, startPos.z);
              const opacity = Math.max(0, Math.round(255 * (1 - t)));
              this.digitCloneNodes.forEach(n => {
                const u = n.getComponent(UIOpacity);
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
          const BAR_MAX_WIDTH = 147;

          const setBar = (key, cur, max) => {
            const entry = this.battleBarMap.get(key);
            if (!entry) return;
            if (entry.label) entry.label.string = `${Math.max(0, Math.floor(cur))}/${Math.max(0, Math.floor(max))}`;

            if (entry.bar) {
              const percent = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
              const ui = entry.bar.getComponent(UITransform);
              if (ui) ui.setContentSize(Math.max(1, BAR_MAX_WIDTH * percent), ui.height);
            }
          };

          setBar('HP', hp, maxHp);
          if (mp !== undefined && maxMp !== undefined) setBar('MP', mp, maxMp);
        }
        /** 战斗时显示/隐藏局内血条（HP、MP 节点） */


        setBattleBarsVisible(visible) {
          const hpRoot = this.node.getChildByName('HP');
          const mpRoot = this.node.getChildByName('MP');
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
            console.log(`⚠️ [RobotShow] 跳过更新：petId 不匹配 (期望: ${expectedPetId}, 当前: ${this.lastPetId})`);
            return;
          }

          if (this.lastRobotData && this.areResourcesReady()) {
            var _this$lastRobotData$d;

            console.log(`✅ [RobotShow] 资源加载完成，重新应用缓存数据 (pet_id: ${this.lastPetId})`);
            const equipment = this.lastRobotData.equipment || ((_this$lastRobotData$d = this.lastRobotData.data) == null ? void 0 : _this$lastRobotData$d.equipment) || {};
            const aniId = this.lastRobotData['AniID'] || '';
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
          const anim = this.body.getComponent(Animation);

          if (!anim || !Array.isArray(anim.clips) || anim.clips.length === 0) {
            return;
          }

          const clips = anim.clips;
          const aniID = data['AniID'] || '';

          if (aniID && typeof aniID === 'string') {
            const targetClip = clips.find(clip => clip && clip.name === aniID);

            if (targetClip) {
              console.log(`🎬 [RobotShow] 播放动画: ${aniID}`);
              anim.play(aniID);
              return;
            } else {
              console.warn(`⚠️ [RobotShow] 未找到动画片段: ${aniID}，可用的动画:`, clips.map(c => c == null ? void 0 : c.name).join(', '));
            }
          } // 找不到指定动画或没有 AniID，随机播放一个


          const idx = Math.floor(Math.random() * clips.length);
          const clip = clips[idx];

          if (clip && clip.name) {
            console.log(`🎲 [RobotShow] 随机播放动画: ${clip.name}`);
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
          const sprite = iconNode.getComponent(Sprite);
          if (!sprite) return;

          if (!equipData || !equipData.item_id || !frames && frameMap.size === 0 || configMap.size === 0) {
            // 没装备 / 资源没准备好：隐藏
            iconNode.active = false;
            return;
          }

          const itemId = Number(equipData.item_id);
          const cfg = configMap.get(itemId);

          if (!cfg || cfg.img === undefined || cfg.img === null) {
            iconNode.active = false;
            return;
          }

          const imgIndex = Number(cfg.img); // 先按 name->frame 映射找（防止 loadDir 顺序乱）

          let frame = frameMap.get(imgIndex); // 再按数组索引兜底

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
            const cfg = configMap.get(Number(equipData.item_id));
            const spriteIndex = cfg && cfg.img != null ? Number(cfg.img) : NaN;

            if (!isNaN(spriteIndex)) {
              const resolved = RobotShow.resolveEquipPosition(aniId, slotName, spriteIndex);

              if (resolved.pos) {
                const currentZ = iconNode.position.z;
                iconNode.setPosition(resolved.pos.x, resolved.pos.y, currentZ);

                if (resolved.matchedAniId && resolved.matchedAniId !== aniId) {
                  console.log(`📍 [RobotShow] 装备位置设置(兜底命中): ${slotName} spriteIndex:${spriteIndex} AniID:${aniId} -> 使用Key:${resolved.matchedAniId} 坐标(${resolved.pos.x}, ${resolved.pos.y})`);
                } else {
                  console.log(`📍 [RobotShow] 装备位置设置: ${slotName} spriteIndex:${spriteIndex} -> (${resolved.pos.x}, ${resolved.pos.y}) for AniID:${aniId}`);
                }
              } else {
                // 关键诊断：没命中就打印一次上下文，方便你核对 AniID / 图索引 / 类型
                const hasAni = RobotShow.equipPositions.has(String(aniId).trim());
                console.warn(`⚠️ [RobotShow] 未命中装备坐标: AniID="${aniId}"(exists=${hasAni}) slot=${slotName} spriteIndex=${spriteIndex}. ` + `请确认 equip_position.json 第二列与 Wing.json/Gun.json/Weapon.json 里的 img 字段一致（如 "30"）。`);
              }
            } else {
              console.warn(`⚠️ [RobotShow] 未能获取装备图索引(img)，slot=${slotName} item_id=${equipData.item_id}`);
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
          const resourceMgr = (_crd && ResourceManager === void 0 ? (_reportPossibleCrUseOfResourceManager({
            error: Error()
          }), ResourceManager) : ResourceManager).getInstance(); // 使用陆续加载方式，避免一次性加载造成卡顿
          // 1. 先加载装备位置配表（单独处理，因为需要特殊解析）

          resourceMgr.loadAsset('json/equip_position', JsonAsset, (err, asset) => {
            if (!err && asset) {
              const positionData = asset.json;
              this.equipPositions.clear();
              positionData.forEach(entry => {
                const [aniId, equipIdStr, x, y, equipType] = entry;
                const equipId = Number(equipIdStr);

                if (!this.equipPositions.has(aniId)) {
                  this.equipPositions.set(aniId, new Map());
                }

                const aniMap = this.equipPositions.get(aniId);

                if (!aniMap.has(equipType)) {
                  aniMap.set(equipType, new Map());
                }

                const typeMap = aniMap.get(equipType);
                typeMap.set(equipId, {
                  x: Number(x),
                  y: Number(y)
                });
              });
              console.log(`✅ [RobotShow] equip_position.json 加载完成，AniID 数量: ${this.equipPositions.size}`);
            } else if (err) {
              console.warn('⚠️ [RobotShow] 加载 equip_position.json 失败:', err);
            }
          }); // 2. 陆续加载 JSON 配表（使用 preloadAssets 实现陆续加载）

          const jsonAssets = [{
            path: 'json/Weapon',
            type: JsonAsset,
            handler: asset => {
              const arr = asset.json;
              arr.forEach(item => {
                const id = Number(item.id);

                if (!isNaN(id)) {
                  this.weaponConfig.set(id, item);
                }
              });
              console.log(`✅ [RobotShow] Weapon.json 加载完成，条目数: ${this.weaponConfig.size}`);
              this.notifyAllInstancesToUpdate();
            }
          }, {
            path: 'json/Gun',
            type: JsonAsset,
            handler: asset => {
              const arr = asset.json;
              arr.forEach(item => {
                const id = Number(item.id);

                if (!isNaN(id)) {
                  this.gunConfig.set(id, item);
                }
              });
              console.log(`✅ [RobotShow] Gun.json 加载完成，条目数: ${this.gunConfig.size}`);
              this.notifyAllInstancesToUpdate();
            }
          }, {
            path: 'json/Dun',
            type: JsonAsset,
            handler: asset => {
              const arr = asset.json;
              arr.forEach(item => {
                const id = Number(item.id);

                if (!isNaN(id)) {
                  this.dunConfig.set(id, item);
                }
              });
              console.log(`✅ [RobotShow] Dun.json 加载完成，条目数: ${this.dunConfig.size}`);
              this.notifyAllInstancesToUpdate();
            }
          }, {
            path: 'json/Wing',
            type: JsonAsset,
            handler: asset => {
              const arr = asset.json;
              arr.forEach(item => {
                const id = Number(item.id);

                if (!isNaN(id)) {
                  this.wingConfig.set(id, item);
                }
              });
              console.log(`✅ [RobotShow] Wing.json 加载完成，条目数: ${this.wingConfig.size}`);
              this.notifyAllInstancesToUpdate();
            }
          }]; // 陆续加载 JSON 配表（每次加载2个，每个完成后延迟50ms）

          let jsonIndex = 0;

          const loadNextJson = () => {
            if (jsonIndex >= jsonAssets.length) return;
            const {
              path,
              type,
              handler
            } = jsonAssets[jsonIndex];
            jsonIndex++;
            resourceMgr.loadAsset(path, type, (err, asset) => {
              if (!err && asset) {
                handler(asset);
              } else {
                console.warn(`⚠️ [RobotShow] 加载 ${path} 失败:`, err);
              } // 延迟后加载下一个（给主线程喘息时间）


              if (jsonIndex < jsonAssets.length) {
                setTimeout(() => {
                  loadNextJson();
                }, 50);
              }
            });
          }; // 启动第一批加载（同时加载2个）


          const batchSize = 2;

          for (let i = 0; i < Math.min(batchSize, jsonAssets.length); i++) {
            setTimeout(() => {
              loadNextJson();
            }, i * 50); // 错开启动时间
          } // 3. 陆续加载图集目录（使用 preloadDirs 实现陆续加载）


          const spriteDirs = [{
            path: 'Weapon/Weapon',
            handler: assets => {
              this.weaponFrames = assets;
              this.weaponFrameMap.clear();
              assets.forEach(sf => {
                const key = Number(sf.name);

                if (!isNaN(key)) {
                  this.weaponFrameMap.set(key, sf);
                }
              });
              console.log(`✅ [RobotShow] Weapon 图集加载完成，数量: ${assets.length}`);
              this.notifyAllInstancesToUpdate();
            }
          }, {
            path: 'Weapon/Gun',
            handler: assets => {
              this.gunFrames = assets;
              this.gunFrameMap.clear();
              assets.forEach(sf => {
                const key = Number(sf.name);

                if (!isNaN(key)) {
                  this.gunFrameMap.set(key, sf);
                }
              });
              console.log(`✅ [RobotShow] Gun 图集加载完成，数量: ${assets.length}`);
              this.notifyAllInstancesToUpdate();
            }
          }, {
            path: 'Weapon/Dun',
            handler: assets => {
              this.dunFrames = assets;
              this.dunFrameMap.clear();
              assets.forEach(sf => {
                const key = Number(sf.name);

                if (!isNaN(key)) {
                  this.dunFrameMap.set(key, sf);
                }
              });
              console.log(`✅ [RobotShow] Dun 图集加载完成，数量: ${assets.length}`);
              this.notifyAllInstancesToUpdate();
            }
          }, {
            path: 'Weapon/Wing',
            handler: assets => {
              this.wingFrames = assets;
              this.wingFrameMap.clear();
              assets.forEach(sf => {
                const key = Number(sf.name);

                if (!isNaN(key)) {
                  this.wingFrameMap.set(key, sf);
                }
              });
              console.log(`✅ [RobotShow] Wing 图集加载完成，数量: ${assets.length}`);
              this.notifyAllInstancesToUpdate();
            }
          }]; // 陆续加载图集目录（每次加载1个，因为图集比较大）

          let dirIndex = 0;

          const loadNextDir = () => {
            if (dirIndex >= spriteDirs.length) return;
            const {
              path,
              handler
            } = spriteDirs[dirIndex];
            dirIndex++;
            resourceMgr.loadDir(path, SpriteFrame, (err, assets) => {
              if (!err && assets) {
                handler(assets);
              } else {
                console.warn(`⚠️ [RobotShow] 加载 ${path} 图集失败:`, err);
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
              } catch {}

              return;
            }

            this.numberFramesMap.clear();
            assets.forEach(sf => {
              const name = sf.name || '';

              if (name.startsWith('Damage-') || name.startsWith('bloodreturning-')) {
                this.numberFramesMap.set(name, sf);
              }
            });
            this.numberFramesLoaded = true;

            try {
              console.log(`✅ [RobotShow] NumberIcon 加载完成，数量: ${this.numberFramesMap.size}`);
            } catch {}
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
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "weaponIcon", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "gunIcon", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "dunIcon", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "wingIcon", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "numberNode", [_dec7], {
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
//# sourceMappingURL=6568296bd5d4c57b5ffe9fac5e5c45ebbf32aa45.js.map