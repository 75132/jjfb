System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, resources, SpriteFrame, JsonAsset, _dec, _class, _class2, _crd, ccclass, ResourceManager;

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      resources = _cc.resources;
      SpriteFrame = _cc.SpriteFrame;
      JsonAsset = _cc.JsonAsset;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "2776fa2UJFO6amj/I2O9MPQ", "ResourceManager", undefined);

      __checkObsolete__(['_decorator', 'resources', 'Asset', 'SpriteFrame', 'JsonAsset', 'Prefab', 'Texture2D', 'AudioClip', 'assetManager', 'Constructor']);

      ({
        ccclass
      } = _decorator);
      /**
       * 资源管理器 - 统一管理游戏资源加载和缓存
       * 
       * 功能特性：
       * 1. 首次加载资源，后续使用缓存
       * 2. 支持版本管理，有更新的必须用新的
       * 3. 动态陆续加载到缓存中
       * 4. 支持单个资源、资源目录、资源列表加载
       * 5. 支持预加载和按需加载
       * 6. 支持资源释放管理
       * 
       * 使用示例：
       * ```typescript
       * // 加载单个资源
       * ResourceManager.getInstance().loadAsset<SpriteFrame>('Robot/xh_L1-0/spriteFrame', SpriteFrame, (err, asset) => {
       *     if (!err) {
       *         // 使用资源
       *     }
       * });
       * 
       * // 加载资源目录（首次加载，后续使用缓存）
       * ResourceManager.getInstance().loadDir('Weapon/Weapon', SpriteFrame, (err, assets) => {
       *     if (!err) {
       *         // 使用资源数组
       *     }
       * });
       * 
       * // 带版本号的加载（有更新时自动重新加载）
       * ResourceManager.getInstance().loadAssetWithVersion('json/Items', JsonAsset, 2, (err, asset) => {
       *     if (!err) {
       *         // 使用资源
       *     }
       * });
       * 
       * // 预加载资源列表
       * ResourceManager.getInstance().preloadAssets([
       *     { path: 'json/Items', type: JsonAsset },
       *     { path: 'json/Weapon', type: JsonAsset },
       * ], (progress) => {
       *     console.log(`预加载进度: ${progress}%`);
       * });
       * ```
       */

      _export("ResourceManager", ResourceManager = (_dec = ccclass('ResourceManager'), _dec(_class = (_class2 = class ResourceManager {
        constructor() {
          // 资源缓存：path -> { asset, version, timestamp }
          this.resourceCache = new Map();
          // 正在加载的资源：path -> Promise
          this.loadingPromises = new Map();
          // 资源版本信息：path -> version（可以从服务器获取）
          this.resourceVersions = new Map();
          // 缓存过期时间（毫秒），默认30分钟
          this.CACHE_TTL = 30 * 60 * 1000;
          // 最大缓存数量（防止内存溢出）
          this.MAX_CACHE_SIZE = 1000;
          // 陆续加载配置：每次并发加载的资源数量（避免一次性加载造成卡顿）
          this.CONCURRENT_LOAD_COUNT = 2;
          // 陆续加载配置：每个资源加载完成后的延迟时间（毫秒），给主线程喘息时间
          this.LOAD_DELAY_MS = 50;
        }

        /**
         * 获取单例实例
         */
        static getInstance() {
          if (!ResourceManager.instance) {
            ResourceManager.instance = new ResourceManager();
          }

          return ResourceManager.instance;
        }
        /**
         * 加载单个资源（带缓存）
         * @param path 资源路径（不包含扩展名，相对于 resources 目录）
         * @param type 资源类型构造函数（如 SpriteFrame, JsonAsset, Prefab 等）
         * @param callback 加载完成回调
         * @param forceReload 是否强制重新加载（忽略缓存）
         */


        loadAsset(path, type, callback, forceReload) {
          if (forceReload === void 0) {
            forceReload = false;
          }

          // 检查缓存
          if (!forceReload && this.resourceCache.has(path)) {
            var cached = this.resourceCache.get(path);
            var _asset = cached.asset; // 检查是否过期

            if (Date.now() - cached.timestamp < this.CACHE_TTL) {
              console.log("\u2705 [ResourceManager] \u4F7F\u7528\u7F13\u5B58\u8D44\u6E90: " + path);
              callback(null, _asset);
              return;
            } else {
              // 缓存过期，清除
              this.resourceCache.delete(path);
            }
          } // 检查是否正在加载


          if (this.loadingPromises.has(path)) {
            this.loadingPromises.get(path).then(asset => {
              callback(null, asset);
            }).catch(err => {
              callback(err, null);
            });
            return;
          } // 开始加载


          console.log("\uD83D\uDCE6 [ResourceManager] \u5F00\u59CB\u52A0\u8F7D\u8D44\u6E90: " + path);
          var loadPromise = new Promise((resolve, reject) => {
            resources.load(path, type, (err, asset) => {
              this.loadingPromises.delete(path);

              if (err) {
                console.error("\u274C [ResourceManager] \u52A0\u8F7D\u8D44\u6E90\u5931\u8D25: " + path, err);
                reject(err);
                return;
              }

              if (!asset) {
                var error = new Error("\u8D44\u6E90\u52A0\u8F7D\u8FD4\u56DE\u4E3A\u7A7A: " + path);
                console.error("\u274C [ResourceManager]", error);
                reject(error);
                return;
              } // 存入缓存


              this.setCache(path, asset);
              console.log("\u2705 [ResourceManager] \u8D44\u6E90\u52A0\u8F7D\u5B8C\u6210: " + path);
              resolve(asset);
            });
          });
          this.loadingPromises.set(path, loadPromise);
          loadPromise.then(asset => {
            callback(null, asset);
          }).catch(err => {
            callback(err, null);
          });
        }
        /**
         * 加载资源目录（带缓存）
         * @param path 资源目录路径（相对于 resources 目录）
         * @param type 资源类型构造函数（如 SpriteFrame, JsonAsset, Prefab 等）
         * @param callback 加载完成回调
         * @param forceReload 是否强制重新加载
         */


        loadDir(path, type, callback, forceReload) {
          if (forceReload === void 0) {
            forceReload = false;
          }

          // 检查缓存
          if (!forceReload && this.resourceCache.has(path)) {
            var cached = this.resourceCache.get(path);
            var _assets = cached.asset; // 检查是否过期

            if (Date.now() - cached.timestamp < this.CACHE_TTL) {
              console.log("\u2705 [ResourceManager] \u4F7F\u7528\u7F13\u5B58\u8D44\u6E90\u76EE\u5F55: " + path + " (" + _assets.length + "\u4E2A)");
              callback(null, _assets);
              return;
            } else {
              // 缓存过期，清除
              this.resourceCache.delete(path);
            }
          } // 检查是否正在加载


          if (this.loadingPromises.has(path)) {
            this.loadingPromises.get(path).then(assets => {
              callback(null, assets);
            }).catch(err => {
              callback(err, null);
            });
            return;
          } // 开始加载


          console.log("\uD83D\uDCE6 [ResourceManager] \u5F00\u59CB\u52A0\u8F7D\u8D44\u6E90\u76EE\u5F55: " + path);
          var loadPromise = new Promise((resolve, reject) => {
            resources.loadDir(path, type, (err, assets) => {
              this.loadingPromises.delete(path);

              if (err) {
                console.error("\u274C [ResourceManager] \u52A0\u8F7D\u8D44\u6E90\u76EE\u5F55\u5931\u8D25: " + path, err);
                reject(err);
                return;
              }

              if (!assets || assets.length === 0) {
                console.warn("\u26A0\uFE0F [ResourceManager] \u8D44\u6E90\u76EE\u5F55\u4E3A\u7A7A: " + path);
                callback(null, []);
                resolve([]);
                return;
              } // 存入缓存


              this.setCache(path, assets);
              console.log("\u2705 [ResourceManager] \u8D44\u6E90\u76EE\u5F55\u52A0\u8F7D\u5B8C\u6210: " + path + " (" + assets.length + "\u4E2A)");
              resolve(assets);
            });
          });
          this.loadingPromises.set(path, loadPromise);
          loadPromise.then(assets => {
            callback(null, assets);
          }).catch(err => {
            callback(err, null);
          });
        }
        /**
         * 带版本号的资源加载（有更新时自动重新加载）
         * @param path 资源路径
         * @param type 资源类型构造函数（如 SpriteFrame, JsonAsset, Prefab 等）
         * @param version 资源版本号（从服务器获取）
         * @param callback 加载完成回调
         */


        loadAssetWithVersion(path, type, version, callback) {
          var cached = this.resourceCache.get(path);
          var cachedVersion = cached == null ? void 0 : cached.version; // 如果版本号相同且缓存未过期，直接使用缓存

          if (cached && cachedVersion === version && Date.now() - cached.timestamp < this.CACHE_TTL) {
            console.log("\u2705 [ResourceManager] \u4F7F\u7528\u7F13\u5B58\u8D44\u6E90\uFF08\u7248\u672C\u5339\u914D\uFF09: " + path + " (v" + version + ")");
            callback(null, cached.asset);
            return;
          } // 版本不同或缓存过期，重新加载


          if (cachedVersion !== version) {
            console.log("\uD83D\uDD04 [ResourceManager] \u8D44\u6E90\u7248\u672C\u66F4\u65B0: " + path + " (v" + cachedVersion + " -> v" + version + ")");
          } // 更新版本信息


          this.resourceVersions.set(path, version); // 强制重新加载

          this.loadAsset(path, type, (err, asset) => {
            if (!err && asset) {
              // 更新缓存版本号
              var cacheEntry = this.resourceCache.get(path);

              if (cacheEntry) {
                cacheEntry.version = version;
              }
            }

            callback(err, asset);
          }, true);
        }
        /**
         * 预加载资源列表（动态陆续加载到缓存中，避免一次性加载造成卡顿）
         * @param assetList 资源列表 [{ path, type }, ...]，type 为资源类型构造函数
         * @param onProgress 进度回调 (progress: number) => void，progress 范围 0-100
         * @param onComplete 完成回调
         * @param concurrentCount 并发加载数量（默认2个，避免卡顿）
         * @param delayMs 每个资源加载完成后的延迟时间（毫秒，默认50ms）
         */


        preloadAssets(assetList, onProgress, onComplete, concurrentCount, delayMs) {
          var _this = this;

          if (concurrentCount === void 0) {
            concurrentCount = this.CONCURRENT_LOAD_COUNT;
          }

          if (delayMs === void 0) {
            delayMs = this.LOAD_DELAY_MS;
          }

          if (assetList.length === 0) {
            if (onComplete) onComplete(0, 0);
            return;
          } // 过滤掉已缓存的资源


          var needLoadList = [];
          var cachedCount = 0;
          assetList.forEach(_ref => {
            var {
              path,
              type
            } = _ref;

            if (this.resourceCache.has(path)) {
              cachedCount++;
            } else {
              needLoadList.push({
                path,
                type
              });
            }
          });
          var total = assetList.length;
          var loadedCount = cachedCount; // 已缓存的也算已加载

          var successCount = cachedCount;
          var failCount = 0;
          var currentIndex = 0; // 当前加载索引

          var loadingCount = 0; // 正在加载的数量

          console.log("\uD83D\uDCE6 [ResourceManager] \u5F00\u59CB\u9646\u7EED\u9884\u52A0\u8F7D " + total + " \u4E2A\u8D44\u6E90\uFF08\u5DF2\u7F13\u5B58 " + cachedCount + " \u4E2A\uFF0C\u9700\u52A0\u8F7D " + needLoadList.length + " \u4E2A\uFF09"); // 如果所有资源都已缓存，直接完成

          if (needLoadList.length === 0) {
            if (onProgress) onProgress(100);
            if (onComplete) onComplete(successCount, failCount);
            return;
          } // 加载完成回调


          var onLoadComplete = (err, asset, path) => {
            loadingCount--;
            loadedCount++;

            if (err || !asset) {
              failCount++;
              console.warn("\u26A0\uFE0F [ResourceManager] \u9884\u52A0\u8F7D\u5931\u8D25: " + path);
            } else {
              successCount++;
            }

            var progress = Math.floor(loadedCount / total * 100);
            if (onProgress) onProgress(progress); // 如果全部加载完成

            if (loadedCount >= total) {
              console.log("\u2705 [ResourceManager] \u9884\u52A0\u8F7D\u5B8C\u6210: \u6210\u529F " + successCount + "/" + total + ", \u5931\u8D25 " + failCount + "/" + total);
              if (onComplete) onComplete(successCount, failCount);
              return;
            } // 延迟后加载下一个资源（给主线程喘息时间）


            setTimeout(() => {
              loadNextAsset();
            }, delayMs);
          }; // 加载下一个资源


          var loadNextAsset = () => {
            var _loop = function _loop() {
              var {
                path,
                type
              } = needLoadList[currentIndex];
              currentIndex++;
              loadingCount++;

              _this.loadAsset(path, type, (err, asset) => {
                onLoadComplete(err, asset, path);
              });
            };

            // 如果还有资源需要加载，且当前并发数未达到上限
            while (currentIndex < needLoadList.length && loadingCount < concurrentCount) {
              _loop();
            }
          }; // 开始陆续加载（启动初始的并发加载）


          for (var i = 0; i < Math.min(concurrentCount, needLoadList.length); i++) {
            loadNextAsset();
          }
        }
        /**
         * 预加载资源目录列表（动态陆续加载，避免一次性加载造成卡顿）
         * @param dirList 目录列表 [{ path, type }, ...]，type 为资源类型构造函数
         * @param onProgress 进度回调
         * @param onComplete 完成回调
         * @param concurrentCount 并发加载数量（默认2个，避免卡顿）
         * @param delayMs 每个目录加载完成后的延迟时间（毫秒，默认50ms）
         */


        preloadDirs(dirList, onProgress, onComplete, concurrentCount, delayMs) {
          var _this2 = this;

          if (concurrentCount === void 0) {
            concurrentCount = this.CONCURRENT_LOAD_COUNT;
          }

          if (delayMs === void 0) {
            delayMs = this.LOAD_DELAY_MS;
          }

          if (dirList.length === 0) {
            if (onComplete) onComplete(0, 0);
            return;
          } // 过滤掉已缓存的目录


          var needLoadList = [];
          var cachedCount = 0;
          dirList.forEach(_ref2 => {
            var {
              path,
              type
            } = _ref2;

            if (this.resourceCache.has(path)) {
              cachedCount++;
            } else {
              needLoadList.push({
                path,
                type
              });
            }
          });
          var total = dirList.length;
          var loadedCount = cachedCount; // 已缓存的也算已加载

          var successCount = cachedCount;
          var failCount = 0;
          var currentIndex = 0; // 当前加载索引

          var loadingCount = 0; // 正在加载的数量

          console.log("\uD83D\uDCE6 [ResourceManager] \u5F00\u59CB\u9646\u7EED\u9884\u52A0\u8F7D " + total + " \u4E2A\u8D44\u6E90\u76EE\u5F55\uFF08\u5DF2\u7F13\u5B58 " + cachedCount + " \u4E2A\uFF0C\u9700\u52A0\u8F7D " + needLoadList.length + " \u4E2A\uFF09"); // 如果所有目录都已缓存，直接完成

          if (needLoadList.length === 0) {
            if (onProgress) onProgress(100);
            if (onComplete) onComplete(successCount, failCount);
            return;
          } // 加载完成回调


          var onLoadComplete = (err, assets, path) => {
            loadingCount--;
            loadedCount++;

            if (err || !assets) {
              failCount++;
              console.warn("\u26A0\uFE0F [ResourceManager] \u9884\u52A0\u8F7D\u76EE\u5F55\u5931\u8D25: " + path);
            } else {
              successCount++;
            }

            var progress = Math.floor(loadedCount / total * 100);
            if (onProgress) onProgress(progress); // 如果全部加载完成

            if (loadedCount >= total) {
              console.log("\u2705 [ResourceManager] \u9884\u52A0\u8F7D\u76EE\u5F55\u5B8C\u6210: \u6210\u529F " + successCount + "/" + total + ", \u5931\u8D25 " + failCount + "/" + total);
              if (onComplete) onComplete(successCount, failCount);
              return;
            } // 延迟后加载下一个目录（给主线程喘息时间）


            setTimeout(() => {
              loadNextDir();
            }, delayMs);
          }; // 加载下一个目录


          var loadNextDir = () => {
            var _loop2 = function _loop2() {
              var {
                path,
                type
              } = needLoadList[currentIndex];
              currentIndex++;
              loadingCount++;

              _this2.loadDir(path, type, (err, assets) => {
                onLoadComplete(err, assets, path);
              });
            };

            // 如果还有目录需要加载，且当前并发数未达到上限
            while (currentIndex < needLoadList.length && loadingCount < concurrentCount) {
              _loop2();
            }
          }; // 开始陆续加载（启动初始的并发加载）


          for (var i = 0; i < Math.min(concurrentCount, needLoadList.length); i++) {
            loadNextDir();
          }
        }
        /**
         * 设置资源版本号（从服务器获取）
         * @param path 资源路径
         * @param version 版本号
         */


        setResourceVersion(path, version) {
          this.resourceVersions.set(path, version);
        }
        /**
         * 获取资源版本号
         * @param path 资源路径
         * @returns 版本号，如果不存在返回 undefined
         */


        getResourceVersion(path) {
          return this.resourceVersions.get(path);
        }
        /**
         * 检查资源是否需要更新（比较版本号）
         * @param path 资源路径
         * @param serverVersion 服务器版本号
         * @returns true 表示需要更新
         */


        needsUpdate(path, serverVersion) {
          var cachedVersion = this.resourceVersions.get(path);
          return cachedVersion === undefined || cachedVersion !== serverVersion;
        }
        /**
         * 获取缓存的资源（不触发加载）
         * @param path 资源路径
         * @returns 缓存的资源，如果不存在或已过期返回 null
         */


        getCachedAsset(path) {
          var cached = this.resourceCache.get(path);

          if (!cached) {
            return null;
          } // 检查是否过期


          if (Date.now() - cached.timestamp > this.CACHE_TTL) {
            this.resourceCache.delete(path);
            return null;
          }

          return cached.asset;
        }
        /**
         * 清除指定资源的缓存
         * @param path 资源路径，如果不提供则清除所有缓存
         */


        clearCache(path) {
          if (path) {
            this.resourceCache.delete(path);
            this.resourceVersions.delete(path);
            console.log("\uD83D\uDDD1\uFE0F [ResourceManager] \u5DF2\u6E05\u9664\u7F13\u5B58: " + path);
          } else {
            this.resourceCache.clear();
            this.resourceVersions.clear();
            console.log("\uD83D\uDDD1\uFE0F [ResourceManager] \u5DF2\u6E05\u9664\u6240\u6709\u7F13\u5B58");
          }
        }
        /**
         * 释放资源（从内存中移除并减少引用计数）
         * @param path 资源路径
         */


        releaseAsset(path) {
          var cached = this.resourceCache.get(path);

          if (cached) {
            var _assets2 = Array.isArray(cached.asset) ? cached.asset : [cached.asset];

            _assets2.forEach(asset => {
              if (asset && asset.decRef) {
                asset.decRef();
              }
            });

            this.resourceCache.delete(path);
            console.log("\uD83D\uDDD1\uFE0F [ResourceManager] \u5DF2\u91CA\u653E\u8D44\u6E90: " + path);
          }
        }
        /**
         * 获取缓存统计信息
         */


        getCacheStats() {
          var entries = [];
          var now = Date.now();
          this.resourceCache.forEach((value, path) => {
            entries.push({
              path,
              version: value.version,
              age: now - value.timestamp
            });
          });
          return {
            cacheSize: this.resourceCache.size,
            totalVersions: this.resourceVersions.size,
            cacheEntries: entries
          };
        }
        /**
         * 清理过期缓存
         */


        cleanExpiredCache() {
          var now = Date.now();
          var cleanedCount = 0;
          this.resourceCache.forEach((value, path) => {
            if (now - value.timestamp > this.CACHE_TTL) {
              this.resourceCache.delete(path);
              this.resourceVersions.delete(path);
              cleanedCount++;
            }
          });

          if (cleanedCount > 0) {
            console.log("\uD83E\uDDF9 [ResourceManager] \u5DF2\u6E05\u7406 " + cleanedCount + " \u4E2A\u8FC7\u671F\u7F13\u5B58");
          }
        }
        /**
         * 限制缓存大小（LRU策略）
         */


        limitCacheSize() {
          if (this.resourceCache.size <= this.MAX_CACHE_SIZE) {
            return;
          } // 按时间戳排序，删除最旧的缓存


          var entries = Array.from(this.resourceCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
          var toRemove = entries.slice(0, this.resourceCache.size - this.MAX_CACHE_SIZE);
          toRemove.forEach(_ref3 => {
            var [path] = _ref3;
            this.resourceCache.delete(path);
            this.resourceVersions.delete(path);
          });
          console.log("\uD83E\uDDF9 [ResourceManager] \u5DF2\u6E05\u7406 " + toRemove.length + " \u4E2A\u65E7\u7F13\u5B58\uFF08LRU\u7B56\u7565\uFF09");
        }
        /**
         * 设置缓存
         */


        setCache(path, asset) {
          var cached = this.resourceCache.get(path);
          var version = this.resourceVersions.get(path); // 增加引用计数

          var assets = Array.isArray(asset) ? asset : [asset];
          assets.forEach(a => {
            if (a && a.addRef) {
              a.addRef();
            }
          });
          this.resourceCache.set(path, {
            asset,
            version,
            timestamp: Date.now()
          }); // 限制缓存大小

          this.limitCacheSize();
        }
        /**
         * 预加载游戏核心资源（统一入口，方便管理）
         * 包括：JSON配表、图集、常用资源等
         * @param onProgress 进度回调
         * @param onComplete 完成回调
         */


        preloadGameCoreResources(onProgress, onComplete) {
          console.log('📦 [ResourceManager] 开始预加载游戏核心资源...'); // 定义需要预加载的核心资源

          var coreJsonAssets = [{
            path: 'json/equip_position',
            type: JsonAsset
          }, {
            path: 'json/Weapon',
            type: JsonAsset
          }, {
            path: 'json/Gun',
            type: JsonAsset
          }, {
            path: 'json/Dun',
            type: JsonAsset
          }, {
            path: 'json/Wing',
            type: JsonAsset
          }, {
            path: 'json/Items',
            type: JsonAsset
          }, {
            path: 'json/Armor',
            type: JsonAsset
          }];
          var coreSpriteDirs = [{
            path: 'Weapon/Weapon',
            type: SpriteFrame
          }, {
            path: 'Weapon/Gun',
            type: SpriteFrame
          }, {
            path: 'Weapon/Dun',
            type: SpriteFrame
          }, {
            path: 'Weapon/Wing',
            type: SpriteFrame
          }];
          var totalCount = coreJsonAssets.length + coreSpriteDirs.length;
          var completedCount = 0;
          var successCount = 0;
          var failCount = 0; // 合并进度回调

          var onItemComplete = success => {
            completedCount++;

            if (success) {
              successCount++;
            } else {
              failCount++;
            }

            var progress = Math.floor(completedCount / totalCount * 100);

            if (onProgress) {
              onProgress(progress);
            }

            if (completedCount >= totalCount && onComplete) {
              console.log("\u2705 [ResourceManager] \u6E38\u620F\u6838\u5FC3\u8D44\u6E90\u9884\u52A0\u8F7D\u5B8C\u6210: \u6210\u529F " + successCount + "/" + totalCount + ", \u5931\u8D25 " + failCount + "/" + totalCount);
              onComplete(successCount, failCount);
            }
          }; // 先预加载 JSON 配表（较小，优先加载）


          this.preloadAssets(coreJsonAssets, progress => {
            // JSON 配表占总进度的 50%
            var totalProgress = Math.floor(progress * coreJsonAssets.length / totalCount);
            if (onProgress) onProgress(totalProgress);
          }, (jsonSuccess, jsonFail) => {
            successCount += jsonSuccess;
            failCount += jsonFail;
            completedCount += coreJsonAssets.length; // JSON 配表加载完成后，开始加载图集

            this.preloadDirs(coreSpriteDirs, progress => {
              // 图集占总进度的 50%，加上已完成的 JSON 配表进度
              var jsonProgress = Math.floor(coreJsonAssets.length * 100 / totalCount);
              var spriteProgress = Math.floor(progress * coreSpriteDirs.length / totalCount);
              if (onProgress) onProgress(jsonProgress + spriteProgress);
            }, (spriteSuccess, spriteFail) => {
              successCount += spriteSuccess;
              failCount += spriteFail;
              completedCount += coreSpriteDirs.length;

              if (onComplete) {
                var totalProgress = 100;
                if (onProgress) onProgress(totalProgress);
                console.log("\u2705 [ResourceManager] \u6E38\u620F\u6838\u5FC3\u8D44\u6E90\u9884\u52A0\u8F7D\u5B8C\u6210: \u6210\u529F " + successCount + "/" + totalCount + ", \u5931\u8D25 " + failCount + "/" + totalCount);
                onComplete(successCount, failCount);
              }
            }, 1, // 图集较大，每次只加载1个
            100 // 图集加载延迟100ms
            );
          }, 2, // JSON 配表每次加载2个
          50 // JSON 配表加载延迟50ms
          );
        }

      }, _class2.instance = null, _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=4d22c0d19ce89b4af2709bc9ad74c290c44f117c.js.map