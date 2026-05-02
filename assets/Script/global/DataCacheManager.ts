import { _decorator } from 'cc';

const { ccclass } = _decorator;

/**
 * 数据缓存管理器
 * 用于在登录/选择角色成功后预加载数据，面板打开时先显示缓存再更新最新数据
 * MMO最佳实践：预加载 + 缓存 + 实时更新
 */
@ccclass('DataCacheManager')
export class DataCacheManager {
    private static instance: DataCacheManager | null = null;

    // 背包数据缓存
    private bagCache: {
        characterId: string;
        data: any;
        timestamp: number;
    } | null = null;

    // 机甲列表数据缓存
    private robotPetsCache: {
        characterId: string;
        data: any;
        timestamp: number;
    } | null = null;

    // 机甲详情数据缓存（按pet_id索引）
    private robotPetInfoCache: Map<string, {
        data: any;
        timestamp: number;
    }> = new Map();

    // 缓存过期时间（毫秒），默认5分钟
    private readonly CACHE_TTL = 5 * 60 * 1000;

    public static getInstance(): DataCacheManager {
        if (!DataCacheManager.instance) {
            DataCacheManager.instance = new DataCacheManager();
        }
        return DataCacheManager.instance;
    }

    /**
     * 设置背包数据缓存
     */
    public setBagCache(characterId: string, data: any): void {
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
    public getBagCache(characterId: string): any | null {
        if (!this.bagCache || this.bagCache.characterId !== characterId) {
            return null;
        }
        
        // 检查是否过期
        if (Date.now() - this.bagCache.timestamp > this.CACHE_TTL) {
            this.bagCache = null;
            return null;
        }

        return this.bagCache.data;
    }

    /**
     * 清除背包数据缓存
     */
    public clearBagCache(characterId?: string): void {
        if (!characterId || !this.bagCache || this.bagCache.characterId === characterId) {
            this.bagCache = null;
            console.log(`🗑️ [DataCacheManager] 已清除背包数据缓存`);
        }
    }

    /**
     * 设置机甲列表数据缓存
     */
    public setRobotPetsCache(characterId: string, data: any): void {
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
    public getRobotPetsCache(characterId: string): any | null {
        if (!this.robotPetsCache || this.robotPetsCache.characterId !== characterId) {
            return null;
        }
        
        // 检查是否过期
        if (Date.now() - this.robotPetsCache.timestamp > this.CACHE_TTL) {
            this.robotPetsCache = null;
            return null;
        }

        return this.robotPetsCache.data;
    }

    /**
     * 清除机甲列表数据缓存
     */
    public clearRobotPetsCache(characterId?: string): void {
        if (!characterId || !this.robotPetsCache || this.robotPetsCache.characterId === characterId) {
            this.robotPetsCache = null;
            console.log(`🗑️ [DataCacheManager] 已清除机甲列表数据缓存`);
        }
    }

    /**
     * 设置机甲详情数据缓存
     */
    public setRobotPetInfoCache(petId: string, data: any): void {
        this.robotPetInfoCache.set(petId, {
            data,
            timestamp: Date.now()
        });
        console.log(`💾 [DataCacheManager] 已缓存机甲详情数据 (pet_id: ${petId})`);
    }

    /**
     * 获取机甲详情数据缓存
     */
    public getRobotPetInfoCache(petId: string): any | null {
        const cache = this.robotPetInfoCache.get(petId);
        if (!cache) {
            return null;
        }
        
        // 检查是否过期
        if (Date.now() - cache.timestamp > this.CACHE_TTL) {
            this.robotPetInfoCache.delete(petId);
            return null;
        }

        return cache.data;
    }

    /**
     * 清除机甲详情数据缓存
     */
    public clearRobotPetInfoCache(petId?: string): void {
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
    public clearAllCache(): void {
        this.bagCache = null;
        this.robotPetsCache = null;
        this.robotPetInfoCache.clear();
        console.log(`🗑️ [DataCacheManager] 已清除所有缓存`);
    }

    /**
     * 清除指定角色的所有缓存
     */
    public clearCharacterCache(characterId: string): void {
        this.clearBagCache(characterId);
        this.clearRobotPetsCache(characterId);
        // 机甲详情缓存无法按characterId清除，因为key是petId
        // 可以选择清除所有，或者在需要时按需清除
        console.log(`🗑️ [DataCacheManager] 已清除角色缓存 (character_id: ${characterId})`);
    }
}
