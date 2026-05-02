import { _decorator, resources, Asset, SpriteFrame, JsonAsset, Prefab, Texture2D, AudioClip, assetManager, Constructor } from 'cc';

const { ccclass } = _decorator;

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
@ccclass('ResourceManager')
export class ResourceManager {
    private static instance: ResourceManager | null = null;

    // 资源缓存：path -> { asset, version, timestamp }
    private resourceCache: Map<string, {
        asset: Asset | Asset[];
        version?: number;
        timestamp: number;
    }> = new Map();

    // 正在加载的资源：path -> Promise
    private loadingPromises: Map<string, Promise<any>> = new Map();

    // 资源版本信息：path -> version（可以从服务器获取）
    private resourceVersions: Map<string, number> = new Map();

    // 缓存过期时间（毫秒），默认30分钟
    private readonly CACHE_TTL = 30 * 60 * 1000;

    // 最大缓存数量（防止内存溢出）
    private readonly MAX_CACHE_SIZE = 1000;

    // 陆续加载配置：每次并发加载的资源数量（避免一次性加载造成卡顿）
    private readonly CONCURRENT_LOAD_COUNT = 2;
    
    // 陆续加载配置：每个资源加载完成后的延迟时间（毫秒），给主线程喘息时间
    private readonly LOAD_DELAY_MS = 50;

