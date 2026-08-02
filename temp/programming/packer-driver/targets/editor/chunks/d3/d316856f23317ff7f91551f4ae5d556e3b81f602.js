System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4", "__unresolved_5", "__unresolved_6", "__unresolved_7", "__unresolved_8", "__unresolved_9", "__unresolved_10"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Button, Label, instantiate, Sprite, UITransform, SpriteAtlas, JsonAsset, assetManager, Color, input, Input, Vec3, Vec2, EditBox, UIOpacity, Graphics, WebSocketManager, GameConfig, RobotList, RobotEvolutionEffect, DataCacheManager, ResourceManager, UILockManager, emitBattleTeamUpdated, emitRobotDataUpdated, BagEventHub, normalizeBagItemsResponse, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _dec14, _dec15, _dec16, _dec17, _dec18, _dec19, _dec20, _dec21, _dec22, _dec23, _dec24, _dec25, _dec26, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _descriptor13, _descriptor14, _descriptor15, _descriptor16, _descriptor17, _descriptor18, _descriptor19, _descriptor20, _descriptor21, _descriptor22, _descriptor23, _descriptor24, _descriptor25, _crd, ccclass, property, BagItem;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfWebSocketManager(extras) {
    _reporterNs.report("WebSocketManager", "../global/WebSocketManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameConfig(extras) {
    _reporterNs.report("GameConfig", "../global/GameConfig", _context.meta, extras);
  }

  function _reportPossibleCrUseOfRobotList(extras) {
    _reporterNs.report("RobotList", "./RobotList", _context.meta, extras);
  }

  function _reportPossibleCrUseOfRobotEvolutionEffect(extras) {
    _reporterNs.report("RobotEvolutionEffect", "./RobotEvolutionEffect", _context.meta, extras);
  }

  function _reportPossibleCrUseOfDataCacheManager(extras) {
    _reporterNs.report("DataCacheManager", "../global/DataCacheManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfResourceManager(extras) {
    _reporterNs.report("ResourceManager", "./ResourceManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfUILockManager(extras) {
    _reporterNs.report("UILockManager", "../global/UILockManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfemitBattleTeamUpdated(extras) {
    _reporterNs.report("emitBattleTeamUpdated", "../global/RobotGameEvents", _context.meta, extras);
  }

  function _reportPossibleCrUseOfemitRobotDataUpdated(extras) {
    _reporterNs.report("emitRobotDataUpdated", "../global/RobotGameEvents", _context.meta, extras);
  }

  function _reportPossibleCrUseOfBagEventHub(extras) {
    _reporterNs.report("BagEventHub", "../global/BagEvent", _context.meta, extras);
  }

  function _reportPossibleCrUseOfnormalizeBagItemsResponse(extras) {
    _reporterNs.report("normalizeBagItemsResponse", "../global/protocol/BagProtocol", _context.meta, extras);
  }

  function _reportPossibleCrUseOfBagItemSnapshot(extras) {
    _reporterNs.report("BagItemSnapshot", "../global/protocol/BagProtocol", _context.meta, extras);
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
      Button = _cc.Button;
      Label = _cc.Label;
      instantiate = _cc.instantiate;
      Sprite = _cc.Sprite;
      UITransform = _cc.UITransform;
      SpriteAtlas = _cc.SpriteAtlas;
      JsonAsset = _cc.JsonAsset;
      assetManager = _cc.assetManager;
      Color = _cc.Color;
      input = _cc.input;
      Input = _cc.Input;
      Vec3 = _cc.Vec3;
      Vec2 = _cc.Vec2;
      EditBox = _cc.EditBox;
      UIOpacity = _cc.UIOpacity;
      Graphics = _cc.Graphics;
    }, function (_unresolved_2) {
      WebSocketManager = _unresolved_2.WebSocketManager;
    }, function (_unresolved_3) {
      GameConfig = _unresolved_3.GameConfig;
    }, function (_unresolved_4) {
      RobotList = _unresolved_4.RobotList;
    }, function (_unresolved_5) {
      RobotEvolutionEffect = _unresolved_5.RobotEvolutionEffect;
    }, function (_unresolved_6) {
      DataCacheManager = _unresolved_6.DataCacheManager;
    }, function (_unresolved_7) {
      ResourceManager = _unresolved_7.ResourceManager;
    }, function (_unresolved_8) {
      UILockManager = _unresolved_8.UILockManager;
    }, function (_unresolved_9) {
      emitBattleTeamUpdated = _unresolved_9.emitBattleTeamUpdated;
      emitRobotDataUpdated = _unresolved_9.emitRobotDataUpdated;
    }, function (_unresolved_10) {
      BagEventHub = _unresolved_10.BagEventHub;
    }, function (_unresolved_11) {
      normalizeBagItemsResponse = _unresolved_11.normalizeBagItemsResponse;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "a6332KnCo9Jea+M/tcXg1ym", "BagItem", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Button', 'Label', 'instantiate', 'Sprite', 'SpriteFrame', 'UITransform', 'SpriteAtlas', 'resources', 'JsonAsset', 'assetManager', 'Color', 'EventTouch', 'input', 'Input', 'Vec3', 'Vec2', 'EditBox', 'tween', 'Tween', 'UIOpacity', 'Graphics']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("BagItem", BagItem = (_dec = ccclass('BagItem'), _dec2 = property(Node), _dec3 = property(Button), _dec4 = property(Button), _dec5 = property(Button), _dec6 = property(Button), _dec7 = property(Button), _dec8 = property(Node), _dec9 = property(Node), _dec10 = property(Button), _dec11 = property(Button), _dec12 = property(EditBox), _dec13 = property(EditBox), _dec14 = property(Button), _dec15 = property(Button), _dec16 = property(Label), _dec17 = property(SpriteAtlas), _dec18 = property(SpriteAtlas), _dec19 = property(Node), _dec20 = property(Node), _dec21 = property(Button), _dec22 = property(Button), _dec23 = property(Button), _dec24 = property(_crd && RobotList === void 0 ? (_reportPossibleCrUseOfRobotList({
        error: Error()
      }), RobotList) : RobotList), _dec25 = property(Node), _dec26 = property(Label), _dec(_class = (_class2 = class BagItem extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "panel", _descriptor, this);

          _initializerDefineProperty(this, "closeBtn", _descriptor2, this);

          _initializerDefineProperty(this, "itemBtn", _descriptor3, this);

          _initializerDefineProperty(this, "weaponBtn", _descriptor4, this);

          _initializerDefineProperty(this, "armorBtn", _descriptor5, this);

          _initializerDefineProperty(this, "otherBtn", _descriptor6, this);

          _initializerDefineProperty(this, "bagRoot", _descriptor7, this);

          _initializerDefineProperty(this, "cellTemplate", _descriptor8, this);

          _initializerDefineProperty(this, "testWriteBtn", _descriptor9, this);

          _initializerDefineProperty(this, "testFetchBtn", _descriptor10, this);

          _initializerDefineProperty(this, "randomCountEditBox", _descriptor11, this);

          // 随机物品数量输入框

          /** 可选：按名称筛选当前页（绑定 EditBox 后生效） */
          _initializerDefineProperty(this, "bagFilterEdit", _descriptor12, this);

          _initializerDefineProperty(this, "nextPageBtn", _descriptor13, this);

          // 下一页按钮
          _initializerDefineProperty(this, "prevPageBtn", _descriptor14, this);

          // 上一页按钮
          _initializerDefineProperty(this, "pageNumberLabel", _descriptor15, this);

          // 显示页码 1/4 之类
          _initializerDefineProperty(this, "ui2Atlas", _descriptor16, this);

          // UI2 图集（IconSet2-9 格式）
          _initializerDefineProperty(this, "iconSet2Atlas", _descriptor17, this);

          // IconSet2 图集（IconSet2_232 格式）
          _initializerDefineProperty(this, "introductionPanel", _descriptor18, this);

          // 统一的物品详情面板（放在 Bag 面板下，全程只用一个）
          _initializerDefineProperty(this, "useItemPanel", _descriptor19, this);

          // 使用物品窗口（UseItem）
          _initializerDefineProperty(this, "useItemButton", _descriptor20, this);

          // 使用物品按钮（点击后显示使用窗口）
          _initializerDefineProperty(this, "useBtn", _descriptor21, this);

          // 使用窗口内的"使用"按钮
          _initializerDefineProperty(this, "discardBtn", _descriptor22, this);

          // 使用窗口内的"丢弃"按钮
          _initializerDefineProperty(this, "robotList", _descriptor23, this);

          // 机甲列表面板（用于选择机甲使用物品）
          _initializerDefineProperty(this, "errorTipsPanel", _descriptor24, this);

          // ErrorTips 面板节点（BagPanel下的ErrorTips）
          _initializerDefineProperty(this, "errorTipsLabel", _descriptor25, this);

          // ErrorTips 下的 Label 组件
          this.ws = null;
          this.items = [];
          this.currentCategory = 1;
          this.spriteCache = new Map();
          // 动态格子节点池：只创建一次，翻页/刷新时复用，避免频繁销毁和实例化
          this.dynamicNodes = [];
          this.selectedFrameName = 'menuSelecting';
          this.unselectedFrameName = 'menuSelect';
          this.itemDataMap = new Map();
          // item_id -> ItemData 映射
          this.itemsDataLoaded = false;
          // 标记 Items.json 是否已加载完成
          this.selectedItemNode = null;
          // 当前选中的物品格子节点
          this.selectedItemId = null;
          // 当前选中的物品ID
          this.selectedItemSlotIndex = -1;
          // 当前选中的物品在当前分类中的全局slot索引（用于精确定位）
          this.hoveredItemNode = null;
          // 当前悬浮的物品格子节点（用于悬浮显示简介）
          this._clickedOnItem = false;
          // 标志：是否刚刚点击了物品格子
          // 双击检测
          this.lastClickItemId = null;
          // 上次点击的物品ID
          this.lastClickTime = 0;
          // 上次点击的时间戳
          this.DOUBLE_CLICK_INTERVAL = 400;
          // 双击间隔时间（毫秒），适当放宽以兼容不同操作习惯
          // 延迟显示详情：避免第一次点击后立即显示详情挡住格子，导致第二次点击（双击）被详情面板截获
          this._delayedIntroCallback = null;
          // 详情面板当前对应的格子信息（用于点击详情时转发到格子，解决详情遮挡导致双击无反应）
          this._introductionForItemId = null;
          this._introductionForItemNode = null;
          this._introductionForItemIndex = -1;
          // 操作防重复标志（MMO最佳实践：使用请求ID + 操作锁双重保护）
          this.isProcessingUseItem = false;
          // 是否正在处理使用物品请求
          this.isProcessingDiscardItem = false;
          // 是否正在处理丢弃物品请求
          this.currentRequestId = 0;
          // 当前请求ID（用于防止重复请求和响应混乱）
          this.pendingRequestId = null;
          // 待处理的请求ID
          this.requestTimeoutTimer = null;
          // 请求超时定时器
          this.REQUEST_TIMEOUT = 10000;
          // 请求超时时间（10秒）
          // 分页相关（MMO 常规做法：客户端保存当前页，服务端只返回一页数据）
          this.currentPage = 1;
          // 当前页（从 1 开始）
          this.totalPages = 1;
          // 总页数
          this.PAGE_SIZE = 60;
          // 每页格子数（需和服务端 bag_handler 保持一致）
          // 版本号相关（新增：用于版本校验和缓存优化）
          this.localBagVersion = 0;
          // 本地版本号（从服务器获取）
          // 拖拽移动（同分类内 slot_index，服务端权威）
          this._dragFromSlot = -1;
          this._dragFromNode = null;
          this._dragging = false;
          this._dragStartUIPos = new Vec2();
          this._bagNameFilter = '';
          this._discardArmed = false;
          this._discardArmTimer = null;
          this._lastUiThrottleTs = 0;
          // 详情面板相对于模板格子（第一个格子）的固定偏移（世界坐标下）
          this.introWorldOffset = null;
          // 当前正在使用的物品信息（用于 Pet 类型物品选择机甲后使用）
          this.pendingUseItemId = null;
          this.pendingUseItemNode = null;
          // 一行最多多少列（你说目前最多 10 列）
          this.COLS = 10;
          this.CELL_SIZE = 32;
          this.GAP = 6;
          this.MARGIN_LR = 10;
          this.MARGIN_TB = 15;
          this.FIRST_X = 10;
          this.FIRST_Y = -15;

          /**
           * 处理角色切换事件（清除内部状态）
           */
          this.onCharacterChanged = data => {
            if (data && data.reason === 'character_id_cleared') {
              console.log('🗑️ [BagItem] 检测到角色切换，清除内部状态'); // 清除所有内部状态

              this.items = [];
              this.currentPage = 1;
              this.totalPages = 1;
              this.localBagVersion = 0;
              this.itemsDataLoaded = false;
              this.selectedItemNode = null;
              this.selectedItemId = null;
              this.selectedItemSlotIndex = -1;
              this.currentCategory = 1; // 重置为默认分类
              // 清空渲染

              if (this.panel && this.panel.active) {
                this.render();
              }
            }
          };

          this.onWriteResponse = data => {
            if (data && data.success) {
              this.requestFetchBag();
            }
          };

          /**
           * 兼容旧监听入口：若仍收到 bag_items，统一走 snapshot（正常路径走 request 回调）。
           */
          this.onBagItems = data => {
            this.applyBagSnapshot((_crd && normalizeBagItemsResponse === void 0 ? (_reportPossibleCrUseOfnormalizeBagItemsResponse({
              error: Error()
            }), normalizeBagItemsResponse) : normalizeBagItemsResponse)(data));
          };

          /**
           * 物品有更新时（例如随机重写背包、使用物品、删除物品），重新请求当前页
           * MMO最佳实践：立即刷新，不使用延迟，确保数据同步
           * 新增：重置版本号，强制获取最新数据
           */
          this.onBagItemsUpdate = data => {
            if (data && data.success) {
              const delta = data.bag_delta;

              if (delta && Array.isArray(delta.ops)) {
                for (const op of delta.ops) {
                  if (op && op.op && op.op !== 'refetch') {
                    console.log(`[BagItem] bag_delta op=${op.op}（当前仍走整页 refetch）`);
                  }
                }
              }

              this.localBagVersion = 0;
              this.requestFetchBag();
            }
          };

          this.onNetworkDisconnectBag = () => {
            this.cancelDragState();
            (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
              error: Error()
            }), UILockManager) : UILockManager).instance.forceUnlockAll();
            this.resetMainActionButtons();
          };

          /**
           * 处理使用物品响应（优化：支持标准格式和直接格式）
           * request方法已经验证了request_id，这里直接处理响应
           */
          this.onUseItemResponse = data => {
            (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
              error: Error()
            }), UILockManager) : UILockManager).instance.unlock('bag'); // 清除处理标志

            this.isProcessingUseItem = false;

            if (!data || !data.success) {
              const errorMsg = (data == null ? void 0 : data.error) || (data == null ? void 0 : data.message) || '未知错误';
              console.error(`❌ [BagItem] 使用物品失败: ${errorMsg}`); // 显示失败提示

              this.showErrorTips(errorMsg, false); // 如果是因为物品不存在或数量不足，刷新背包数据

              if (errorMsg.includes('不存在') || errorMsg.includes('数量') || errorMsg.includes('不足') || errorMsg.includes('无效')) {
                console.log('🔄 [BagItem] 检测到数据不同步，刷新背包数据'); // 关闭使用窗口

                this.closeUseItemPanel(); // 立即刷新（MMO最佳实践：服务器是权威数据源）

                this.requestFetchBag();
              }

              return;
            } // ✅ 关键修复：兼容标准格式（data在data字段中）和直接格式（字段在根级别）


            const responseData = data.data || data; // 优先使用data字段，如果没有则使用根级别

            const itemId = responseData.item_id;
            const itemData = this.itemDataMap.get(itemId);
            const itemName = itemData ? itemData.name : `物品ID: ${itemId}`;
            const targetType = responseData.target_type || 'Unknown'; // 对机甲生效的道具（还原晶体/经验等）：清详情缓存；Pet 目标再清列表缓存，避免回到列表仍显示旧等级

            const targetLower = String(targetType).toLowerCase();

            if (responseData.pet_id && (responseData.equipped || targetLower === 'pet')) {
              const cacheManager = (_crd && DataCacheManager === void 0 ? (_reportPossibleCrUseOfDataCacheManager({
                error: Error()
              }), DataCacheManager) : DataCacheManager).getInstance();
              const pid = String(responseData.pet_id);
              cacheManager.clearRobotPetInfoCache(pid);

              if (targetLower === 'pet') {
                var _this$ws;

                const cid = (_this$ws = this.ws) == null || _this$ws.getCharacterId == null ? void 0 : _this$ws.getCharacterId();

                if (cid) {
                  cacheManager.clearRobotPetsCache(cid);
                }
              }

              console.log(`🗑️ [BagItem] 对机甲使用物品后清除机甲缓存 (pet_id: ${pid}, equipped: ${!!responseData.equipped})`);
            }

            const targetName = responseData.target_name || (responseData.pet_id ? `机甲ID: ${responseData.pet_id}` : '玩家');
            const effectResult = responseData.effect_result || data.effect_result; // 兼容两种格式

            console.log(`✅ [BagItem] 成功使用物品: ${itemName} (ID: ${itemId})，目标: ${targetName} (${targetType})`);

            if (String(targetType).toLowerCase() === 'pet' && responseData.pet_id) {
              var _this$ws2, _this$ws3;

              (_crd && emitRobotDataUpdated === void 0 ? (_reportPossibleCrUseOfemitRobotDataUpdated({
                error: Error()
              }), emitRobotDataUpdated) : emitRobotDataUpdated)({
                petId: String(responseData.pet_id),
                character_id: ((_this$ws2 = this.ws) == null || _this$ws2.getCharacterId == null ? void 0 : _this$ws2.getCharacterId()) || undefined
              });
              (_crd && emitBattleTeamUpdated === void 0 ? (_reportPossibleCrUseOfemitBattleTeamUpdated({
                error: Error()
              }), emitBattleTeamUpdated) : emitBattleTeamUpdated)({
                character_id: ((_this$ws3 = this.ws) == null || _this$ws3.getCharacterId == null ? void 0 : _this$ws3.getCharacterId()) || undefined
              });
            } // 显示成功提示


            const successMsg = `成功使用物品: ${itemName}`;
            this.showErrorTips(successMsg, true); // 显示效果结果（如果有）

            if (effectResult && effectResult.success) {
              console.log(`✨ [BagItem] 效果应用成功: ${effectResult.message || '无消息'}`); // 显示详细效果信息

              if (effectResult.results && effectResult.results.length > 0) {
                effectResult.results.forEach((result, index) => {
                  if (result.success) {
                    console.log(`  [效果 ${index + 1}] ${result.effect_type}: ${result.message || ''}`); // 显示升级信息（如果有）

                    if (result.data && result.data.level_up_count > 0) {
                      console.log(`    🎉 升级了 ${result.data.level_up_count} 级！`);
                    }
                  }
                }); // 触发进化动画（在关闭窗口之前，确保动画能正常播放）

                const evolve = effectResult.results.find(r => r.effect_type === 'PET_EVOLVE' && r.success);

                if (evolve && evolve.data) {
                  const newForm = evolve.data.new_form;
                  const newAniId = evolve.data.ani_id || '';
                  const oldAniId = typeof newForm === 'number' && newForm > 1 ? this.convertAniIdForForm(newAniId, newForm - 1) : '';
                  const evolver = (_crd && RobotEvolutionEffect === void 0 ? (_reportPossibleCrUseOfRobotEvolutionEffect({
                    error: Error()
                  }), RobotEvolutionEffect) : RobotEvolutionEffect).getInstance();

                  if (evolver) {
                    console.log(`🎬 [BagItem] 触发进化动画: ${oldAniId} -> ${newAniId}`);
                    evolver.playEvolution(oldAniId, newAniId);
                  }
                }
              }
            } // ✅ 关键修复：延迟关闭窗口和刷新背包，确保进化动画有时间播放
            // 先延迟关闭窗口，给进化动画时间启动（如果有进化动画，延迟更长）


            const hasEvolution = effectResult && effectResult.results && effectResult.results.some(r => r.effect_type === 'PET_EVOLVE' && r.success);
            const delayTime = hasEvolution ? 0.2 : 0.05; // 有进化动画时延迟200ms，否则50ms

            this.scheduleOnce(() => {
              // 关闭使用窗口（会自动恢复到合适位置）
              this.closeUseItemPanel(); // MMO最佳实践：如果是对机甲使用物品，强制刷新机甲列表

              if (targetType === 'Pet' && this.robotList) {
                console.log('🔄 [BagItem] 对机甲使用物品成功，强制刷新机甲列表'); // 再延迟一小段时间，确保服务器数据已更新

                this.scheduleOnce(() => {
                  if (this.robotList) {
                    this.robotList.forceRefresh();
                  }
                }, 0.1);
              } // MMO最佳实践：不进行乐观更新，直接等待服务器返回最新数据
              // 避免客户端和服务器数据不一致的问题
              // 立即请求服务器数据（服务器是权威数据源，会返回更新后的数据）


              this.requestFetchBag();
            }, delayTime);

            if (data && data.success) {
              (_crd && BagEventHub === void 0 ? (_reportPossibleCrUseOfBagEventHub({
                error: Error()
              }), BagEventHub) : BagEventHub).emit('bag', {
                kind: 'mutated',
                mutation: 'use',
                success: true,
                raw: data
              });
            }
          };

          /**
           * 处理丢弃物品响应
           */

          /**
           * 处理丢弃物品响应（优化：支持标准格式和直接格式）
           * request方法已经验证了request_id，这里直接处理响应
           */
          this.onDiscardItemResponse = data => {
            (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
              error: Error()
            }), UILockManager) : UILockManager).instance.unlock('bag'); // 清除处理标志

            this.isProcessingDiscardItem = false;

            if (!data || !data.success) {
              const errorMsg = (data == null ? void 0 : data.error) || (data == null ? void 0 : data.message) || '未知错误';
              console.error(`❌ [BagItem] 丢弃物品失败: ${errorMsg}`); // 如果是因为物品不存在或无效，刷新背包数据

              if (errorMsg.includes('不存在') || errorMsg.includes('无效')) {
                console.log('🔄 [BagItem] 检测到数据不同步，刷新背包数据'); // 关闭使用窗口

                this.closeUseItemPanel(); // 立即刷新（MMO最佳实践：服务器是权威数据源）

                this.requestFetchBag();
              }

              return;
            } // ✅ 关键修复：兼容标准格式（data在data字段中）和直接格式（字段在根级别）


            const responseData = data.data || data; // 优先使用data字段，如果没有则使用根级别

            const itemId = responseData.item_id;
            const itemData = this.itemDataMap.get(itemId);
            const itemName = itemData ? itemData.name : `物品ID: ${itemId}`;
            console.log(`✅ [BagItem] 成功丢弃物品: ${itemName} (ID: ${itemId})`); // 关闭使用窗口（会自动恢复到合适位置）

            this.closeUseItemPanel(); // MMO最佳实践：不进行乐观更新，直接等待服务器返回最新数据
            // 避免客户端和服务器数据不一致的问题
            // 立即请求服务器数据（服务器是权威数据源，会返回更新后的数据）

            this.requestFetchBag();
            (_crd && BagEventHub === void 0 ? (_reportPossibleCrUseOfBagEventHub({
              error: Error()
            }), BagEventHub) : BagEventHub).emit('bag', {
              kind: 'mutated',
              mutation: 'discard',
              success: true,
              raw: data
            });
          };

          /**
           * 隐藏错误提示面板
           */
          this.hideErrorTips = () => {
            if (this.errorTipsPanel) {
              this.errorTipsPanel.active = false;
            }
          };
        }

        onLoad() {
          var _this$otherBtn, _this$introductionPan;

          this.ws = (_crd && WebSocketManager === void 0 ? (_reportPossibleCrUseOfWebSocketManager({
            error: Error()
          }), WebSocketManager) : WebSocketManager).getInstance();

          if (!this.bagRoot && this.cellTemplate && this.cellTemplate.parent) {
            this.bagRoot = this.cellTemplate.parent;
          } // 关键修复：监听角色切换事件，清除内部状态


          if (this.ws) {
            this.ws.on('data_changed', this.onCharacterChanged, this);
          }

          if (this.closeBtn) {
            this.closeBtn.node.on('click', () => {
              // 优先级1：如果使用物品窗口打开，先关闭它
              if (this.useItemPanel && this.useItemPanel.active) {
                this.closeUseItemPanel();
                return;
              } // 优先级2：如果当前有选中的物品，先取消选中


              if (this.selectedItemNode) {
                this.clearSelection();
                return;
              } // 优先级3：如果没有选中物品，则关闭整个面板
              // 关闭背包时，同时关闭机甲列表和使用窗口


              if (this.robotList && this.robotList.node) {
                this.robotList.node.active = false;
                this.robotList.clearCallbacks();
              }

              if (this.useItemPanel) {
                this.useItemPanel.active = false;
              }

              if (this.panel) {
                this.cancelDragState();
                this.panel.active = false;
              }

              this.resetMainActionButtons();
            });
          }

          if (this.useItemButton) {
            this.useItemButton.node.on('click', () => {
              // 点击使用按钮时，如果有选中的物品，显示使用窗口
              if (this.selectedItemNode && this.selectedItemId !== null) {
                this.showUseItemPanel(this.selectedItemId);
              }
            });
          }

          if (this.useBtn) {
            this.useBtn.node.on('click', () => {
              if (this.selectedItemId !== null) {
                this.onUseItem(this.selectedItemId);
              }
            });
          }

          if (this.discardBtn) {
            this.discardBtn.node.on('click', () => {
              if (this.selectedItemId !== null) {
                this.onDiscardItem(this.selectedItemId);
              }
            });
          } // 分类映射：1=Items, 2=Weapon+Gun(武器), 3=Wing+Dun+Armor(护甲), 4=Other(暂时不用)


          if (this.itemBtn) this.itemBtn.node.on('click', () => {
            this.switchCategory(1);
          });
          if (this.weaponBtn) this.weaponBtn.node.on('click', () => {
            this.switchCategory(2);
          }); // 武器(Weapon+Gun)

          if (this.armorBtn) this.armorBtn.node.on('click', () => {
            this.switchCategory(3);
          }); // 护甲(Wing+Dun+Armor)
          // otherBtn 暂时不使用
          // if (this.otherBtn) this.otherBtn.node.on('click', () => { this.switchCategory(4); });

          if (this.testWriteBtn) this.testWriteBtn.node.on('click', () => {
            this.requestWriteRandom();
          });
          if (this.testFetchBtn) this.testFetchBtn.node.on('click', () => {
            this.requestFetchBag();
          });

          if (this.nextPageBtn) {
            this.nextPageBtn.node.on('click', () => {
              this.gotoPage(this.currentPage + 1);
            });
          }

          if (this.prevPageBtn) {
            this.prevPageBtn.node.on('click', () => {
              this.gotoPage(this.currentPage - 1);
            });
          }

          if (this.ws) {
            this.ws.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_WRITE_RESPONSE, this.onWriteResponse, this); // bag_get 响应由 request() 回调处理；此处不再监听 bag_items，避免与推送语义混淆
            // BAG_ITEMS_UPDATE 只作为「数据有变化，需要重新拉取当前页」的信号

            this.ws.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_ITEMS_UPDATE, this.onBagItemsUpdate, this); // 使用物品和丢弃物品的响应

            this.ws.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_USE_ITEM_RESPONSE, this.onUseItemResponse, this);
            this.ws.on((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_DISCARD_ITEM_RESPONSE, this.onDiscardItemResponse, this);
            this.ws.on('network_disconnect', this.onNetworkDisconnectBag, this);
          }

          this.updateCategoryTabUI();
          this.loadItemsData();

          if (this.bagFilterEdit) {
            this.bagFilterEdit.node.on(EditBox.EventType.EDITING_DID_ENDED, () => {
              this._bagNameFilter = (this.bagFilterEdit.string || '').trim().toLowerCase();
              if (this.panel && this.panel.active) this.render();
            }, this);
          }

          if ((_this$otherBtn = this.otherBtn) != null && _this$otherBtn.node) {
            this.otherBtn.node.on(Button.EventType.CLICK, () => this.onSortCurrentCategory(), this);
          } // 详情面板点击转发：当详情悬浮/点击后覆盖在格子上时，点击详情等价于点击对应格子，避免双击无反应


          if ((_this$introductionPan = this.introductionPanel) != null && _this$introductionPan.isValid) {
            this.introductionPanel.on(Node.EventType.TOUCH_END, this.onIntroductionTouchEnd, this);
          } // 使用最简单的方法：在Button点击时设置标志，延迟检查是否点击了其他区域
          // 使用全局触摸事件检测点击


          if (input && typeof input.on === 'function') {
            input.on(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
          }
        }
        /** 取消延迟显示详情的定时，避免与双击、清选等冲突 */


        cancelDelayedIntro() {
          if (this._delayedIntroCallback) {
            this.unschedule(this._delayedIntroCallback);
            this._delayedIntroCallback = null;
          }
        }
        /** 详情面板上的触摸结束：转发为对应格子的点击，解决详情覆盖格子导致双击无效 */


        onIntroductionTouchEnd() {
          if (this._introductionForItemNode == null || this._introductionForItemId == null || this._introductionForItemIndex < 0) return;
          this._clickedOnItem = true;
          this.onItemClick(this._introductionForItemNode, this._introductionForItemId, this._introductionForItemIndex);
          this.scheduleOnce(() => {
            this._clickedOnItem = false;
          }, 0.2);
        }
        /**
         * 加载所有物品和装备JSON数据
         * 支持多种加载方式：resources/json、json 目录、或直接 URL
         */


        loadItemsData() {
          const jsonFiles = ['Items', 'Weapon', 'Gun', 'Wing', 'Dun', 'Armor'];
          let loadedCount = 0;
          let totalItems = 0;
          const resourceMgr = (_crd && ResourceManager === void 0 ? (_reportPossibleCrUseOfResourceManager({
            error: Error()
          }), ResourceManager) : ResourceManager).getInstance();

          const checkComplete = () => {
            if (loadedCount === jsonFiles.length) {
              console.log(`✅ [BagItem] 已加载所有物品和装备数据，共 ${totalItems} 个`);
              this.itemsDataLoaded = true; // 如果已经有物品数据，重新渲染

              if (this.items.length > 0) {
                console.log('🔄 [BagItem] 物品数据已加载，重新渲染物品列表');
                this.render();
              }
            }
          }; // 陆续加载JSON文件（避免一次性加载造成卡顿）


          let currentIndex = 0;

          const loadNextFile = () => {
            if (currentIndex >= jsonFiles.length) {
              return;
            }

            const fileName = jsonFiles[currentIndex];
            currentIndex++;
            resourceMgr.loadAsset(`json/${fileName}`, JsonAsset, (err, asset) => {
              loadedCount++;

              if (err) {
                console.warn(`⚠️ [BagItem] 加载 ${fileName}.json 失败:`, err);
              } else if (asset && asset.json) {
                const items = asset.json;
                this.parseItemsData(items);
                totalItems += items.length;
                console.log(`✅ [BagItem] 已加载 ${fileName}.json: ${items.length} 个物品`);
              } else {
                console.error(`❌ [BagItem] ${fileName}.json 数据格式错误`);
              }

              checkComplete(); // 延迟后加载下一个文件（给主线程喘息时间）

              if (currentIndex < jsonFiles.length) {
                setTimeout(() => {
                  loadNextFile();
                }, 50); // 延迟50ms
              }
            });
          }; // 启动第一批加载（同时加载2个，避免卡顿）


          const batchSize = 2;

          for (let i = 0; i < Math.min(batchSize, jsonFiles.length); i++) {
            setTimeout(() => {
              loadNextFile();
            }, i * 50); // 错开启动时间
          }
        }
        /**
         * 备用加载方案
         */


        loadItemsDataFallback() {
          // 尝试使用 assetManager 从 json 目录加载
          assetManager.loadAny({
            path: 'json/Items',
            type: JsonAsset
          }, (err, asset) => {
            if (err) {
              console.error('❌ [BagItem] 所有加载方式都失败:', err);
              console.error('💡 解决方案:');
              console.error('   1. 将 Items.json 移动到 assets/resources/json/ 目录');
              console.error('   2. 或者在 Cocos Creator 中右键 Items.json -> 设置为资源'); // 设置一个默认的图标映射，避免完全无法显示

              this.setupDefaultIcons();
              return;
            }

            if (asset && asset.json) {
              this.parseItemsData(asset.json);
            } else {
              console.error('❌ [BagItem] Items.json 数据格式错误');
            }
          });
        }
        /**
         * 设置默认图标映射（当 JSON 加载失败时使用）
         */


        setupDefaultIcons() {
          console.warn('⚠️ [BagItem] 使用默认图标映射（建议修复 JSON 加载问题）'); // 这里可以设置一些默认的 item_id -> iconIndex 映射
          // 但最好还是修复 JSON 加载问题
        }
        /**
         * 解析物品数据（累积添加，不清空）
         */


        parseItemsData(items) {
          // 不要清空，累积添加（因为会加载多个JSON文件）
          let addedCount = 0;

          for (const item of items) {
            if (item.id && item.iconIndex) {
              this.itemDataMap.set(item.id, item);
              addedCount++;
            }
          } // 只有在所有JSON文件加载完成后才标记为已加载
          // 这个标记在 loadItemsData 的 checkComplete 中设置


          console.log(`✅ [BagItem] 解析了 ${addedCount} 个物品，当前总计 ${this.itemDataMap.size} 个物品数据`); // 如果已经有物品数据，重新渲染

          if (this.items.length > 0) {
            console.log('🔄 [BagItem] 物品数据已更新，重新渲染物品列表');
            this.render();
          }
        }

        onEnable() {
          // 初始化时隐藏使用窗口
          if (this.useItemPanel) {
            this.useItemPanel.active = false;
          } // 关键修复：重置操作标志，防止场景切换后状态残留导致点击无效


          this.isProcessingUseItem = false;
          this.isProcessingDiscardItem = false;
          this.pendingRequestId = null; // 确保所有物品格子的按钮是可交互的（在渲染后执行）

          this.requestFetchBag();
        }

        onDisable() {
          // 关键修复：面板禁用时重置操作标志，防止状态残留
          this.isProcessingUseItem = false;
          this.isProcessingDiscardItem = false;
          this.pendingRequestId = null; // 清除选中状态

          this.clearSelection(); // 关闭使用窗口

          if (this.useItemPanel) {
            this.useItemPanel.active = false;
          } // 关闭机甲列表


          if (this.robotList) {
            this.robotList.clearCallbacks();

            if (this.robotList.node) {
              this.robotList.node.active = false;
            }
          } // 清除请求超时定时器


          this.clearRequestTimeout();
        }

        onDestroy() {
          var _this$introductionPan2;

          // 关键修复：取消监听角色切换事件
          if (this.ws) {
            this.ws.off('data_changed', this.onCharacterChanged, this);
            this.ws.off('network_disconnect', this.onNetworkDisconnectBag, this);
          } // 清除所有定时器（防止内存泄漏）


          this.clearRequestTimeout(); // 清除选中状态

          this.clearSelection(); // 移除WebSocket事件监听

          if (this.ws) {
            this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_WRITE_RESPONSE, this.onWriteResponse, this);
            this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_ITEMS_UPDATE, this.onBagItemsUpdate, this);
            this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_USE_ITEM_RESPONSE, this.onUseItemResponse, this);
            this.ws.off((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_DISCARD_ITEM_RESPONSE, this.onDiscardItemResponse, this);
          } // 移除全局点击事件监听


          if (input && typeof input.off === 'function') {
            input.off(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
          }

          if ((_this$introductionPan2 = this.introductionPanel) != null && _this$introductionPan2.isValid) {
            this.introductionPanel.off(Node.EventType.TOUCH_END, this.onIntroductionTouchEnd, this);
          } // 重置操作标志（防止状态残留）


          this.isProcessingUseItem = false;
          this.isProcessingDiscardItem = false;
          this.pendingRequestId = null;
          (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
            error: Error()
          }), UILockManager) : UILockManager).instance.forceUnlockAll();
        }

        switchCategory(cat) {
          this.cancelDragState(); // 切换分类时重置到第一页，并从服务端重新拉取该分类的第一页数据
          // MMO最佳实践：切换分类时强制刷新，确保数据是最新的
          // 关键修复：切换分类时重置版本号，强制获取新分类的数据

          this.currentCategory = cat;
          this.currentPage = 1;
          this.localBagVersion = 0; // 新增：重置版本号，强制获取新分类的数据

          this.updateCategoryTabUI(); // 强制从服务器获取最新数据

          this.requestFetchBag();
        }

        requestWriteRandom() {
          var _this$ws$getCharacter, _this$ws4;

          const cid = ((_this$ws$getCharacter = (_this$ws4 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter.call(_this$ws4)) || undefined; // 如果有输入框，就读取玩家输入的数量

          let count = undefined;

          if (this.randomCountEditBox) {
            const txt = this.randomCountEditBox.string.trim();

            if (txt.length > 0) {
              const n = parseInt(txt, 10);

              if (!isNaN(n) && n > 0) {
                count = n;
              }
            }
          }

          const msg = {
            type: (_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
              error: Error()
            }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_WRITE_RANDOM,
            character_id: cid
          }; // 不填就走原逻辑；填了就把数量发给服务端

          if (count !== undefined) {
            msg.count = count;
          }

          this.ws.send(msg);
        }
        /**
         * 请求获取背包物品（request → bag_items，含超时重试）。
         * 主动推送仍只走 bag_items_update，不与请求响应混为同一处理路径。
         */


        requestFetchBag() {
          var _this$ws$getCharacter2, _this$ws5;

          const cid = ((_this$ws$getCharacter2 = (_this$ws5 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter2.call(_this$ws5)) || undefined;

          if (!cid) {
            console.warn('⚠️ [BagItem] 无法获取角色ID，无法请求背包数据');
            return;
          }

          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_GET, {
            character_id: cid,
            category: this.currentCategory,
            page: this.currentPage,
            page_size: this.PAGE_SIZE,
            bag_version: this.localBagVersion
          }, resp => {
            this.applyBagSnapshot((_crd && normalizeBagItemsResponse === void 0 ? (_reportPossibleCrUseOfnormalizeBagItemsResponse({
              error: Error()
            }), normalizeBagItemsResponse) : normalizeBagItemsResponse)(resp));
          }, true, 10000);
        }

        /** 业务层只读 snapshot.items，不再自行解析响应层级 */
        applyBagSnapshot(snapshot) {
          if (!snapshot.success) {
            const msg = snapshot.message || '获取背包数据失败';
            console.error(`❌ [BagItem] 获取背包物品失败: ${msg}`);

            if (this.panel && this.panel.active) {
              this.showErrorTips(msg, false);
            }

            return;
          }

          this.localBagVersion = snapshot.bag_version || 0;
          const serverItems = snapshot.items;
          const serverPage = snapshot.page > 0 ? snapshot.page : this.currentPage || 1;
          const serverTotalPages = snapshot.total_pages > 0 ? snapshot.total_pages : this.totalPages || 1;

          if (serverPage !== this.currentPage) {
            console.log(`🔄 [BagItem] 页码已调整：请求 ${this.currentPage}，服务器返回 ${serverPage}`);
          }

          this.currentPage = serverPage;
          this.totalPages = serverTotalPages;

          if (this.currentPage > this.totalPages && this.totalPages > 0) {
            const oldPage = this.currentPage;
            this.currentPage = this.totalPages;
            console.log(`⚠️ [BagItem] 页码超出范围，从 ${oldPage} 调整为最后一页: ${this.currentPage}`);
            this.scheduleOnce(() => this.requestFetchBag(), 0.05);
            return;
          }

          if (serverItems.length === 0 && this.currentPage < this.totalPages && this.totalPages > 1) {
            console.log(`🔄 [BagItem] 当前页为空，调整到前一页`);
            this.currentPage = Math.max(1, this.currentPage - 1);
            this.scheduleOnce(() => this.requestFetchBag(), 0.05);
            return;
          }

          this.items = serverItems.map(it => ({
            item_id: it.item_id,
            quantity: it.quantity,
            category: it.category
          }));
          this.updatePageNumberUI();
          console.log(`📦 [BagItem] 收到服务器数据：${this.items.length} 个物品，页码 ${this.currentPage}/${this.totalPages}`);
          (_crd && BagEventHub === void 0 ? (_reportPossibleCrUseOfBagEventHub({
            error: Error()
          }), BagEventHub) : BagEventHub).emit('bag', {
            kind: 'refreshed',
            category: this.currentCategory,
            page: this.currentPage,
            itemCount: this.items.length
          });
          this.render();
          this.ensureButtonsAboveMask();
          this.ensureAllItemButtonsInteractable();
        }

        /**
         * 跳转到指定页（自动裁剪到 1~totalPages）
         * MMO最佳实践：翻页时总是从服务器获取最新数据，不使用缓存
         */
        gotoPage(targetPage) {
          this.cancelDragState();

          if (!this.totalPages || this.totalPages < 1) {
            this.totalPages = 1;
          }

          const p = Math.max(1, Math.min(targetPage, this.totalPages)); // 移除缓存检查，总是请求服务器获取最新数据
          // 即使页码相同，也要刷新以确保数据是最新的

          this.currentPage = p;
          this.updatePageNumberUI(); // 强制从服务器获取最新数据

          this.requestFetchBag();
        }
        /**
         * 更新页码显示，例如 1/4
         */


        updatePageNumberUI() {
          if (!this.pageNumberLabel) return;

          if (!this.totalPages || this.totalPages < 1) {
            this.totalPages = 1;
          }

          if (!this.currentPage || this.currentPage < 1) {
            this.currentPage = 1;
          }

          this.pageNumberLabel.string = `${this.currentPage}/${this.totalPages}`;
        }

        updateCategoryTabUI() {
          // 分类映射：1=Items, 2=Weapon+Gun(武器), 3=Wing+Dun+Armor(护甲), 4=Other(暂时不用)
          const buttons = [{
            btn: this.itemBtn || null,
            cat: 1
          }, // Items
          {
            btn: this.weaponBtn || null,
            cat: 2
          }, // 武器(Weapon+Gun)
          {
            btn: this.armorBtn || null,
            cat: 3
          } // 护甲(Wing+Dun+Armor)
          // { btn: this.otherBtn || null, cat: 4 }, // Other 暂时不使用
          ];

          for (const entry of buttons) {
            const btn = entry.btn;
            if (!btn) continue;
            const spr = btn.getComponent(Sprite);
            if (!spr) continue;
            const atlas = spr.spriteAtlas || null;
            const frameName = entry.cat === this.currentCategory ? this.selectedFrameName : this.unselectedFrameName;
            let sf = null;
            if (atlas) sf = atlas.getSpriteFrame(frameName);

            if (sf) {
              spr.spriteFrame = sf;
              btn.normalSprite = sf;
            }
          }
        }

        render() {
          if (!this.bagRoot && (!this.cellTemplate || !this.cellTemplate.parent) || !this.cellTemplate) return;
          const container = this.bagRoot || this.cellTemplate.parent;
          this.cancelDragState(); // 清除所有节点的选中效果（重要：在复用节点前清除，避免选中效果残留）

          for (const node of this.dynamicNodes) {
            if (node && node.isValid) {
              this.applyYellowFilter(node, false);
            }
          } // 清除选中状态（调用clearSelection确保完整清理）


          this.clearSelection(); // 隐藏统一的详情面板

          if (this.introductionPanel) {
            this.introductionPanel.active = false;
          } // 隐藏使用物品窗口（切换分类/翻页时关闭）


          if (this.useItemPanel) {
            this.useItemPanel.active = false;
          } // 清除待使用状态并关闭机甲列表


          this.pendingUseItemId = null;
          this.pendingUseItemNode = null; // 清除 RobotList 的回调并关闭

          if (this.robotList) {
            this.robotList.clearCallbacks();

            if (this.robotList.node) {
              this.robotList.node.active = false;
            }
          } // 先隐藏模板格子


          if (this.cellTemplate) {
            this.cellTemplate.active = false;
          }

          const base = this.cellTemplate;
          const baseUT = base.getComponent(UITransform);
          const cellW = baseUT ? baseUT.width : this.CELL_SIZE;
          const cellH = baseUT ? baseUT.height : this.CELL_SIZE;
          const originX = base.position.x;
          const originY = base.position.y;
          const baseList = this.items;

          const ft = this._bagNameFilter.trim();

          const specs = [];

          for (let i = 0; i < baseList.length; i++) {
            const item = baseList[i];

            if (ft) {
              const d = this.itemDataMap.get(item.item_id);
              const name = ((d == null ? void 0 : d.name) || '').toLowerCase();
              if (!name.includes(ft)) continue;
            }

            specs.push({
              item,
              pageLocalIndex: i
            });
          }

          const list = specs; // 确保节点池里至少有 list.length 个格子
          // 第 0 个永远是模板本身

          if (this.dynamicNodes.length === 0) {
            this.dynamicNodes.push(this.cellTemplate);
          }

          for (let i = this.dynamicNodes.length; i < list.length; i++) {
            const node = instantiate(this.cellTemplate);
            container.addChild(node);
            this.dynamicNodes.push(node);
          } // 渲染当前页需要的格子


          for (let i = 0; i < list.length; i++) {
            const {
              item,
              pageLocalIndex
            } = list[i];
            const node = this.dynamicNodes[i]; // 确保节点激活前清除所有选中效果（防止复用节点时残留）

            this.applyYellowFilter(node, false);
            node.active = true;
            const col = i % this.COLS;
            const row = Math.floor(i / this.COLS);
            const x = originX + col * (cellW + this.GAP);
            const y = originY - row * (cellH + this.GAP);
            node.setPosition(x, y);
            this.applyItemIcon(node, item.item_id);
            const labelNode = node.getChildByName('Label');
            let lbl = labelNode ? labelNode.getComponent(Label) : null;

            if (!lbl) {
              const firstLabel = node.getComponent(Label);

              if (firstLabel) {
                lbl = firstLabel;
              }
            }

            if (lbl) {
              lbl.string = String(item.quantity);
            }

            this.bindItemEvents(node, item.item_id, pageLocalIndex);
          } // 多余的节点隐藏掉，不销毁，下次复用，减少 GC 压力


          for (let i = list.length; i < this.dynamicNodes.length; i++) {
            const node = this.dynamicNodes[i];

            if (node && node.isValid) {
              node.active = false;
            }
          }
        }
        /**
         * 根据 item_id 应用对应的图标
         * @param node 物品节点
         * @param itemId 物品ID
         */


        applyItemIcon(node, itemId) {
          const spr = node.getComponent(Sprite);
          const btn = node.getComponent(Button);

          if (!spr) {
            console.warn(`⚠️ [BagItem] 节点缺少 Sprite 组件`);
            return;
          } // 检查数据是否已加载


          if (!this.itemsDataLoaded) {
            console.warn(`⚠️ [BagItem] Items.json 尚未加载完成，物品 ${itemId} 使用默认图标`);
            return;
          } // 从 Items.json 获取物品数据


          const itemData = this.itemDataMap.get(itemId);

          if (!itemData || !itemData.iconIndex) {
            console.warn(`⚠️ [BagItem] 物品 ${itemId} 没有找到对应的图标数据 (itemDataMap大小: ${this.itemDataMap.size})`);
            return;
          }

          const iconIndex = itemData.iconIndex; // 所有图标已统一到 UI2 图集，使用连字符格式（如 IconSet2-9、IconSet2-232、IconSet2-257 等）
          // 根据 iconIndex 格式选择图集：连字符格式 -> UI2 图集，下划线格式 -> IconSet2 图集（已废弃）

          const useUI2Atlas = iconIndex.includes('-');
          const atlas = useUI2Atlas ? this.ui2Atlas : this.iconSet2Atlas;

          if (!atlas) {
            console.error(`❌ [BagItem] 图集未设置: ${useUI2Atlas ? 'UI2' : 'IconSet2'}，请在编辑器中设置图集属性`);
            return;
          } // 从图集中获取 SpriteFrame


          let sf = null;
          const cacheKey = `${useUI2Atlas ? 'UI2' : 'IconSet2'}_${iconIndex}`; // 先检查缓存

          const cached = this.spriteCache.get(cacheKey);

          if (cached) {
            sf = cached;
          } else {
            // 尝试多种名称格式（兼容不同命名方式）
            const tryNames = [iconIndex]; // 优先使用原始名称
            // 如果包含连字符，也尝试下划线格式

            if (iconIndex.includes('-')) {
              tryNames.push(iconIndex.replace(/-/g, '_'));
            } // 如果包含下划线，也尝试连字符格式


            if (iconIndex.includes('_')) {
              tryNames.push(iconIndex.replace(/_/g, '-'));
            } // 依次尝试所有可能的名称


            for (const name of tryNames) {
              sf = atlas.getSpriteFrame(name);

              if (sf) {
                break;
              }
            }

            if (sf) {
              this.spriteCache.set(cacheKey, sf);
            }
          }

          if (sf) {
            spr.spriteFrame = sf;

            if (btn) {
              btn.normalSprite = sf;
            }
          } else {
            console.error(`❌ [BagItem] 在图集中未找到图标: ${iconIndex} (图集: ${useUI2Atlas ? 'UI2' : 'IconSet2'})`);
          }
        }

        resetMainActionButtons() {
          const list = [this.useBtn, this.discardBtn, this.useItemButton, this.nextPageBtn, this.prevPageBtn, this.testWriteBtn, this.testFetchBtn, this.itemBtn, this.weaponBtn, this.armorBtn, this.otherBtn, this.closeBtn];

          for (const b of list) {
            if (b) b.interactable = true;
          }
        }

        canActThrottle(ms) {
          const n = Date.now();
          if (n - this._lastUiThrottleTs < ms) return false;
          this._lastUiThrottleTs = n;
          return true;
        }

        onSortCurrentCategory() {
          var _this$ws$getCharacter3, _this$ws6;

          if (!this.canActThrottle(320)) return;
          const cid = ((_this$ws$getCharacter3 = (_this$ws6 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter3.call(_this$ws6)) || undefined;
          if (!cid) return;

          if (!(_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
            error: Error()
          }), UILockManager) : UILockManager).instance.tryLock('bag', this.REQUEST_TIMEOUT + 500)) {
            this.showErrorTips('操作进行中', false);
            return;
          }

          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_SORT, {
            character_id: cid,
            category: this.currentCategory
          }, resp => {
            (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
              error: Error()
            }), UILockManager) : UILockManager).instance.unlock('bag');
            this.localBagVersion = 0;

            if (!resp || !resp.success) {
              this.showErrorTips((resp == null ? void 0 : resp.message) || (resp == null ? void 0 : resp.error) || '整理失败', false);
            }

            this.requestFetchBag();
            (_crd && BagEventHub === void 0 ? (_reportPossibleCrUseOfBagEventHub({
              error: Error()
            }), BagEventHub) : BagEventHub).emit('bag', {
              kind: 'mutated',
              mutation: 'sort',
              success: !!(resp && resp.success),
              raw: resp
            });
          }, true, this.REQUEST_TIMEOUT);
        }

        sendBagMove(fromSlot, toSlot) {
          var _this$ws$getCharacter4, _this$ws7;

          if (fromSlot === toSlot || fromSlot < 0 || toSlot < 0) return;
          const cid = ((_this$ws$getCharacter4 = (_this$ws7 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter4.call(_this$ws7)) || undefined;
          if (!cid) return;

          if (!(_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
            error: Error()
          }), UILockManager) : UILockManager).instance.tryLock('bag', this.REQUEST_TIMEOUT + 500)) {
            this.showErrorTips('操作进行中', false);
            return;
          }

          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_MOVE_ITEM, {
            character_id: cid,
            category: this.currentCategory,
            from_slot: fromSlot,
            to_slot: toSlot
          }, resp => {
            (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
              error: Error()
            }), UILockManager) : UILockManager).instance.unlock('bag');
            this.localBagVersion = 0;

            if (!resp || !resp.success) {
              this.showErrorTips((resp == null ? void 0 : resp.message) || (resp == null ? void 0 : resp.error) || '移动失败', false);
            }

            this.requestFetchBag();
            (_crd && BagEventHub === void 0 ? (_reportPossibleCrUseOfBagEventHub({
              error: Error()
            }), BagEventHub) : BagEventHub).emit('bag', {
              kind: 'mutated',
              mutation: 'move',
              success: !!(resp && resp.success),
              raw: resp
            });
          }, true, this.REQUEST_TIMEOUT);
        }

        pickSlotIndexAtUi(ui) {
          const p = new Vec3(ui.x, ui.y, 0);

          for (let i = 0; i < this.dynamicNodes.length; i++) {
            const node = this.dynamicNodes[i];
            if (!node || !node.active) continue;
            const ut = node.getComponent(UITransform);
            if (!ut) continue;
            const lp = ut.convertToNodeSpaceAR(p);
            const hw = ut.width * 0.5;
            const hh = ut.height * 0.5;

            if (lp.x >= -hw && lp.x <= hw && lp.y >= -hh && lp.y <= hh) {
              const s = node.__bagSlot;
              return typeof s === 'number' ? s : (this.currentPage - 1) * this.PAGE_SIZE + i;
            }
          }

          return -1;
        }

        cancelDragState() {
          if (this._dragFromNode && this._dragFromNode.isValid) {
            const op = this._dragFromNode.getComponent(UIOpacity);

            if (op) op.opacity = 255;
          }

          this._dragFromSlot = -1;
          this._dragFromNode = null;
          this._dragging = false;
        }

        onBagTouchStart(e) {
          const node = e.currentTarget;
          const slot = node.__bagSlot;
          if (slot === undefined || this.isProcessingUseItem || this.isProcessingDiscardItem) return;
          this._dragFromSlot = slot;
          this._dragFromNode = node;
          this._dragging = false;
          e.getUILocation(this._dragStartUIPos);
        }

        onBagTouchMove(e) {
          if (this._dragFromSlot < 0) return;
          const cur = e.getUILocation(new Vec2());
          const dx = cur.x - this._dragStartUIPos.x;
          const dy = cur.y - this._dragStartUIPos.y;

          if (!this._dragging && Math.hypot(dx, dy) > 12) {
            this._dragging = true;
            this.cancelDelayedIntro();
            const n = this._dragFromNode;

            if (n && n.isValid) {
              let op = n.getComponent(UIOpacity);
              if (!op) op = n.addComponent(UIOpacity);
              op.opacity = 160;
            }
          }
        }

        onBagTouchEnd(e) {
          if (this._dragFromSlot < 0) return;

          if (this._dragging) {
            const cur = e.getUILocation(new Vec2());
            const to = this.pickSlotIndexAtUi(cur);

            if (to >= 0 && to !== this._dragFromSlot) {
              this.sendBagMove(this._dragFromSlot, to);
            }

            const n = this._dragFromNode;
            if (n && n.isValid) n._suppressClickOnce = true;
          }

          if (this._dragFromNode && this._dragFromNode.isValid) {
            const op = this._dragFromNode.getComponent(UIOpacity);

            if (op) op.opacity = 255;
          }

          this._dragFromSlot = -1;
          this._dragFromNode = null;
          this._dragging = false;
        }

        onBagTouchCancel(e) {
          this.onBagTouchEnd(e);
        }
        /**
         * 绑定物品格子的点击和悬浮事件
         * @param node 物品格子节点
         * @param itemId 物品ID
         * @param itemIndexInPage 当前页内的索引（0-based），用于计算slot_index
         */


        bindItemEvents(node, itemId, itemIndexInPage) {
          const btn = node.getComponent(Button);
          if (!btn) return;
          const globalSlot = (this.currentPage - 1) * this.PAGE_SIZE + itemIndexInPage;
          node.__bagSlot = globalSlot; // 关键修复：确保按钮是可交互的（防止场景切换后按钮被禁用）

          btn.interactable = true; // 设置Button的Transition为NONE，防止按下时图片切换

          btn.transition = Button.Transition.NONE; // 先移除可能存在的旧事件监听，避免重复绑定

          btn.node.off(Button.EventType.CLICK);
          node.off(Node.EventType.MOUSE_ENTER);
          node.off(Node.EventType.MOUSE_LEAVE);
          node.off(Node.EventType.TOUCH_START, this.onBagTouchStart, this);
          node.off(Node.EventType.TOUCH_MOVE, this.onBagTouchMove, this);
          node.off(Node.EventType.TOUCH_END, this.onBagTouchEnd, this);
          node.off(Node.EventType.TOUCH_CANCEL, this.onBagTouchCancel, this); // 点击事件 - 设置标志，防止被全局事件清除选中

          btn.node.on(Button.EventType.CLICK, () => {
            this._clickedOnItem = true; // 设置标志

            this.onItemClick(node, itemId, itemIndexInPage); // 延迟清除标志，让全局事件知道这是物品点击

            this.scheduleOnce(() => {
              this._clickedOnItem = false;
            }, 0.2); // 延迟200ms，比全局事件的延迟长
          }, this); // 鼠标进入事件（悬浮）

          node.on(Node.EventType.MOUSE_ENTER, () => {
            if (this.selectedItemNode !== node) {
              this.onItemHover(node, itemId);
            }
          }, this); // 鼠标离开事件

          node.on(Node.EventType.MOUSE_LEAVE, () => {
            if (this.hoveredItemNode === node && this.selectedItemNode !== node) {
              this.onItemHoverLeave(node);
            }
          }, this);
          node.on(Node.EventType.TOUCH_START, this.onBagTouchStart, this);
          node.on(Node.EventType.TOUCH_MOVE, this.onBagTouchMove, this);
          node.on(Node.EventType.TOUCH_END, this.onBagTouchEnd, this);
          node.on(Node.EventType.TOUCH_CANCEL, this.onBagTouchCancel, this);
        }
        /**
         * 处理物品格子点击事件（支持双击）
         * MMO最佳实践：确保选中状态的一致性，防止操作冲突
         * @param node 物品格子节点
         * @param itemId 物品ID
         * @param itemIndexInPage 当前页内的索引（0-based），用于计算slot_index
         */


        onItemClick(node, itemId, itemIndexInPage) {
          if (node._suppressClickOnce) {
            node._suppressClickOnce = false;
            return;
          } // 如果正在处理操作，忽略点击（防止状态混乱）


          if (this.isProcessingUseItem || this.isProcessingDiscardItem) {
            console.warn('⚠️ [BagItem] 操作进行中，忽略点击');
            return;
          } // 验证节点有效性


          if (!node || !node.isValid) {
            console.warn('⚠️ [BagItem] 节点无效，忽略点击');
            return;
          } // 双击检测：如果点击的是同一个物品，且在双击时间间隔内


          const now = Date.now();
          const isDoubleClick = this.lastClickItemId === itemId && this.lastClickTime > 0 && now - this.lastClickTime < this.DOUBLE_CLICK_INTERVAL; // 更新双击检测状态

          this.lastClickItemId = itemId;
          this.lastClickTime = now; // 如果是双击，显示使用窗口（双击前也需要设置选中状态）

          if (isDoubleClick) {
            this.cancelDelayedIntro(); // 清除之前的选中状态

            if (this.selectedItemNode && this.selectedItemNode !== node) {
              this.clearSelection();
            } // 设置新的选中状态


            this.selectedItemNode = node;
            this.selectedItemId = itemId;
            this.selectedItemSlotIndex = (this.currentPage - 1) * this.PAGE_SIZE + itemIndexInPage; // 应用选中效果

            this.applyYellowFilter(node, true);
            console.log(`🎯 [BagItem] 双击选中物品 ${itemId}，当前页: ${this.currentPage}，页内索引: ${itemIndexInPage}，全局slot_index: ${this.selectedItemSlotIndex}`);
            this.showUseItemPanel(itemId);
            return;
          } // 如果点击的是已选中的物品，则取消选中


          if (this.selectedItemNode === node && this.selectedItemId === itemId) {
            this.clearSelection();
            return;
          } // 清除之前的选中状态（确保单选）


          if (this.selectedItemNode && this.selectedItemNode !== node) {
            this.clearSelection();
          } // 设置新的选中状态


          this.selectedItemNode = node;
          this.selectedItemId = itemId; // 计算选中物品在当前分类中的全局slot索引（MMO最佳实践：精确标识物品位置）
          // slot_index = (当前页 - 1) * 每页大小 + 当前页内的索引（0-based）

          this.selectedItemSlotIndex = (this.currentPage - 1) * this.PAGE_SIZE + itemIndexInPage;
          console.log(`🎯 [BagItem] 选中物品 ${itemId}，当前页: ${this.currentPage}，页内索引: ${itemIndexInPage}，全局slot_index: ${this.selectedItemSlotIndex}`); // 清除悬浮状态（点击时应该关闭悬浮显示的简介）

          if (this.hoveredItemNode && this.hoveredItemNode !== node) {
            this.onItemHoverLeave(this.hoveredItemNode);
          }

          this.hoveredItemNode = null; // 点击后清除悬浮状态
          // 应用黄色滤镜

          this.applyYellowFilter(node, true); // 延迟显示简介，避免挡住格子导致第二次点击（双击）被详情截获而无法打开使用面板

          this.cancelDelayedIntro();

          const cb = () => {
            if (this.selectedItemNode === node && this.selectedItemId === itemId) {
              this.showIntroduction(itemId, node);
            }

            this._delayedIntroCallback = null;
          };

          this._delayedIntroCallback = cb;
          this.scheduleOnce(cb, 0.32);
        }
        /**
         * 处理物品格子悬浮事件
         * @param node 物品格子节点
         * @param itemId 物品ID
         */


        onItemHover(node, itemId) {
          // 如果已经有选中的物品，悬浮时不显示简介（选中状态优先）
          if (this.selectedItemNode) {
            return;
          } // 如果之前有悬浮的格子，先关闭它的简介


          if (this.hoveredItemNode && this.hoveredItemNode !== node) {
            this.onItemHoverLeave(this.hoveredItemNode);
          } // 设置当前悬浮的格子


          this.hoveredItemNode = node; // 显示简介面板（悬浮时），传入node以便获取图标

          this.showIntroduction(itemId, node);
        }
        /**
         * 处理物品格子悬浮离开事件
         * @param node 物品格子节点
         */


        onItemHoverLeave(node) {
          // 如果这个节点不是选中的，关闭它的简介面板
          if (this.selectedItemNode !== node) {
            if (this.introductionPanel) {
              this.introductionPanel.active = false;
            }

            this._introductionForItemId = null;
            this._introductionForItemNode = null;
            this._introductionForItemIndex = -1;
            this.hoveredItemNode = null;
          }
        }
        /**
         * 显示物品简介面板（使用统一的 Introduction 面板，根据格子位置动态偏移）
         * @param itemId 物品ID
         * @param itemNode 物品格子节点
         */


        showIntroduction(itemId, itemNode) {
          if (!itemNode) {
            console.warn('⚠️ [BagItem] 物品节点未提供');
            return;
          }

          if (!this.itemsDataLoaded) {
            console.warn('⚠️ [BagItem] Items.json 尚未加载完成');
            return;
          }

          const itemData = this.itemDataMap.get(itemId);

          if (!itemData) {
            console.warn(`⚠️ [BagItem] 物品 ${itemId} 没有找到对应的数据`);
            return;
          }

          const introPanel = this.introductionPanel;

          if (!introPanel) {
            console.warn('⚠️ [BagItem] 未在 BagItem 脚本上绑定 Introduction 面板节点');
            return;
          }

          this._introductionForItemId = itemId;
          this._introductionForItemNode = itemNode;
          this._introductionForItemIndex = this.dynamicNodes.indexOf(itemNode); // 显示面板

          introPanel.active = true; // === 按你说的：保持与模板格子的相对偏移不变，第7-10列往左偏移190 ===

          try {
            // 假设 cellTemplate 和 introductionPanel 在同一画布下，这里用世界坐标计算偏移
            if (!this.introWorldOffset && this.cellTemplate) {
              const templateWorld = this.cellTemplate.worldPosition;
              const introWorld = introPanel.worldPosition;
              this.introWorldOffset = new Vec3(introWorld.x - templateWorld.x, introWorld.y - templateWorld.y, introWorld.z - templateWorld.z);
            }

            const bag = this.bagRoot || this.cellTemplate.parent;

            if (bag && this.introWorldOffset) {
              const bagUT = bag.getComponent(UITransform); // 找到当前格子是第几列（索引从0开始，第1列=索引0，第7列=索引6）

              let col = 0;
              const nodeIndex = this.dynamicNodes.indexOf(itemNode);

              if (nodeIndex >= 0) {
                col = nodeIndex % this.COLS;
              } // 当前格子的世界坐标 + 当初模板格子到面板的偏移 = 面板新的世界坐标


              const itemWorld = itemNode.worldPosition;
              let offsetX = this.introWorldOffset.x;
              let offsetY = this.introWorldOffset.y;
              let offsetZ = this.introWorldOffset.z; // 第7-10列（索引6-9）往左偏移190像素

              if (col >= 6 && col <= 9) {
                offsetX -= 190;
              }

              const targetWorld = new Vec3(itemWorld.x + offsetX, itemWorld.y + offsetY, itemWorld.z + offsetZ); // 转回 bag 的本地坐标设置位置

              const localPos = new Vec3();

              if (bagUT) {
                bagUT.convertToNodeSpaceAR(targetWorld, localPos);
              } else {
                bag.inverseTransformPoint(localPos, targetWorld);
              }

              introPanel.setPosition(localPos.x, localPos.y, 0); // 放到最上层，避免被遮挡

              introPanel.setSiblingIndex(introPanel.parent.children.length - 1);
            }
          } catch (e) {
            console.warn('⚠️ [BagItem] 设置 Introduction 面板位置失败:', e);
          } // 获取Introduction面板的子节点


          const iconNode = introPanel.getChildByName('Icon');
          const nameNode = introPanel.getChildByName('Name');
          const categoryNode = introPanel.getChildByName('Category');
          const effectNode = introPanel.getChildByName('Effect');
          const priceNode = introPanel.getChildByName('Price');
          const requireLevelNode = introPanel.getChildByName('RequireLevel');
          const applicableMechaNode = introPanel.getChildByName('ApplicableMecha'); // 设置Icon图标（与物品图标一致，使用Button的normalSprite确保图片一致且不会改变）

          if (iconNode) {
            const iconSprite = iconNode.getComponent(Sprite);

            if (iconSprite) {
              const btn = itemNode.getComponent(Button); // 必须使用Button的normalSprite（原始图标，不会因为按下而改变）

              let targetFrame = null;

              if (btn && btn.normalSprite) {
                targetFrame = btn.normalSprite;
              } else {
                // 如果Button没有normalSprite，从itemData重新加载图标
                console.warn('⚠️ [BagItem] Button没有normalSprite，从itemData重新加载图标');
                this.applyItemIconToSprite(iconNode, itemId);
                return; // 已经设置了，直接返回
              }

              if (targetFrame) {
                iconSprite.spriteFrame = targetFrame;
              } else {
                // 如果无法从节点获取图标，从itemData获取图标
                this.applyItemIconToSprite(iconNode, itemId);
              }
            }
          } // 设置Name（直接使用节点上的Label组件）


          if (nameNode) {
            const nameLabel = nameNode.getComponent(Label);

            if (nameLabel) {
              nameLabel.string = itemData.name || '';
            }
          } // 设置Category（直接使用节点上的Label组件）


          if (categoryNode) {
            const categoryLabel = categoryNode.getComponent(Label);

            if (categoryLabel) {
              let categoryText = '';
              const itypeId = itemData.itypeId || 1; // 分类映射：1=Items, 2=Weapon+Gun(武器), 3=Wing+Dun+Armor(护甲)

              if (itypeId === 1) {
                categoryText = '物品';
              } else if (itypeId === 2 || itypeId === 3) {
                // Weapon, Gun -> 武器
                categoryText = '武器';
              } else if (itypeId === 4 || itypeId === 5 || itypeId === 6) {
                // Wing, Dun, Armor -> 护甲
                categoryText = '护甲';
              } else {
                categoryText = '其他';
              }

              if (itemData.consumable) {
                categoryText += '/可使用';
              }

              categoryLabel.string = categoryText;
            }
          } // 设置Effect（使用子节点的Label组件）
          // 优先显示 effecttext（用户友好的描述），如果没有则显示 effect（技术性字符串）


          if (effectNode) {
            const effectLabelNode = effectNode.getChildByName('Label');
            const effectLabel = effectLabelNode ? effectLabelNode.getComponent(Label) : null;

            if (effectLabel) {
              // 优先使用 effecttext，如果没有则使用 effect
              const displayText = itemData.effecttext || itemData.effect || '';
              effectLabel.string = displayText;
            }
          } // 设置Price（使用子节点的Label组件）


          if (priceNode) {
            const priceLabelNode = priceNode.getChildByName('Label');
            const priceLabel = priceLabelNode ? priceLabelNode.getComponent(Label) : null;

            if (priceLabel) {
              priceLabel.string = String(itemData.price || 0);
            }
          } // 设置RequireLevel（需要装备等级）


          if (requireLevelNode) {
            const requireLevelLabelNode = requireLevelNode.getChildByName('Label');
            const requireLevelLabel = requireLevelLabelNode ? requireLevelLabelNode.getComponent(Label) : null;

            if (requireLevelLabel) {
              const requiredLevel = itemData.requiredLevel || 0;

              if (requiredLevel > 0) {
                requireLevelLabel.string = String(requiredLevel);
              } else {
                requireLevelLabel.string = '无';
              }
            }
          } // 设置ApplicableMecha（适用机甲类型）


          if (applicableMechaNode) {
            const applicableMechaLabelNode = applicableMechaNode.getChildByName('Label');
            const applicableMechaLabel = applicableMechaLabelNode ? applicableMechaLabelNode.getComponent(Label) : null;

            if (applicableMechaLabel) {
              const itypeId = itemData.itypeId || 1;
              let applicableText = '无'; // 如果是物品（itypeId === 1），显示"无"

              if (itypeId !== 1) {
                // 是装备，需要判断适配的机甲类型
                const equipmentType = itemData.type || 0;
                const applicableTypes = []; // 职业固定装备（type 8-22）

                if (equipmentType >= 8 && equipmentType <= 22) {
                  // 根据 type 判断适配的职业
                  // type 8, 11, 14, 17, 20 -> 格斗型（Class 1）
                  // type 9, 12, 15, 18, 21 -> 射击型（Class 2）
                  // type 10, 13, 16, 19, 22 -> 全能型（Class 3）
                  if (equipmentType === 8 || equipmentType === 11 || equipmentType === 14 || equipmentType === 17 || equipmentType === 20) {
                    applicableTypes.push('格斗');
                  } else if (equipmentType === 9 || equipmentType === 12 || equipmentType === 15 || equipmentType === 18 || equipmentType === 21) {
                    applicableTypes.push('射击');
                  } else if (equipmentType === 10 || equipmentType === 13 || equipmentType === 16 || equipmentType === 19 || equipmentType === 22) {
                    applicableTypes.push('全能');
                  }
                } // 武器（type 1, 2）
                else if (equipmentType === 1 || equipmentType === 2) {
                  if (equipmentType === 1) {
                    // 重型武器：格斗型
                    applicableTypes.push('格斗');
                  } else {
                    // 轻型武器：格斗型、全能型
                    applicableTypes.push('格斗', '全能');
                  }
                } // 枪械（type 6, 7）
                else if (equipmentType === 6 || equipmentType === 7) {
                  if (equipmentType === 6) {
                    // 重型枪械：射击型
                    applicableTypes.push('射击');
                  } else {
                    // 轻型枪械：射击型、全能型
                    applicableTypes.push('射击', '全能');
                  }
                } // 通用装备（type 3, 4, 5）：盾牌、机翼、芯片
                else if (equipmentType === 3 || equipmentType === 4 || equipmentType === 5) {
                  // 所有机甲都可以装备
                  applicableTypes.push('格斗', '射击', '全能');
                }

                if (applicableTypes.length > 0) {
                  applicableText = applicableTypes.join('、');
                }
              }

              applicableMechaLabel.string = applicableText;
            }
          }
        }
        /**
         * 将物品图标应用到指定的Sprite节点
         * @param node 目标节点
         * @param itemId 物品ID
         */


        applyItemIconToSprite(node, itemId) {
          const spr = node.getComponent(Sprite);
          if (!spr) return;
          const itemData = this.itemDataMap.get(itemId);
          if (!itemData || !itemData.iconIndex) return;
          const iconIndex = itemData.iconIndex; // 所有图标已统一到 UI2 图集，使用连字符格式

          const useUI2Atlas = iconIndex.includes('-');
          const atlas = useUI2Atlas ? this.ui2Atlas : this.iconSet2Atlas;
          if (!atlas) return;
          const cacheKey = `${useUI2Atlas ? 'UI2' : 'IconSet2'}_${iconIndex}`;
          let sf = this.spriteCache.get(cacheKey);

          if (!sf) {
            // 尝试多种名称格式（兼容不同命名方式）
            const tryNames = [iconIndex]; // 优先使用原始名称
            // 如果包含连字符，也尝试下划线格式

            if (iconIndex.includes('-')) {
              tryNames.push(iconIndex.replace(/-/g, '_'));
            } // 如果包含下划线，也尝试连字符格式


            if (iconIndex.includes('_')) {
              tryNames.push(iconIndex.replace(/_/g, '-'));
            } // 依次尝试所有可能的名称


            for (const name of tryNames) {
              sf = atlas.getSpriteFrame(name);

              if (sf) {
                break;
              }
            }

            if (sf) {
              this.spriteCache.set(cacheKey, sf);
            }
          }

          if (sf) {
            spr.spriteFrame = sf;
          }
        }
        /**
         * 应用或移除黄色滤镜（50%透明的纯色覆盖层）
         * 确保滤镜与物品格子完全对齐：大小、位置、锚点都一致
         * @param node 物品格子节点
         * @param apply 是否应用滤镜
         */


        applyYellowFilter(node, apply) {
          // 检查节点有效性
          if (!node || !node.isValid) {
            return;
          }

          if (apply) {
            // 检查是否已经有滤镜覆盖层
            let filterNode = node.getChildByName('YellowFilter');

            if (!filterNode) {
              // 创建黄色滤镜覆盖层
              filterNode = new Node('YellowFilter');
              const uiTransform = filterNode.addComponent(UITransform);
              const baseUT = node.getComponent(UITransform);

              if (!baseUT) {
                console.warn('⚠️ [BagItem] 物品格子节点缺少UITransform组件');
                return;
              } // 确保尺寸完全一致


              uiTransform.width = baseUT.width;
              uiTransform.height = baseUT.height; // 确保锚点完全一致（这是关键！）

              uiTransform.anchorX = baseUT.anchorX;
              uiTransform.anchorY = baseUT.anchorY; // 设置位置为(0, 0, 0)，确保与父节点完全对齐
              // 由于锚点已经匹配，位置(0,0)应该让滤镜完全覆盖父节点

              filterNode.setPosition(0, 0, 0); // 确保父节点设置正确（添加到node）

              node.addChild(filterNode); // 用 Graphics 画纯色矩形，避免“浅浅小图标”叠加（node 复用时最容易出错）

              const g = filterNode.addComponent(Graphics);
              g.clear();
              g.fillColor = new Color(255, 255, 0, 90);
              const ox = -baseUT.width * baseUT.anchorX;
              const oy = -baseUT.height * baseUT.anchorY;
              g.rect(ox, oy, baseUT.width, baseUT.height);
              g.fill(); // 将滤镜节点移到最上层，确保它覆盖所有子节点

              filterNode.setSiblingIndex(node.children.length - 1); // 确保滤镜节点不会被其他节点遮挡
              // 注意：不需要监听Button状态变化，因为我们使用的是normalSprite，它不会改变
            } else {
              filterNode.active = true; // 重新同步尺寸，以防父节点尺寸改变

              const uiTransform = filterNode.getComponent(UITransform);
              const baseUT = node.getComponent(UITransform);

              if (uiTransform && baseUT) {
                uiTransform.width = baseUT.width;
                uiTransform.height = baseUT.height;
                uiTransform.anchorX = baseUT.anchorX;
                uiTransform.anchorY = baseUT.anchorY;
                const g = filterNode.getComponent(Graphics);

                if (g) {
                  g.clear();
                  g.fillColor = new Color(255, 255, 0, 90);
                  const ox = -baseUT.width * baseUT.anchorX;
                  const oy = -baseUT.height * baseUT.anchorY;
                  g.rect(ox, oy, baseUT.width, baseUT.height);
                  g.fill();
                }
              }
            }
          } else {
            // 移除滤镜
            const filterNode = node.getChildByName('YellowFilter');

            if (filterNode) {
              filterNode.active = false;
            }
          }
        }
        /**
         * 清除选中状态
         */


        clearSelection() {
          this.cancelDelayedIntro(); // 移除黄色滤镜（检查节点有效性）

          if (this.selectedItemNode && this.selectedItemNode.isValid) {
            this.applyYellowFilter(this.selectedItemNode, false);
          } // 隐藏统一简介面板


          if (this.introductionPanel) {
            this.introductionPanel.active = false;
          }

          this._introductionForItemId = null;
          this._introductionForItemNode = null;
          this._introductionForItemIndex = -1; // 清除选中状态

          this.selectedItemNode = null;
          this.selectedItemId = null;
          this.selectedItemSlotIndex = -1;
          this.hoveredItemNode = null;
          this._discardArmed = false;

          if (this._discardArmTimer) {
            clearTimeout(this._discardArmTimer);
            this._discardArmTimer = null;
          }
        }
        /**
         * 显示使用物品窗口
         * @param itemId 物品ID
         */


        showUseItemPanel(itemId) {
          if (!this.useItemPanel) {
            console.warn('⚠️ [BagItem] 未绑定 UseItem 面板节点');
            return;
          }

          this.cancelDelayedIntro(); // 关闭详情窗口

          if (this.introductionPanel) {
            this.introductionPanel.active = false;
          }

          this._introductionForItemId = null;
          this._introductionForItemNode = null;
          this._introductionForItemIndex = -1; // 取消选中状态（但保留 selectedItemId 用于使用/丢弃操作）

          if (this.selectedItemNode) {
            this.applyYellowFilter(this.selectedItemNode, false);
          }

          this.hoveredItemNode = null; // 显示使用窗口
          // 注意：不改变面板的图层顺序，保持编辑器中的原始顺序

          this.useItemPanel.active = true; // 更新使用窗口内的物品信息（如果需要显示物品详情）
          // 这里可以根据需要填充 UseItem 窗口内的图标、名称等信息
          // 暂时只显示窗口，具体内容可以根据你的 UI 结构来填充
        }
        /**
         * 关闭使用物品窗口
         */


        closeUseItemPanel() {
          if (this.useItemPanel) {
            // 直接隐藏，不改变图层顺序（保持编辑器中的原始顺序）
            this.useItemPanel.active = false;
          } // 清除待使用状态


          this.pendingUseItemId = null;
          this.pendingUseItemNode = null; // 清除 RobotList 的回调并关闭机甲列表（如果打开了）

          if (this.robotList) {
            this.robotList.clearCallbacks();

            if (this.robotList.node) {
              this.robotList.node.active = false;
            }
          } // 关闭后清除选中状态


          this.clearSelection(); // 确保按钮等可交互元素在 mask 上方（修复图层问题）

          this.ensureButtonsAboveMask();
          this.resetMainActionButtons();
        }
        /**
         * 确保按钮等可交互元素在 mask 上方（不改变 mask 的顺序）
         * 通过将按钮移到 mask 的父节点的最后（最上方）来实现
         */


        ensureButtonsAboveMask() {
          if (!this.panel) return; // 查找 MASK 节点

          const maskNode = this.findNodeByName(this.panel, 'MASK');
          if (!maskNode || !maskNode.parent) return;
          const parent = maskNode.parent;
          const maskIndex = parent.children.indexOf(maskNode);
          if (maskIndex < 0) return; // 需要移到 mask 上方的按钮节点列表（只处理在同一个父节点下的按钮）

          const buttonsToMove = [];

          if (this.useItemButton && this.useItemButton.node && this.useItemButton.node.parent === parent) {
            buttonsToMove.push(this.useItemButton.node);
          }

          if (this.closeBtn && this.closeBtn.node && this.closeBtn.node.parent === parent) {
            buttonsToMove.push(this.closeBtn.node);
          }

          if (this.itemBtn && this.itemBtn.node && this.itemBtn.node.parent === parent) {
            buttonsToMove.push(this.itemBtn.node);
          }

          if (this.weaponBtn && this.weaponBtn.node && this.weaponBtn.node.parent === parent) {
            buttonsToMove.push(this.weaponBtn.node);
          }

          if (this.armorBtn && this.armorBtn.node && this.armorBtn.node.parent === parent) {
            buttonsToMove.push(this.armorBtn.node);
          }

          if (this.otherBtn && this.otherBtn.node && this.otherBtn.node.parent === parent) {
            buttonsToMove.push(this.otherBtn.node);
          }

          if (this.nextPageBtn && this.nextPageBtn.node && this.nextPageBtn.node.parent === parent) {
            buttonsToMove.push(this.nextPageBtn.node);
          }

          if (this.prevPageBtn && this.prevPageBtn.node && this.prevPageBtn.node.parent === parent) {
            buttonsToMove.push(this.prevPageBtn.node);
          } // 将按钮移到 mask 之后（确保在 mask 上方）
          // 使用倒序处理，避免索引变化影响


          const buttonsToMoveIndices = buttonsToMove.map(btn => parent.children.indexOf(btn)).filter(idx => idx >= 0 && idx <= maskIndex);

          if (buttonsToMoveIndices.length > 0) {
            // 将所有需要移动的按钮移到 mask 之后
            // 从后往前移动，避免索引变化
            buttonsToMoveIndices.sort((a, b) => b - a);
            buttonsToMoveIndices.forEach(btnIndex => {
              const btnNode = parent.children[btnIndex];

              if (btnNode && btnIndex <= maskIndex) {
                // 移到 mask 之后的位置（maskIndex + 1）
                // 由于我们是从后往前处理，每次移动后 maskIndex 位置不变
                const targetIndex = maskIndex + 1;

                if (targetIndex < parent.children.length) {
                  btnNode.setSiblingIndex(targetIndex);
                }
              }
            });
          }
        }
        /**
         * 递归查找指定名称的节点
         */


        findNodeByName(parent, name) {
          if (parent.name === name) {
            return parent;
          }

          for (let i = 0; i < parent.children.length; i++) {
            const found = this.findNodeByName(parent.children[i], name);

            if (found) {
              return found;
            }
          }

          return null;
        }
        /**
         * 将 AniID 替换为指定形态（L1/L2/L3）
         */


        convertAniIdForForm(aniId, targetForm) {
          if (!aniId || targetForm < 1 || targetForm > 3) return aniId;
          const tag = `L${targetForm}`;
          const tags = ['L1', 'L2', 'L3'];

          for (const t of tags) {
            if (aniId.includes(t)) {
              return aniId.replace(t, tag);
            }
          }

          return aniId;
        }
        /**
         * 使用物品（MMO最佳实践：完整的状态验证和错误处理）
         * @param itemId 物品ID
         */


        onUseItem(itemId) {
          // 防止重复操作（双重检查）
          if (this.isProcessingUseItem) {
            console.warn('⚠️ [BagItem] 使用物品操作正在进行中，请稍候...');
            return;
          } // 验证基础数据


          if (!this.itemsDataLoaded) {
            console.error('❌ [BagItem] Items.json 尚未加载完成，无法使用物品');
            return;
          } // 检查物品是否存在于本地数据


          const itemData = this.itemDataMap.get(itemId);

          if (!itemData) {
            console.error(`❌ [BagItem] 物品 ${itemId} 在本地 Items.json 中不存在`);
            return;
          } // 检查物品是否在背包中（MMO最佳实践：客户端预检查，但服务器是权威）


          const bagItem = this.items.find(item => item.item_id === itemId);

          if (!bagItem) {
            console.error(`❌ [BagItem] 物品 ${itemId} 不在当前背包中（可能已被删除或不同步）`); // 刷新背包数据，确保数据同步

            this.requestFetchBag();
            return;
          } // 验证选中状态（如果选中状态丢失，尝试恢复）


          if (!this.selectedItemId || this.selectedItemId !== itemId || this.selectedItemSlotIndex < 0) {
            console.warn(`⚠️ [BagItem] 选中状态异常，尝试恢复: selectedItemId=${this.selectedItemId}, itemId=${itemId}, slotIndex=${this.selectedItemSlotIndex}`); // 尝试在当前页面查找该物品并恢复选中状态

            const itemIndex = this.items.findIndex(item => item.item_id === itemId);

            if (itemIndex >= 0 && itemIndex < this.dynamicNodes.length) {
              const node = this.dynamicNodes[itemIndex];

              if (node && node.isValid) {
                // 清除之前的选中状态
                if (this.selectedItemNode && this.selectedItemNode !== node && this.selectedItemNode.isValid) {
                  this.applyYellowFilter(this.selectedItemNode, false);
                } // 恢复选中状态


                this.selectedItemNode = node;
                this.selectedItemId = itemId;
                this.selectedItemSlotIndex = (this.currentPage - 1) * this.PAGE_SIZE + itemIndex;
                this.applyYellowFilter(node, true);
                console.log(`✅ [BagItem] 已恢复选中状态: 物品 ${itemId}，slot_index: ${this.selectedItemSlotIndex}`);
              } else {
                console.error(`❌ [BagItem] 无法恢复选中状态：节点无效`);
                return;
              }
            } else {
              console.error(`❌ [BagItem] 无法恢复选中状态：物品不在当前页面`);
              return;
            }
          } // 最终验证：确保选中状态完整


          if (!this.selectedItemId || this.selectedItemId !== itemId || this.selectedItemSlotIndex < 0) {
            console.error(`❌ [BagItem] 选中状态验证失败，无法使用物品`);
            return;
          } // 设置处理标志，防止重复操作


          this.isProcessingUseItem = true; // 根据 UsageTarget 判断使用方式

          const usageTarget = itemData.UsageTarget || 'Player'; // 默认为 Player

          if (usageTarget === 'Player') {
            // Player 类型：直接使用，消耗一个物品
            this.useItemForPlayer(itemId, itemData);
          } else if (usageTarget === 'Pet') {
            // Pet 类型：需要选择机甲后使用
            this.useItemForPet(itemId, itemData);
          } else {
            console.error(`❌ [BagItem] 未知的 UsageTarget: ${usageTarget}，物品ID: ${itemId}`); // 清除处理标志

            this.isProcessingUseItem = false;
          }
        }
        /**
         * 对玩家使用物品（直接消耗）
         * @param itemId 物品ID
         * @param itemData 物品数据
         */


        useItemForPlayer(itemId, itemData) {
          var _this$ws$getCharacter5, _this$ws8;

          console.log(`🎮 [BagItem] 对玩家使用物品: ${itemData.name} (ID: ${itemId})`);
          const cid = ((_this$ws$getCharacter5 = (_this$ws8 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter5.call(_this$ws8)) || undefined;

          if (!cid) {
            console.error('❌ [BagItem] 无法获取角色ID，无法使用物品');
            this.isProcessingUseItem = false;
            return;
          } // 发送使用物品请求到服务端
          // MMO最佳实践：发送slot_index精确定位物品（在当前分类中的全局索引）


          if (this.selectedItemSlotIndex < 0) {
            console.error(`❌ [BagItem] 无法确定物品的slot索引，无法使用`);
            this.isProcessingUseItem = false;
            return;
          } // 设置处理标志


          this.isProcessingUseItem = true;

          if (!(_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
            error: Error()
          }), UILockManager) : UILockManager).instance.tryLock('bag', this.REQUEST_TIMEOUT + 500)) {
            this.isProcessingUseItem = false;
            this.showErrorTips('操作进行中', false);
            return;
          } // 优化：使用request方法，自动生成request_id并匹配响应


          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_USE_ITEM, {
            character_id: cid,
            item_id: itemId,
            target_type: 'Player',
            category: this.currentCategory,
            // 发送当前分类
            slot_index: this.selectedItemSlotIndex // 发送精确的slot索引（在当前分类中的全局索引）

          }, response => {
            // 通过request_id匹配的响应回调
            this.onUseItemResponse(response);
          }, true, // 需要认证
          this.REQUEST_TIMEOUT // 使用配置的超时时间
          ); // 使用窗口保持打开状态（按需求）
          // 不关闭使用窗口，等待服务端响应后刷新数据
        }
        /**
         * 对机甲使用物品（需要选择机甲）
         * @param itemId 物品ID
         * @param itemData 物品数据
         */


        useItemForPet(itemId, itemData) {
          console.log(`🤖 [BagItem] 对机甲使用物品: ${itemData.name} (ID: ${itemId})，打开机甲列表选择目标`);

          if (!this.robotList) {
            console.error('❌ [BagItem] RobotList 未绑定，无法选择机甲'); // 修复点：错误路径恢复使用中的状态，避免后续操作被永久锁死

            this.isProcessingUseItem = false;
            return;
          } // 保存当前要使用的物品信息


          this.pendingUseItemId = itemId;
          this.pendingUseItemNode = this.selectedItemNode; // 先打开机甲列表节点

          if (this.robotList && this.robotList.node) {
            this.robotList.node.active = true;
          } else {
            console.error('❌ [BagItem] RobotList 未绑定或节点不存在'); // 修复点：错误路径恢复使用中的状态，避免后续操作被永久锁死

            this.isProcessingUseItem = false;
            return;
          } // 设置 RobotList 的回调（必须在 show() 之前设置，避免被清除）


          this.robotList.setCallbacks((petId, petData) => {
            // 确认选择机甲后使用物品（会记录使用日志）
            this.confirmUseItemForPet(itemId, petId, petData);
          }, () => {
            // 关键修复：取消选择机甲时，必须重置操作标志，否则后续无法双击
            // 取消选择机甲（不记录日志，减少噪音）
            // 使用窗口保持打开状态，回到背包界面
            this.pendingUseItemId = null;
            this.pendingUseItemNode = null; // 关键修复：重置操作标志，允许后续双击

            this.isProcessingUseItem = false;
          }); // 最后调用 show()（此时回调已设置，不会被清除）
          // 从背包启动时，传入fromBag=true，隐藏Set按钮

          this.robotList.show(true);
        }
        /**
         * 确认对机甲使用物品
         * @param itemId 物品ID
         * @param petId 机甲ID
         * @param petData 机甲数据
         */


        confirmUseItemForPet(itemId, petId, petData) {
          var _ref, _ref2, _petData$pet_id, _this$ws$getCharacter6, _this$ws9;

          const itemData = this.itemDataMap.get(itemId);

          if (!itemData) {
            console.error(`❌ [BagItem] 物品 ${itemId} 数据不存在`); // 修复点：错误路径恢复使用中的状态，避免后续操作被永久锁死

            this.isProcessingUseItem = false;
            return;
          }

          console.log(`✅ [BagItem] 对机甲 ${petData.RobotName || petId} 使用物品: ${itemData.name} (ID: ${itemId})`);
          const pid = String(petId || '').trim();

          if (!pid || pid.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(pid)) {
            console.error(`❌ [BagItem] petId 无效，拒绝发送: ${petId}`);
            this.isProcessingUseItem = false;
            this.showErrorTips('机甲 ID 无效', false);
            return;
          }

          const pdataId = String((_ref = (_ref2 = (_petData$pet_id = petData == null ? void 0 : petData.pet_id) != null ? _petData$pet_id : petData == null ? void 0 : petData._id) != null ? _ref2 : petData == null ? void 0 : petData.id) != null ? _ref : '').trim();

          if (pdataId && pdataId.toLowerCase() !== pid.toLowerCase()) {
            console.error(`❌ [BagItem] petId 与所选机甲数据不一致: req=${pid} data=${pdataId}`);
            this.isProcessingUseItem = false;
            this.showErrorTips('所选机甲与请求不一致', false);
            return;
          }

          if (this.robotList && !this.robotList.isPetInCurrentList(pid)) {
            console.warn(`⚠️ [BagItem] petId 不在当前已加载列表，仍交由服务端校验: ${pid}`);
          }

          const cid = ((_this$ws$getCharacter6 = (_this$ws9 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter6.call(_this$ws9)) || undefined;

          if (!cid) {
            console.error('❌ [BagItem] 无法获取角色ID，无法使用物品'); // 修复点：错误路径恢复使用中的状态，避免后续操作被永久锁死

            this.isProcessingUseItem = false;
            return;
          } // 关闭机甲列表（RobotList 的 hide 会在回调后调用）


          if (this.robotList && this.robotList.node) {
            this.robotList.hide('确认使用物品');
          } // 发送使用物品请求到服务端
          // MMO最佳实践：发送slot_index精确定位物品（在当前分类中的全局索引）
          // 注意：这里使用selectedItemSlotIndex，因为是在确认使用前选中的物品


          const slotIndex = this.selectedItemSlotIndex >= 0 ? this.selectedItemSlotIndex : -1;

          if (slotIndex < 0) {
            console.error(`❌ [BagItem] 无法确定物品的slot索引，无法使用`);
            this.isProcessingUseItem = false;
            return;
          } // 设置处理标志


          this.isProcessingUseItem = true;

          if (!(_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
            error: Error()
          }), UILockManager) : UILockManager).instance.tryLock('bag', this.REQUEST_TIMEOUT + 500)) {
            this.isProcessingUseItem = false;
            this.showErrorTips('操作进行中', false);
            return;
          } // 优化：使用request方法，自动生成request_id并匹配响应


          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_USE_ITEM, {
            character_id: cid,
            item_id: itemId,
            target_type: 'Pet',
            pet_id: pid,
            category: this.currentCategory,
            // 发送当前分类
            slot_index: slotIndex // 发送精确的slot索引（在当前分类中的全局索引）

          }, response => {
            // 通过request_id匹配的响应回调
            this.onUseItemResponse(response);
          }, true, // 需要认证
          this.REQUEST_TIMEOUT // 使用配置的超时时间
          ); // 清除待使用状态

          this.pendingUseItemId = null;
          this.pendingUseItemNode = null; // 使用窗口保持打开状态（按需求）
        }
        /**
         * 丢弃物品（删除整个格子）
         * @param itemId 物品ID
         */


        onDiscardItem(itemId) {
          var _this$ws$getCharacter7, _this$ws10;

          // 防止重复操作
          if (this.isProcessingDiscardItem) {
            console.warn('⚠️ [BagItem] 丢弃物品操作正在进行中，请稍候...');
            return;
          }

          if (!this.itemsDataLoaded) {
            console.error('❌ [BagItem] Items.json 尚未加载完成，无法丢弃物品');
            return;
          } // 检查物品是否在背包中


          const bagItem = this.items.find(item => item.item_id === itemId);

          if (!bagItem) {
            console.error(`❌ [BagItem] 物品 ${itemId} 不在当前背包中（可能已被删除或不同步）`); // 刷新背包数据，确保数据同步

            this.requestFetchBag();
            return;
          }

          const itemData = this.itemDataMap.get(itemId);
          const itemName = itemData ? itemData.name : `物品ID: ${itemId}`;
          const quantity = bagItem.quantity;
          console.log(`🗑️ [BagItem] 丢弃物品: ${itemName} (ID: ${itemId})，数量: ${quantity}（删除整个格子）`);

          if (!this._discardArmed) {
            this._discardArmed = true;
            if (this._discardArmTimer) clearTimeout(this._discardArmTimer);
            this._discardArmTimer = setTimeout(() => {
              this._discardArmed = false;
              this._discardArmTimer = null;
            }, 5000);
            this.showErrorTips('请再次点击「丢弃」确认', false);
            return;
          }

          this._discardArmed = false;

          if (this._discardArmTimer) {
            clearTimeout(this._discardArmTimer);
            this._discardArmTimer = null;
          }

          if (!this.canActThrottle(320)) return;
          const cid = ((_this$ws$getCharacter7 = (_this$ws10 = this.ws).getCharacterId) == null ? void 0 : _this$ws$getCharacter7.call(_this$ws10)) || undefined;

          if (!cid) {
            console.error('❌ [BagItem] 无法获取角色ID，无法丢弃物品'); // 修复点：错误路径恢复丢弃中的状态，避免后续操作被永久锁死

            this.isProcessingDiscardItem = false;
            return;
          } // 设置处理标志，防止重复操作


          this.isProcessingDiscardItem = true; // 发送丢弃物品请求到服务端（删除整个格子）
          // MMO最佳实践：发送slot_index精确定位物品（在当前分类中的全局索引）

          if (this.selectedItemSlotIndex < 0) {
            console.error(`❌ [BagItem] 无法确定物品的slot索引，无法丢弃`);
            this.isProcessingDiscardItem = false;
            return;
          }

          if (!(_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
            error: Error()
          }), UILockManager) : UILockManager).instance.tryLock('bag', this.REQUEST_TIMEOUT + 500)) {
            this.isProcessingDiscardItem = false;
            this.showErrorTips('操作进行中', false);
            return;
          } // 优化：使用request方法，自动生成request_id并匹配响应


          this.ws.request((_crd && GameConfig === void 0 ? (_reportPossibleCrUseOfGameConfig({
            error: Error()
          }), GameConfig) : GameConfig).MESSAGE_TYPES.BAG_DISCARD_ITEM, {
            character_id: cid,
            item_id: itemId,
            category: this.currentCategory,
            // 发送当前分类
            slot_index: this.selectedItemSlotIndex // 发送精确的slot索引（在当前分类中的全局索引）

          }, response => {
            // 通过request_id匹配的响应回调
            this.onDiscardItemResponse(response);
          }, true, // 需要认证
          this.REQUEST_TIMEOUT // 使用配置的超时时间
          ); // 关闭使用窗口

          this.closeUseItemPanel(); // 等待服务端响应后刷新数据（在 onDiscardItemResponse 中处理）
        }
        /**
         * 清除请求超时定时器
         */


        clearRequestTimeout() {
          if (this.requestTimeoutTimer) {
            clearTimeout(this.requestTimeoutTimer);
            this.requestTimeoutTimer = null;
          }
        }
        /**
         * 处理请求超时（MMO最佳实践：超时恢复机制）
         */


        handleRequestTimeout() {
          console.warn('⚠️ [BagItem] 请求超时，恢复状态并刷新数据');
          this.clearRequestTimeout();
          (_crd && UILockManager === void 0 ? (_reportPossibleCrUseOfUILockManager({
            error: Error()
          }), UILockManager) : UILockManager).instance.unlock('bag');
          this.isProcessingUseItem = false;
          this.isProcessingDiscardItem = false;
          this.pendingRequestId = null; // 关闭使用窗口

          this.closeUseItemPanel(); // 刷新背包数据（确保数据同步）

          this.requestFetchBag();
        }

        /**
         * 处理全局触摸结束事件 - 检测点击外部区域取消选中
         * @param event 触摸事件
         */
        onGlobalTouchEnd(event) {
          // 如果使用窗口打开，不处理全局点击（使用窗口有自己的关闭逻辑）
          if (this.useItemPanel && this.useItemPanel.active) {
            return;
          } // 如果没有选中状态，直接返回


          if (!this.selectedItemNode && !this.hoveredItemNode) {
            return;
          } // 如果刚刚点击了物品格子，不处理（让Button事件处理）


          if (this._clickedOnItem) {
            return;
          } // 延迟执行，确保Button点击事件先完成


          this.scheduleOnce(() => {
            // 如果使用窗口打开，不处理
            if (this.useItemPanel && this.useItemPanel.active) {
              return;
            } // 如果刚刚点击了物品，不处理


            if (this._clickedOnItem) {
              return;
            } // 如果没有选中状态，直接返回


            if (!this.selectedItemNode && !this.hoveredItemNode) {
              return;
            } // 获取点击目标


            if (!event || !event.target) {
              // 没有目标，清除选中
              if (this.selectedItemNode) {
                this.clearSelection();
              }

              return;
            }

            const target = event.target;

            if (!target || !target.isValid) {
              // 目标无效，清除选中
              if (this.selectedItemNode) {
                this.clearSelection();
              }

              return;
            } // 检查是否点击在物品格子上


            let isItemNode = false;

            for (const itemNode of this.dynamicNodes) {
              if (itemNode && itemNode.isValid) {
                // 检查target是否是itemNode或其子节点
                let node = target;

                while (node) {
                  if (node === itemNode) {
                    isItemNode = true;
                    break;
                  }

                  node = node.parent;
                }

                if (isItemNode) break;
              }
            } // 如果点击在物品格子上，不处理


            if (isItemNode) {
              return;
            } // 检查是否点击在Introduction面板上


            if (this.introductionPanel && this.introductionPanel.active && this.introductionPanel.isValid) {
              let node = target;

              while (node) {
                if (node === this.introductionPanel) {
                  return; // 点击在Introduction面板上，不清除
                }

                node = node.parent;
              }
            } // 检查是否点击在使用窗口上


            if (this.useItemPanel && this.useItemPanel.active && this.useItemPanel.isValid) {
              let node = target;

              while (node) {
                if (node === this.useItemPanel) {
                  return; // 点击在使用窗口上，不清除
                }

                node = node.parent;
              }
            } // 检查是否点击在按钮上


            const buttons = [this.itemBtn, this.weaponBtn, this.armorBtn, this.otherBtn, this.closeBtn, this.testWriteBtn, this.testFetchBtn, this.useItemButton, this.useBtn, this.discardBtn];

            for (const btn of buttons) {
              if (btn && btn.node && btn.node.isValid) {
                let node = target;

                while (node) {
                  if (node === btn.node) {
                    return; // 点击在按钮上，不清除
                  }

                  node = node.parent;
                }
              }
            } // 点击在其他地方，清除选中状态


            if (this.selectedItemNode) {
              this.clearSelection();
            }

            if (this.hoveredItemNode) {
              this.onItemHoverLeave(this.hoveredItemNode);
            }
          }, 0.15); // 延迟150ms，确保Button事件先执行
        }
        /**
         * 检查点是否在节点内（已废弃，改用节点层次关系判断）
         * 保留此方法以防将来需要使用，但添加了安全的错误处理
         * @param node 节点
         * @param point 点坐标（UI坐标，来自event.getUILocation()）
         * @returns 是否在节点内
         */


        isPointInNode(node, point) {
          try {
            if (!node || !node.isValid) {
              return false;
            }

            const uiTransform = node.getComponent(UITransform);

            if (!uiTransform) {
              return false;
            } // 使用convertToNodeSpaceAR将UI坐标转换为节点的本地坐标
            // 添加try-catch防止camera相关错误


            const uiPos = new Vec3(point.x, point.y, 0);
            const localPos = new Vec3();

            try {
              uiTransform.convertToNodeSpaceAR(uiPos, localPos);
            } catch (error) {
              // 如果转换失败（可能因为camera引用问题），返回false
              console.warn('⚠️ [BagItem] convertToNodeSpaceAR失败:', error);
              return false;
            } // 获取节点的尺寸和锚点


            const width = uiTransform.width;
            const height = uiTransform.height;
            const anchorX = uiTransform.anchorX;
            const anchorY = uiTransform.anchorY; // 计算节点的边界（相对于节点锚点）

            const left = -width * anchorX;
            const right = width * (1 - anchorX);
            const bottom = -height * anchorY;
            const top = height * (1 - anchorY); // 检查点是否在边界内

            const inBounds = localPos.x >= left && localPos.x <= right && localPos.y >= bottom && localPos.y <= top;
            return inBounds;
          } catch (error) {
            console.error('❌ [BagItem] isPointInNode错误:', error);
            return false;
          }
        }
        /**
         * 显示错误/成功提示（简单版本）
         * @param message 提示消息
         * @param isSuccess 是否成功（true=成功，false=失败）
         */


        showErrorTips(message, isSuccess) {
          // 如果没有绑定 ErrorTips 面板或 Label，尝试自动查找
          if (!this.errorTipsPanel && this.panel) {
            this.errorTipsPanel = this.findNodeByName(this.panel, 'ErrorTips');
          }

          if (!this.errorTipsPanel) {
            console.warn('⚠️ [BagItem] ErrorTips 面板未找到，无法显示提示');
            return;
          } // 如果没有绑定 Label，尝试从 ErrorTips 面板下查找


          if (!this.errorTipsLabel && this.errorTipsPanel) {
            const labelNode = this.errorTipsPanel.getChildByName('Label');

            if (labelNode) {
              this.errorTipsLabel = labelNode.getComponent(Label);
            }
          }

          if (!this.errorTipsLabel) {
            console.warn('⚠️ [BagItem] ErrorTips Label 未找到，无法显示提示');
            return;
          } // 取消之前的隐藏定时器


          this.unschedule(this.hideErrorTips); // 设置提示文本

          this.errorTipsLabel.string = message; // 设置颜色：成功=FFFF00（黄色），失败=FF3F3F（红色）

          const successColor = new Color(255, 255, 0, 255); // FFFF00

          const failColor = new Color(255, 63, 63, 255); // FF3F3F

          this.errorTipsLabel.color = isSuccess ? successColor : failColor; // 显示面板（确保正常显示）

          this.errorTipsPanel.active = true;
          this.errorTipsPanel.setScale(1, 1, 1); // 确保背景正常显示

          const sprite = this.errorTipsPanel.getComponent(Sprite);

          if (sprite) {
            sprite.color = new Color(255, 255, 255, 255);
          } // 2秒后自动隐藏


          this.scheduleOnce(this.hideErrorTips, 2.0);
        }

        /**
         * 确保所有物品格子的按钮是可交互的
         * 关键修复：防止场景切换后按钮被禁用导致点击无效
         */
        ensureAllItemButtonsInteractable() {
          for (let i = 0; i < this.dynamicNodes.length; i++) {
            const node = this.dynamicNodes[i];

            if (node && node.isValid && node.active) {
              const btn = node.getComponent(Button);

              if (btn) {
                // 确保按钮是可交互的
                btn.interactable = true;
              }
            }
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "panel", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "closeBtn", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "itemBtn", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "weaponBtn", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "armorBtn", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "otherBtn", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "bagRoot", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "cellTemplate", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "testWriteBtn", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "testFetchBtn", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "randomCountEditBox", [_dec12], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "bagFilterEdit", [_dec13], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor13 = _applyDecoratedDescriptor(_class2.prototype, "nextPageBtn", [_dec14], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor14 = _applyDecoratedDescriptor(_class2.prototype, "prevPageBtn", [_dec15], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor15 = _applyDecoratedDescriptor(_class2.prototype, "pageNumberLabel", [_dec16], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor16 = _applyDecoratedDescriptor(_class2.prototype, "ui2Atlas", [_dec17], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor17 = _applyDecoratedDescriptor(_class2.prototype, "iconSet2Atlas", [_dec18], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor18 = _applyDecoratedDescriptor(_class2.prototype, "introductionPanel", [_dec19], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor19 = _applyDecoratedDescriptor(_class2.prototype, "useItemPanel", [_dec20], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor20 = _applyDecoratedDescriptor(_class2.prototype, "useItemButton", [_dec21], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor21 = _applyDecoratedDescriptor(_class2.prototype, "useBtn", [_dec22], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor22 = _applyDecoratedDescriptor(_class2.prototype, "discardBtn", [_dec23], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor23 = _applyDecoratedDescriptor(_class2.prototype, "robotList", [_dec24], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor24 = _applyDecoratedDescriptor(_class2.prototype, "errorTipsPanel", [_dec25], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor25 = _applyDecoratedDescriptor(_class2.prototype, "errorTipsLabel", [_dec26], {
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
//# sourceMappingURL=d316856f23317ff7f91551f4ae5d556e3b81f602.js.map