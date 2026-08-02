System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Label, Button, WebSocketManager, GameConfig, DataCacheManager, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _crd, ccclass, property, MechEquipment;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "../global/GameConfig", _context.meta, extras);
  }

  function _reportPossibleCrUseOfDataCacheManager(extras) {
    _reporterNs.report("DataCacheManager", "../global/DataCacheManager", _context.meta, extras);
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
    }, function (_unresolved_3) {
      GameConfig = _unresolved_3.GameConfig;
    }, function (_unresolved_4) {
      DataCacheManager = _unresolved_4.DataCacheManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "6f5c98cx3tPv6P/U8gN7NPo", "MechEquipment", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Label', 'Button']);

      ({
        ccclass,
        property
      } = _decorator);
      /**
       * 机甲装备组件
       * 管理10个装备槽位：Weapon, Gun, Dun, Wing, Xinpian, Toukai, Jianjia, Xiongkai, Tuikai, Shoukai
       */

      _export("MechEquipment", MechEquipment = (_dec = ccclass('MechEquipment'), _dec2 = property({
        type: Node,
        tooltip: "武器槽位节点（Weapon）"
      }), _dec3 = property({
        type: Node,
        tooltip: "枪械槽位节点（Gun）"
      }), _dec4 = property({
        type: Node,
        tooltip: "盾牌槽位节点（Dun）"
      }), _dec5 = property({
        type: Node,
        tooltip: "机翼槽位节点（Wing）"
      }), _dec6 = property({
        type: Node,
        tooltip: "芯片槽位节点（Xinpian）"
      }), _dec7 = property({
        type: Node,
        tooltip: "头凯槽位节点（Toukai）"
      }), _dec8 = property({
        type: Node,
        tooltip: "肩甲槽位节点（Jianjia）"
      }), _dec9 = property({
        type: Node,
        tooltip: "胸铠槽位节点（Xiongkai）"
      }), _dec10 = property({
        type: Node,
        tooltip: "腿铠槽位节点（Tuikai）"
      }), _dec11 = property({
        type: Node,
        tooltip: "手铠槽位节点（Shoukai）"
      }), _dec(_class = (_class2 = class MechEquipment extends Component {
        constructor(...args) {
          super(...args);

          // 槽位节点映射（通过属性面板绑定）
          _initializerDefineProperty(this, "weaponSlot", _descriptor, this);

          _initializerDefineProperty(this, "gunSlot", _descriptor2, this);

          _initializerDefineProperty(this, "dunSlot", _descriptor3, this);

          _initializerDefineProperty(this, "wingSlot", _descriptor4, this);

          _initializerDefineProperty(this, "xinpianSlot", _descriptor5, this);

          _initializerDefineProperty(this, "toukaiSlot", _descriptor6, this);

          _initializerDefineProperty(this, "jianjiaSlot", _descriptor7, this);

          _initializerDefineProperty(this, "xiongkaiSlot", _descriptor8, this);

          _initializerDefineProperty(this, "tuikaiSlot", _descriptor9, this);

          _initializerDefineProperty(this, "shoukaiSlot", _descriptor10, this);

          this.ws = null;
          this.currentPetId = '';
          // 当前显示的机甲ID
          this.slotMap = new Map();
          // 槽位名称到节点的映射
          this.slotLabelMap = new Map();
          // 槽位名称到Label的映射
          this.slotRemoveButtonMap = new Map();
          // 槽位名称到Remove按钮的映射
          this.lastEquipment = null;
          // 缓存最近一次的装备数据（防止面板初次打开时为空）
          // 槽位名称列表（按顺序）
          this.SLOT_NAMES = ['Weapon', 'Gun', 'Dun', 'Wing', 'Xinpian', 'Toukai', 'Jianjia', 'Xiongkai', 'Tuikai', 'Shoukai'];

          /**
           * 处理机甲信息响应（更新装备显示）
           */
          this.onRobotPetInfo = data => {
            try {
              var _data$data, _data$data2;

              // 关键修复：兼容不同的响应格式
              // 支持格式：{ success: true, data: { ... } } 或 { success: true, ... }
              const success = (data == null ? void 0 : data.success) !== false;

              if (!data || !success) {
                return;
              } // 提取 pet_id（支持多种格式）


              const petId = data.pet_id || ((_data$data = data.data) == null ? void 0 : _data$data.pet_id);

              if (!petId) {
                return;
              } // 保存当前机甲ID（关键：确保在收到数据时设置）


              this.currentPetId = petId; // 获取装备数据（支持多种格式）

              const equipment = ((_data$data2 = data.data) == null ? void 0 : _data$data2.equipment) || data.equipment || {}; // 缓存一份，面板再次打开时可直接显示

              this.lastEquipment = equipment; // 关键修复：同时更新到数据缓存管理器，供其他组件使用

              const cacheManager = (_crd && DataCacheManager === void 0 ? (_reportPossibleCrUseOfDataCacheManager({
                error: Error()
              }), DataCacheManager) : DataCacheManager).getInstance(); // 确保缓存的数据格式正确（包含 success 字段）

              const cacheData = {
                success: true,
                pet_id: petId,
                equipment: equipment,
                ...data // 保留其他字段

              };
              cacheManager.setRobotPetInfoCache(petId, cacheData); // 更新所有槽位显示

              this.updateEquipmentDisplay(equipment);
            } catch (error) {}
          };

          /**
           * 处理卸下装备响应
           */
          this.onUnequipItemResponse = data => {
            try {
              var _ref, _data$success, _data$data3;

              // 支持两种响应格式：data.success 或 data.data.success
              const success = (_ref = (_data$success = data == null ? void 0 : data.success) != null ? _data$success : data == null || (_data$data3 = data.data) == null ? void 0 : _data$data3.success) != null ? _ref : false;

              if (!success) {
                return;
              } // 关键修复：装备变更后清除缓存，确保下次打开时获取最新数据


              if (this.currentPetId) {
                const cacheManager = (_crd && DataCacheManager === void 0 ? (_reportPossibleCrUseOfDataCacheManager({
                  error: Error()
                }), DataCacheManager) : DataCacheManager).getInstance();
                cacheManager.clearRobotPetInfoCache(this.currentPetId);
              } // 延迟一小段时间后重新请求机甲信息，确保服务器端数据已更新


              setTimeout(() => {
                if (this.currentPetId) {
                  this.requestRobotPetInfo(this.currentPetId);
                }
              }, 100); // 延迟100ms
            } catch (error) {}
          };
        }

        onLoad() {
          this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance(); // 关键修复：确保 ws 已初始化

          if (!this.ws) {
            return;
          } // 初始化槽位映射


          this.initSlotMaps(); // 注册事件监听

          this.ws.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotPetInfo, this); // 有些服务端可能推送 robot_info（无 _response），一起兼容

          this.ws.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_INFO, this.onRobotPetInfo, this);
          this.ws.on('unequip_item_response', this.onUnequipItemResponse, this);
        }

        onEnable() {
          // 关键修复：优先使用数据缓存管理器的缓存，解决首次打开不显示的问题
          // 策略：
          // 1. 如果 currentPetId 已设置，使用它
          // 2. 如果 currentPetId 未设置，尝试从 MechAttributeTEST 获取
          // 3. 使用 lastEquipment（组件内部缓存）
          // 4. 使用 DataCacheManager 缓存
          // 5. 请求最新数据
          // 注意：如果 currentPetId 未设置，我们依赖 MechAttributeTEST.showSelectedRobot()
          // 来调用 setCurrentPetId() 设置 petId，或者通过事件来获取数据
          // 优先使用组件内部缓存
          if (this.lastEquipment) {
            this.updateEquipmentDisplay(this.lastEquipment);
          } else if (this.currentPetId) {
            // 尝试使用数据缓存管理器的缓存
            const cacheManager = (_crd && DataCacheManager === void 0 ? (_reportPossibleCrUseOfDataCacheManager({
              error: Error()
            }), DataCacheManager) : DataCacheManager).getInstance();
            const cachedData = cacheManager.getRobotPetInfoCache(this.currentPetId);

            if (cachedData && cachedData.success !== false) {
              var _cachedData$data;

              // 使用缓存数据更新显示
              const equipment = ((_cachedData$data = cachedData.data) == null ? void 0 : _cachedData$data.equipment) || cachedData.equipment || {};

              if (Object.keys(equipment).length > 0 || this.hasEquipment(equipment)) {
                this.lastEquipment = equipment;
                this.updateEquipmentDisplay(equipment);
              } else {
                // 缓存中没有装备数据，请求最新数据
                this.requestRobotPetInfo(this.currentPetId);
              }
            } else {
              // 没有缓存，请求最新数据
              this.requestRobotPetInfo(this.currentPetId);
            }
          } else {// 如果 currentPetId 也没有，等待 setCurrentPetId 被调用或事件触发
          }
        }
        /**
         * 检查装备数据是否为空（辅助方法）
         */


        hasEquipment(equipment) {
          if (!equipment || typeof equipment !== 'object') {
            return false;
          } // 检查是否有任何槽位有装备


          for (const slotName of this.SLOT_NAMES) {
            if (equipment[slotName] && equipment[slotName].item_id) {
              return true;
            }
          }

          return false;
        }

        onDestroy() {
          // 移除事件监听
          if (this.ws) {
            this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_PET_INFO_RESPONSE, this.onRobotPetInfo, this);
            this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.ROBOT_INFO, this.onRobotPetInfo, this);
            this.ws.off('unequip_item_response', this.onUnequipItemResponse, this);
          }
        }
        /**
         * 初始化槽位映射
         */


        initSlotMaps() {
          // 槽位节点数组（按顺序对应SLOT_NAMES）
          const slotNodes = [this.weaponSlot, this.gunSlot, this.dunSlot, this.wingSlot, this.xinpianSlot, this.toukaiSlot, this.jianjiaSlot, this.xiongkaiSlot, this.tuikaiSlot, this.shoukaiSlot];

          for (let i = 0; i < this.SLOT_NAMES.length; i++) {
            const slotName = this.SLOT_NAMES[i];
            const slotNode = slotNodes[i];

            if (!slotNode) {
              continue;
            } // 存储槽位节点


            this.slotMap.set(slotName, slotNode); // 查找Label组件（用于显示装备名）

            const labelNode = slotNode.getChildByName('Label');

            if (labelNode) {
              const label = labelNode.getComponent(Label);

              if (label) {
                this.slotLabelMap.set(slotName, label); // 初始化为空并隐藏

                label.string = '';
                labelNode.active = false;
              }
            } // 查找Remove按钮


            const removeNode = slotNode.getChildByName('Remove');

            if (removeNode) {
              const removeButton = removeNode.getComponent(Button);

              if (removeButton) {
                this.slotRemoveButtonMap.set(slotName, removeButton); // 绑定点击事件

                removeButton.node.on(Button.EventType.CLICK, () => {
                  this.onRemoveButtonClick(slotName);
                }, this); // 初始隐藏

                removeButton.node.active = false;
              }
            }
          }
        }

        /**
         * 更新装备显示
         */
        updateEquipmentDisplay(equipment) {
          for (const slotName of this.SLOT_NAMES) {
            const equippedItem = equipment[slotName];
            const label = this.slotLabelMap.get(slotName);
            const removeButton = this.slotRemoveButtonMap.get(slotName);

            if (equippedItem && equippedItem.item_id) {
              // 有装备，显示装备名和Remove按钮
              const itemName = equippedItem.name || `物品${equippedItem.item_id}`;
              const enh = Number(equippedItem.enhance_level || 0);

              if (label) {
                label.string = enh > 0 ? `${itemName} +${enh}` : itemName;
                label.node.active = true; // 显示Label节点
              } // 显示Remove按钮


              if (removeButton) {
                removeButton.node.active = true;
              }
            } else {
              // 无装备，隐藏Label和Remove按钮
              if (label) {
                label.string = '';
                label.node.active = false; // 隐藏Label节点
              } // 隐藏Remove按钮


              if (removeButton) {
                removeButton.node.active = false;
              }
            }
          }
        }
        /**
         * Remove按钮点击事件
         */


        onRemoveButtonClick(slotName) {
          if (!this.currentPetId) {
            return;
          } // 关键修复：确保 ws 已初始化


          if (!this.ws) {
            this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
          }

          if (!this.ws) {
            return;
          } // 获取当前角色ID和Token（使用WebSocketManager）


          const characterId = this.ws.getCharacterId();
          const token = this.ws.getToken();

          if (!characterId) {
            return;
          }

          if (!token) {
            return;
          } // 发送卸下装备请求


          const requestData = {
            type: 'unequip_item',
            token: token,
            character_id: characterId,
            pet_id: this.currentPetId,
            slot_name: slotName
          }; // 修复：直接传递对象，不要使用 JSON.stringify()
          // WebSocketManager.send() 内部会处理 JSON 序列化

          this.ws.send(requestData);
        }

        /**
         * 请求机甲信息（用于刷新装备显示）
         */
        requestRobotPetInfo(petId) {
          if (!petId) {
            return;
          } // 关键修复：确保 ws 已初始化


          if (!this.ws) {
            this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
              error: Error()
            }), WebSocketManager) : WebSocketManager).getInstance();
          }

          if (!this.ws) {
            return;
          }

          const characterId = this.ws.getCharacterId();
          const token = this.ws.getToken();

          if (!characterId) {
            return;
          }

          if (!token) {
            return;
          } // 优化：使用request方法，自动生成request_id并匹配响应


          this.ws.request('get_robot_pet_info', {
            character_id: characterId,
            pet_id: petId
          }, response => {// 通过request_id匹配的响应回调
          }, true, // 需要认证
          10000 // 10秒超时
          );
        }
        /**
         * 设置当前机甲ID（外部调用，用于切换显示的机甲）
         */


        setCurrentPetId(petId) {
          const previousPetId = this.currentPetId;
          this.currentPetId = petId; // 如果是相同的 petId，不需要清缓存

          if (previousPetId === petId && this.lastEquipment) {
            // 相同的机甲，直接使用缓存显示
            this.updateEquipmentDisplay(this.lastEquipment);
            return;
          } // 切换机甲时清掉旧缓存，保证显示的是新机甲的装备


          this.lastEquipment = null;

          if (petId) {
            // 关键修复：先尝试使用 DataCacheManager 的缓存
            const cacheManager = (_crd && DataCacheManager === void 0 ? (_reportPossibleCrUseOfDataCacheManager({
              error: Error()
            }), DataCacheManager) : DataCacheManager).getInstance();
            const cachedData = cacheManager.getRobotPetInfoCache(petId);

            if (cachedData && cachedData.success !== false) {
              var _cachedData$data2;

              const equipment = ((_cachedData$data2 = cachedData.data) == null ? void 0 : _cachedData$data2.equipment) || cachedData.equipment || {};

              if (this.hasEquipment(equipment)) {
                this.lastEquipment = equipment;
                this.updateEquipmentDisplay(equipment);
              } else {
                // 缓存中没有装备数据，请求最新数据
                this.requestRobotPetInfo(petId);
              }
            } else {
              // 没有缓存，请求最新数据
              this.requestRobotPetInfo(petId);
            }
          } else {
            // 清空所有槽位显示
            this.updateEquipmentDisplay({});
          }
        }
        /** 强化当前选中槽位（默认 Weapon） */


        enhanceSlot(slotName = 'Weapon') {
          if (!this.currentPetId || !this.ws) return;
          const characterId = this.ws.getCharacterId();
          if (!characterId) return;
          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.EQUIP_ENHANCE, {
            character_id: characterId,
            pet_id: this.currentPetId,
            slot_name: slotName
          }, resp => {
            if (resp != null && resp.success) {
              this.requestRobotPetInfo(this.currentPetId);
            }
          }, true, 10000);
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "weaponSlot", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "gunSlot", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "dunSlot", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "wingSlot", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "xinpianSlot", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "toukaiSlot", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "jianjiaSlot", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "xiongkaiSlot", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "tuikaiSlot", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "shoukaiSlot", [_dec11], {
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
//# sourceMappingURL=c09e6a9a72caadb411e8709f844c2d1f2c41ff5d.js.map