    /**
     * 获取单例实例
     */
    public static getInstance(): ResourceManager {
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
    public loadAsset<T extends Asset>(
        path: string,
        type: Constructor<T>,
        callback: (err: Error | null, asset: T | null) => void,
        forceReload: boolean = false
    ): void {
        // 检查缓存
        if (!forceReload && this.resourceCache.has(path)) {
            const cached = this.resourceCache.get(path)!;
            const asset = cached.asset as T;
            
            // 检查是否过期
            if (Date.now() - cached.timestamp < this.CACHE_TTL) {
                console.log(`✅ [ResourceManager] 使用缓存资源: ${path}`);
                callback(null, asset);
                return;
            } else {
                // 缓存过期，清除
                this.resourceCache.delete(path);
            }
        }

        // 检查是否正在加载
        if (this.loadingPromises.has(path)) {
            this.loadingPromises.get(path)!.then((asset: T) => {
                callback(null, asset);
            }).catch((err: Error) => {
                callback(err, null);
            });
            return;
        }

        // 开始加载
        console.log(`📦 [ResourceManager] 开始加载资源: ${path}`);
        const loadPromise = new Promise<T>((resolve, reject) => {
            resources.load(path, type, (err: Error | null, asset: T | null) => {
                this.loadingPromises.delete(path);
                
                if (err) {
                    console.error(`❌ [ResourceManager] 加载资源失败: ${path}`, err);
                    reject(err);
                    return;
                }

                if (!asset) {
                    const error = new Error(`资源加载返回为空: ${path}`);
                    console.error(`❌ [ResourceManager]`, error);
                    reject(error);
                    return;
                }

                // 存入缓存
                this.setCache(path, asset);
                console.log(`✅ [ResourceManager] 资源加载完成: ${path}`);
                resolve(asset);
            });
        });

        this.loadingPromises.set(path, loadPromise);
        loadPromise.then((asset: T) => {
            callback(null, asset);
        }).catch((err: Error) => {
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
    public loadDir<T extends Asset>(
        path: string,
        type: Constructor<T>,
        callback: (err: Error | null, assets: T[] | null) => void,
        forceReload: boolean = false
    ): void {
        // 检查缓存
        if (!forceReload && this.resourceCache.has(path)) {
            const cached = this.resourceCache.get(path)!;
            const assets = cached.asset as T[];
            
            // 检查是否过期
            if (Date.now() - cached.timestamp < this.CACHE_TTL) {
                console.log(`✅ [ResourceManager] 使用缓存资源目录: ${path} (${assets.length}个)`);
                callback(null, assets);
                return;
            } else {
                // 缓存过期，清除
                this.resourceCache.delete(path);
            }
        }

        // 检查是否正在加载
        if (this.loadingPromises.has(path)) {
            this.loadingPromises.get(path)!.then((assets: T[]) => {
                callback(null, assets);
            }).catch((err: Error) => {
                callback(err, null);
            });
            return;
        }

        // 开始加载
        console.log(`📦 [ResourceManager] 开始加载资源目录: ${path}`);
        const loadPromise = new Promise<T[]>((resolve, reject) => {
            resources.loadDir(path, type, (err: Error | null, assets: T[] | null) => {
                this.loadingPromises.delete(path);
                
                if (err) {
                    console.error(`❌ [ResourceManager] 加载资源目录失败: ${path}`, err);
                    reject(err);
                    return;
                }

                if (!assets || assets.length === 0) {
                    console.warn(`⚠️ [ResourceManager] 资源目录为空: ${path}`);
                    callback(null, []);
                    resolve([]);
                    return;
                }

                // 存入缓存
                this.setCache(path, assets);
                console.log(`✅ [ResourceManager] 资源目录加载完成: ${path} (${assets.length}个)`);
                resolve(assets);
            });
        });

        this.loadingPromises.set(path, loadPromise);
        loadPromise.then((assets: T[]) => {
            callback(null, assets);
        }).catch((err: Error) => {
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
    public loadAssetWithVersion<T extends Asset>(
        path: string,
        type: Constructor<T>,
        version: number,
        callback: (err: Error | null, asset: T | null) => void
    ): void {
        const cached = this.resourceCache.get(path);
        const cachedVersion = cached?.version;

        // 如果版本号相同且缓存未过期，直接使用缓存
        if (cached && cachedVersion === version && Date.now() - cached.timestamp < this.CACHE_TTL) {
            console.log(`✅ [ResourceManager] 使用缓存资源（版本匹配）: ${path} (v${version})`);
            callback(null, cached.asset as T);
            return;
        }

        // 版本不同或缓存过期，重新加载
        if (cachedVersion !== version) {
            console.log(`🔄 [ResourceManager] 资源版本更新: ${path} (v${cachedVersion} -> v${version})`);
        }

        // 更新版本信息
        this.resourceVersions.set(path, version);

        // 强制重新加载
        this.loadAsset(path, type, (err, asset) => {
            if (!err && asset) {
                // 更新缓存版本号
                const cacheEntry = this.resourceCache.get(path);
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
    public preloadAssets<T extends Asset>(
        assetList: Array<{ path: string; type: Constructor<T> }>,
        onProgress?: (progress: number) => void,
        onComplete?: (successCount: number, failCount: number) => void,
        concurrentCount: number = this.CONCURRENT_LOAD_COUNT,
        delayMs: number = this.LOAD_DELAY_MS
    ): void {
        if (assetList.length === 0) {
            if (onComplete) onComplete(0, 0);
            return;
        }

        // 过滤掉已缓存的资源
        const needLoadList: Array<{ path: string; type: Constructor<T> }> = [];
        let cachedCount = 0;

        assetList.forEach(({ path, type }) => {
            if (this.resourceCache.has(path)) {
                cachedCount++;
            } else {
                needLoadList.push({ path, type });
            }
        });

        const total = assetList.length;
        let loadedCount = cachedCount; // 已缓存的也算已加载
        let successCount = cachedCount;
        let failCount = 0;
        let currentIndex = 0; // 当前加载索引
        let loadingCount = 0; // 正在加载的数量

        console.log(`📦 [ResourceManager] 开始陆续预加载 ${total} 个资源（已缓存 ${cachedCount} 个，需加载 ${needLoadList.length} 个）`);

        // 如果所有资源都已缓存，直接完成
        if (needLoadList.length === 0) {
            if (onProgress) onProgress(100);
            if (onComplete) onComplete(successCount, failCount);
            return;
        }

        // 加载完成回调
        const onLoadComplete = (err: Error | null, asset: T | null, path: string) => {
            loadingCount--;
            loadedCount++;
            
            if (err || !asset) {
                failCount++;
                console.warn(`⚠️ [ResourceManager] 预加载失败: ${path}`);
            } else {
                successCount++;
            }

            const progress = Math.floor((loadedCount / total) * 100);
            if (onProgress) onProgress(progress);

            // 如果全部加载完成
            if (loadedCount >= total) {
                console.log(`✅ [ResourceManager] 预加载完成: 成功 ${successCount}/${total}, 失败 ${failCount}/${total}`);
                if (onComplete) onComplete(successCount, failCount);
                return;
            }

            // 延迟后加载下一个资源（给主线程喘息时间）
            setTimeout(() => {
                loadNextAsset();
            }, delayMs);
        };

        // 加载下一个资源
        const loadNextAsset = () => {
            // 如果还有资源需要加载，且当前并发数未达到上限
            while (currentIndex < needLoadList.length && loadingCount < concurrentCount) {
                const { path, type } = needLoadList[currentIndex];
                currentIndex++;
                loadingCount++;

                this.loadAsset(path, type, (err, asset) => {
                    onLoadComplete(err, asset, path);
                });
            }
        };

        // 开始陆续加载（启动初始的并发加载）
        for (let i = 0; i < Math.min(concurrentCount, needLoadList.length); i++) {
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
    public preloadDirs<T extends Asset>(
        dirList: Array<{ path: string; type: Constructor<T> }>,
        onProgress?: (progress: number) => void,
        onComplete?: (successCount: number, failCount: number) => void,
        concurrentCount: number = this.CONCURRENT_LOAD_COUNT,
        delayMs: number = this.LOAD_DELAY_MS
    ): void {
        if (dirList.length === 0) {
            if (onComplete) onComplete(0, 0);
            return;
        }

        // 过滤掉已缓存的目录
        const needLoadList: Array<{ path: string; type: Constructor<T> }> = [];
        let cachedCount = 0;

        dirList.forEach(({ path, type }) => {
            if (this.resourceCache.has(path)) {
                cachedCount++;
            } else {
                needLoadList.push({ path, type });
            }
        });

        const total = dirList.length;
        let loadedCount = cachedCount; // 已缓存的也算已加载
        let successCount = cachedCount;
        let failCount = 0;
        let currentIndex = 0; // 当前加载索引
        let loadingCount = 0; // 正在加载的数量

        console.log(`📦 [ResourceManager] 开始陆续预加载 ${total} 个资源目录（已缓存 ${cachedCount} 个，需加载 ${needLoadList.length} 个）`);

        // 如果所有目录都已缓存，直接完成
        if (needLoadList.length === 0) {
            if (onProgress) onProgress(100);
            if (onComplete) onComplete(successCount, failCount);
            return;
        }

        // 加载完成回调
        const onLoadComplete = (err: Error | null, assets: T[] | null, path: string) => {
            loadingCount--;
            loadedCount++;
            
            if (err || !assets) {
                failCount++;
                console.warn(`⚠️ [ResourceManager] 预加载目录失败: ${path}`);
            } else {
                successCount++;
            }

            const progress = Math.floor((loadedCount / total) * 100);
            if (onProgress) onProgress(progress);

            // 如果全部加载完成
            if (loadedCount >= total) {
                console.log(`✅ [ResourceManager] 预加载目录完成: 成功 ${successCount}/${total}, 失败 ${failCount}/${total}`);
                if (onComplete) onComplete(successCount, failCount);
                return;
            }

            // 延迟后加载下一个目录（给主线程喘息时间）
            setTimeout(() => {
                loadNextDir();
            }, delayMs);
        };

        // 加载下一个目录
        const loadNextDir = () => {
            // 如果还有目录需要加载，且当前并发数未达到上限
            while (currentIndex < needLoadList.length && loadingCount < concurrentCount) {
                const { path, type } = needLoadList[currentIndex];
                currentIndex++;
                loadingCount++;

                this.loadDir(path, type, (err, assets) => {
                    onLoadComplete(err, assets, path);
                });
            }
        };

        // 开始陆续加载（启动初始的并发加载）
        for (let i = 0; i < Math.min(concurrentCount, needLoadList.length); i++) {
            loadNextDir();
        }
    }

    /**
     * 设置资源版本号（从服务器获取）
     * @param path 资源路径
     * @param version 版本号
     */
    public setResourceVersion(path: string, version: number): void {
        this.resourceVersions.set(path, version);
    }

    /**
     * 获取资源版本号
     * @param path 资源路径
     * @returns 版本号，如果不存在返回 undefined
     */
    public getResourceVersion(path: string): number | undefined {
        return this.resourceVersions.get(path);
    }

    /**
     * 检查资源是否需要更新（比较版本号）
     * @param path 资源路径
     * @param serverVersion 服务器版本号
     * @returns true 表示需要更新
     */
    public needsUpdate(path: string, serverVersion: number): boolean {
        const cachedVersion = this.resourceVersions.get(path);
        return cachedVersion === undefined || cachedVersion !== serverVersion;
    }

    /**
     * 获取缓存的资源（不触发加载）
     * @param path 资源路径
     * @returns 缓存的资源，如果不存在或已过期返回 null
     */
    public getCachedAsset<T extends Asset>(path: string): T | T[] | null {
        const cached = this.resourceCache.get(path);
        if (!cached) {
            return null;
        }

        // 检查是否过期
        if (Date.now() - cached.timestamp > this.CACHE_TTL) {
            this.resourceCache.delete(path);
            return null;
        }

        return cached.asset as T | T[];
    }

    /**
     * 清除指定资源的缓存
     * @param path 资源路径，如果不提供则清除所有缓存
     */
    public clearCache(path?: string): void {
        if (path) {
            this.resourceCache.delete(path);
            this.resourceVersions.delete(path);
            console.log(`🗑️ [ResourceManager] 已清除缓存: ${path}`);
        } else {
            this.resourceCache.clear();
            this.resourceVersions.clear();
            console.log(`🗑️ [ResourceManager] 已清除所有缓存`);
        }
    }

    /**
     * 释放资源（从内存中移除并减少引用计数）
     * @param path 资源路径
     */
    public releaseAsset(path: string): void {
        const cached = this.resourceCache.get(path);
        if (cached) {
            const assets = Array.isArray(cached.asset) ? cached.asset : [cached.asset];
            assets.forEach(asset => {
                if (asset && asset.decRef) {
                    asset.decRef();
                }
            });
            this.resourceCache.delete(path);
            console.log(`🗑️ [ResourceManager] 已释放资源: ${path}`);
        }
    }

    /**
     * 获取缓存统计信息
     */
    public getCacheStats(): {
        cacheSize: number;
        totalVersions: number;
        cacheEntries: Array<{ path: string; version?: number; age: number }>;
    } {
        const entries: Array<{ path: string; version?: number; age: number }> = [];
        const now = Date.now();

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
    public cleanExpiredCache(): void {
        const now = Date.now();
        let cleanedCount = 0;

        this.resourceCache.forEach((value, path) => {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.resourceCache.delete(path);
                this.resourceVersions.delete(path);
                cleanedCount++;
            }
        });

        if (cleanedCount > 0) {
            console.log(`🧹 [ResourceManager] 已清理 ${cleanedCount} 个过期缓存`);
        }
    }

    /**
     * 限制缓存大小（LRU策略）
     */
    private limitCacheSize(): void {
        if (this.resourceCache.size <= this.MAX_CACHE_SIZE) {
            return;
        }

        // 按时间戳排序，删除最旧的缓存
        const entries = Array.from(this.resourceCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);

        const toRemove = entries.slice(0, this.resourceCache.size - this.MAX_CACHE_SIZE);
        toRemove.forEach(([path]) => {
            this.resourceCache.delete(path);
            this.resourceVersions.delete(path);
        });

        console.log(`🧹 [ResourceManager] 已清理 ${toRemove.length} 个旧缓存（LRU策略）`);
    }

    /**
     * 设置缓存
     */
    private setCache(path: string, asset: Asset | Asset[]): void {
        const cached = this.resourceCache.get(path);
        const version = this.resourceVersions.get(path);

        // 增加引用计数
        const assets = Array.isArray(asset) ? asset : [asset];
        assets.forEach(a => {
            if (a && a.addRef) {
                a.addRef();
            }
        });

        this.resourceCache.set(path, {
            asset,
            version,
            timestamp: Date.now()
        });

        // 限制缓存大小
        this.limitCacheSize();
    }

    /**
     * 预加载游戏核心资源（统一入口，方便管理）
     * 包括：JSON配表、图集、常用资源等
     * @param onProgress 进度回调
     * @param onComplete 完成回调
     */
    public preloadGameCoreResources(
        onProgress?: (progress: number) => void,
        onComplete?: (successCount: number, failCount: number) => void
    ): void {
        console.log('📦 [ResourceManager] 开始预加载游戏核心资源...');

        // 定义需要预加载的核心资源
        const coreJsonAssets = [
            { path: 'json/equip_position', type: JsonAsset },
            { path: 'json/Weapon', type: JsonAsset },
            { path: 'json/Gun', type: JsonAsset },
            { path: 'json/Dun', type: JsonAsset },
            { path: 'json/Wing', type: JsonAsset },
            { path: 'json/Items', type: JsonAsset },
            { path: 'json/Armor', type: JsonAsset },
        ];

        const coreSpriteDirs = [
            { path: 'Weapon/Weapon', type: SpriteFrame },
            { path: 'Weapon/Gun', type: SpriteFrame },
            { path: 'Weapon/Dun', type: SpriteFrame },
            { path: 'Weapon/Wing', type: SpriteFrame },
        ];

        const totalCount = coreJsonAssets.length + coreSpriteDirs.length;
        let completedCount = 0;
        let successCount = 0;
        let failCount = 0;

        // 合并进度回调
        const onItemComplete = (success: boolean) => {
            completedCount++;
            if (success) {
                successCount++;
            } else {
                failCount++;
            }

            const progress = Math.floor((completedCount / totalCount) * 100);
            if (onProgress) {
                onProgress(progress);
            }

            if (completedCount >= totalCount && onComplete) {
                console.log(`✅ [ResourceManager] 游戏核心资源预加载完成: 成功 ${successCount}/${totalCount}, 失败 ${failCount}/${totalCount}`);
                onComplete(successCount, failCount);
            }
        };

        // 先预加载 JSON 配表（较小，优先加载）
        this.preloadAssets(coreJsonAssets, 
            (progress) => {
                // JSON 配表占总进度的 50%
                const totalProgress = Math.floor((progress * coreJsonAssets.length) / totalCount);
                if (onProgress) onProgress(totalProgress);
            },
            (jsonSuccess, jsonFail) => {
                successCount += jsonSuccess;
                failCount += jsonFail;
                completedCount += coreJsonAssets.length;
                
                // JSON 配表加载完成后，开始加载图集
                this.preloadDirs(coreSpriteDirs,
                    (progress) => {
                        // 图集占总进度的 50%，加上已完成的 JSON 配表进度
                        const jsonProgress = Math.floor((coreJsonAssets.length * 100) / totalCount);
                        const spriteProgress = Math.floor((progress * coreSpriteDirs.length) / totalCount);
                        if (onProgress) onProgress(jsonProgress + spriteProgress);
                    },
                    (spriteSuccess, spriteFail) => {
                        successCount += spriteSuccess;
                        failCount += spriteFail;
                        completedCount += coreSpriteDirs.length;
                        
                        if (onComplete) {
                            const totalProgress = 100;
                            if (onProgress) onProgress(totalProgress);
                            console.log(`✅ [ResourceManager] 游戏核心资源预加载完成: 成功 ${successCount}/${totalCount}, 失败 ${failCount}/${totalCount}`);
                            onComplete(successCount, failCount);
                        }
                    },
                    1, // 图集较大，每次只加载1个
                    100 // 图集加载延迟100ms
                );
            },
            2, // JSON 配表每次加载2个
            50 // JSON 配表加载延迟50ms
        );
    }
}
