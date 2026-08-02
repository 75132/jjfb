System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, _dec, _class, _class2, _crd, ccclass, DataCacheManager;

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "bd8b3ev6rJP+qv2zdwS38VH", "DataCacheManager", undefined);

      __checkObsolete__(['_decorator']);

      ({
        ccclass
      } = _decorator);
      /**
       * 数据缓存管理器
       * 用于在登录/选择角色成功后预加载数据，面板打开时先显示缓存再更新最新数据
       * MMO最佳实践：预加载 + 缓存 + 实时更新
       */

      _export("DataCacheManager", DataCacheManager = (_dec = ccclass('DataCacheManager'), _dec(_class = (_class2 = class DataCacheManager {
        constructor() {
          // 背包数据缓存
          this.bagCache = null;
          // 机甲列表数据缓存
          this.robotPetsCache = null;
          // 机甲详情数据缓存（按pet_id索引）
          this.robotPetInfoCache = new Map();
          // 缓存过期时间（毫秒），默认5分钟
          this.CACHE_TTL = 5 * 60 * 1000;
        }

        static getInstance() {
          if (!DataCacheManager.instance) {
            DataCacheManager.instance = new DataCacheManager();
          }

          return DataCacheManager.instance;
        }
        /**
         * 设置背包数据缓存
         */


        setBagCache(characterId, data) {
          this.bagCache = {
            characterId,
            data,
            timestamp: Date.now()
          };
          console.log(`💾 [DataCacheManager] 已缓存背包数据 (character_id: ${characterId})`);
        }
        /**
         * 获取背包数据缓存
         */


        getBagCache(characterId) {
          if (!this.bagCache || this.bagCache.characterId !== characterId) {
            return null;
          } // 检查是否过期


          if (Date.now() - this.bagCache.timestamp > this.CACHE_TTL) {
            this.bagCache = null;
            return null;
          }

          return this.bagCache.data;
        }
        /**
         * 清除背包数据缓存
         */


        clearBagCache(characterId) {
          if (!characterId || !this.bagCache || this.bagCache.characterId === characterId) {
            this.bagCache = null;
            console.log(`🗑️ [DataCacheManager] 已清除背包数据缓存`);
          }
        }
        /**
         * 设置机甲列表数据缓存
         */


        setRobotPetsCache(characterId, data) {
          this.robotPetsCache = {
            characterId,
            data,
            timestamp: Date.now()
          };
          console.log(`💾 [DataCacheManager] 已缓存机甲列表数据 (character_id: ${characterId})`);
        }
        /**
         * 获取机甲列表数据缓存
         */


        getRobotPetsCache(characterId) {
          if (!this.robotPetsCache || this.robotPetsCache.characterId !== characterId) {
            return null;
          } // 检查是否过期


          if (Date.now() - this.robotPetsCache.timestamp > this.CACHE_TTL) {
            this.robotPetsCache = null;
            return null;
          }

          return this.robotPetsCache.data;
        }
        /**
         * 清除机甲列表数据缓存
         */


        clearRobotPetsCache(characterId) {
          if (!characterId || !this.robotPetsCache || this.robotPetsCache.characterId === characterId) {
            this.robotPetsCache = null;
            console.log(`🗑️ [DataCacheManager] 已清除机甲列表数据缓存`);
          }
        }
        /**
         * 设置机甲详情数据缓存
         */


        setRobotPetInfoCache(petId, data) {
          this.robotPetInfoCache.set(petId, {
            data,
            timestamp: Date.now()
          });
          console.log(`💾 [DataCacheManager] 已缓存机甲详情数据 (pet_id: ${petId})`);
        }
        /**
         * 获取机甲详情数据缓存
         */


        getRobotPetInfoCache(petId) {
          const cache = this.robotPetInfoCache.get(petId);

          if (!cache) {
            return null;
          } // 检查是否过期


          if (Date.now() - cache.timestamp > this.CACHE_TTL) {
            this.robotPetInfoCache.delete(petId);
            return null;
          }

          return cache.data;
        }
        /**
         * 清除机甲详情数据缓存
         */


        clearRobotPetInfoCache(petId) {
          if (petId) {
            this.robotPetInfoCache.delete(petId);
            console.log(`🗑️ [DataCacheManager] 已清除机甲详情数据缓存 (pet_id: ${petId})`);
          } else {
            this.robotPetInfoCache.clear();
            console.log(`🗑️ [DataCacheManager] 已清除所有机甲详情数据缓存`);
          }
        }
        /**
         * 清除所有缓存（切换角色 / 完全登出等流程中由 WebSocketManager 触发）
         */


        clearAllCache() {
          this.bagCache = null;
          this.robotPetsCache = null;
          this.robotPetInfoCache.clear();
          console.log(`🗑️ [DataCacheManager] 已清除所有缓存`);
        }
        /**
         * 清除指定角色的所有缓存
         */


        clearCharacterCache(characterId) {
          this.clearBagCache(characterId);
          this.clearRobotPetsCache(characterId); // 机甲详情缓存无法按characterId清除，因为key是petId
          // 可以选择清除所有，或者在需要时按需清除

          console.log(`🗑️ [DataCacheManager] 已清除角色缓存 (character_id: ${characterId})`);
        }

      }, _class2.instance = null, _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=1f7125230db110b1f22eadefb9e65802d3e3e76a.js.map