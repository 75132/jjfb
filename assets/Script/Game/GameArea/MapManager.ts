import {
    _decorator,
    assetManager,
    Component,
    director,
    js,
    JsonAsset,
    Node,
    resources,
    TiledMap,
    TiledMapAsset,
    UITransform,
} from 'cc';
import { Logger } from '../../global/Logger';
import { PlayerGridMove } from './PlayerGridMove';
import { SpriteLayerMap } from './SpriteLayerMap';

/** 运行时通过 js.getClassByName 取类，避免 require / 循环依赖（Cocos Preview 不支持 CommonJS require） */
type WorldOnlineLike = {
    mapId: number;
    enableOnline: boolean;
    localPlayerMove: PlayerGridMove | null;
    leaveCurrentMap: () => void;
    enterCurrentMap: () => Promise<boolean>;
};

type StoryBinder = {
    mapConfig: JsonAsset | null;
    bindMap: (mapId: number, mapConfig: JsonAsset | null) => void;
};

type PlayerStateLike = {
    mapId: number;
    enabled: boolean;
};

const { ccclass, property, executionOrder } = _decorator;

const CHUNK_NAME_RE = /^(\d+)-(\d+)$/;
/** 分层 Sprite 地图节点名：M1 / M2 …（与 assets/Map/M1 对齐） */
const SPRITE_MAP_NAME_RE = /^M(\d+)$/i;
const MAP2_STORY_PATH = 'Sample/剧情脚本/map_2';

/** 每图默认出生点（逻辑像素，与服务端 _MAP_DEFAULT_SPAWNS 对齐） */
const DEFAULT_SPAWNS: Record<number, { x: number; y: number }> = {
    1: { x: 120, y: -24 },
    // map2 第8行第2格（玩家像素：col1/row7 → 72,-360）
    2: { x: 72, y: -360 },
};

/**
 * 场景未挂的拼块：运行时按 UUID 补建（map2 资源已进工程但 Game.scene 尚未拖入）。
 * 坐标：锚点左上，向下拼接；2-1=15行(720)、2-2=20行。
 */
const RUNTIME_CHUNK_DEFS: Record<number, Array<{ name: string; uuid: string; x: number; y: number }>> = {
    2: [
        { name: '2-1', uuid: '462d6834-6283-406b-8109-617167dd45b5', x: 0, y: 0 },
        { name: '2-2', uuid: '010c55ba-0b41-42d1-8bdd-f20a614f2bf8', x: 0, y: -720 },
    ],
};

function findCompByClassName<T>(className: string): T | null {
    const Cls = js.getClassByName(className);
    if (!Cls) return null;
    const scene = director.getScene();
    if (!scene) return null;
    return (scene.getComponentInChildren(Cls as typeof Component) as unknown as T) ?? null;
}

function findCompsByClassName<T>(className: string): T[] {
    const Cls = js.getClassByName(className);
    if (!Cls) return [];
    const scene = director.getScene();
    if (!scene) return [];
    return scene.getComponentsInChildren(Cls as typeof Component) as unknown as T[];
}

/**
 * 多图管理：
 * - TMX 拼块：子节点名 `mapId-chunkIndex`（如 1-1、2-2）
 * - Sprite 分层图：子节点名 `M{mapId}`（如 M1），B/E 不可通行由 SpriteLayerMap + walk flags 判定
 * 切图时更新 mapRoot 尺寸、同屏 mapId、玩家落点与剧情绑定。
 *
 * executionOrder 提前：须在子节点 TiledMap.__preload 填 UV 之前打开 texel offset，
 * 否则 map2 等邻色对比强的图集容易出现格缝（Cocos 3.8.5+ 已去掉自动内缩）。
 */
@ccclass('MapManager')
@executionOrder(-1000)
export class MapManager extends Component {
    @property({ type: Node, tooltip: '地图根（含拼接块的 TiledMap）。留空则用本节点' })
    mapRoot: Node | null = null;

    @property({ tooltip: '启动时激活的 mapId' })
    defaultMapId = 1;

    @property({ type: JsonAsset, tooltip: 'mapId=1 剧情 JSON；留空则沿用 StoryManager 场景上已绑的 mapConfig' })
    map1StoryConfig: JsonAsset | null = null;

    @property({ type: JsonAsset, tooltip: 'mapId=2 剧情 JSON；暂无则留空（切到图2会隐藏旧图 NPC）' })
    map2StoryConfig: JsonAsset | null = null;

    @property({ tooltip: '本组件负责 world_enter，WorldOnlineSync 收到 player_info 时勿重复进房' })
    ownsWorldEnter = true;

    /** Cocos 3.8.6+：瓦片 UV 内缩 0.5px，抑制格缝（全局开关，须在 TiledMap 应用资源前打开） */
    @property({ tooltip: '启用 TiledMap texel offset，修复格缝（推荐保持开启）' })
    enableTileTexelOffset = true;

    private _chunksByMap = new Map<number, Node[]>();
    /** Sprite 分层图：每 mapId 至多一块（节点名 M{id}） */
    private _spriteByMap = new Map<number, Node>();
    private _activeMapId = 0;
    private _switching = false;
    private _storyMap1Captured: JsonAsset | null = null;
    private _map2StoryLoaded: JsonAsset | null = null;
    private _map2StoryLoading: Promise<JsonAsset | null> | null = null;
    private _chunkEnsureTasks = new Map<number, Promise<boolean>>();
    private _inited = false;
    private _texelFlagSet = false;
    private _texelFlagSetEarly = false;
    private _texelNeedsReapply = false;
    private _texelReapplied = false;

    /** 场景内唯一实例（挂在 TiledMap 上，或运行时 addComponent） */
    static find(): MapManager | null {
        const scene = director.getScene();
        if (!scene) return null;
        return scene.getComponentInChildren(MapManager);
    }

    /** 在 TiledMap / MapRoot 上确保存在 MapManager */
    static ensureOnMapRoot(mapRoot: Node | null): MapManager | null {
        if (!mapRoot?.isValid) return null;
        let mm = mapRoot.getComponent(MapManager);
        if (!mm) {
            mm = mapRoot.addComponent(MapManager);
            mm.mapRoot = mapRoot;
        }
        return mm;
    }

    /** 须早于子 TiledMap.__preload，先打开全局 texel offset */
    __preload(): void {
        this._setTexelOffsetFlag();
        if (this._anyTiledMapHasLayers()) {
            // 本组件挂晚了：层已按无 offset 建好，onLoad 需重挂
            this._texelNeedsReapply = true;
        } else {
            this._texelFlagSetEarly = true;
        }
    }

    onLoad(): void {
        this._ensureInit();
    }

    start(): void {
        this._ensureInit();
        if (this._activeMapId <= 0) {
            // 仅显隐块与尺寸；剧情/进房由 PlayerStateSync → switchTo 或后续切图负责
            void this.switchTo(this.defaultMapId, undefined, undefined, {
                skipWorld: true,
                skipStory: true,
            });
        }
    }

    get activeMapId(): number {
        return this._activeMapId;
    }

    get isSwitching(): boolean {
        return this._switching;
    }

    /** WorldOnlineSync 判断是否跳过 player_info 自动进房 */
    shouldOwnWorldEnter(): boolean {
        return this.ownsWorldEnter;
    }

    private _ensureInit(): void {
        if (this._inited) return;
        this._inited = true;
        if (!this.mapRoot?.isValid) {
            this.mapRoot = this.node;
        }
        this._setTexelOffsetFlag();
        // 晚挂载：层已建好才重挂；若 __preload 已抢在 TiledMap 之前设好 flag，则不必重建
        if (this._texelNeedsReapply || (!this._texelFlagSetEarly && this._anyTiledMapHasLayers())) {
            this._reapplyTiledMapsForTexelOffset();
        }
        this._scanChunks();
        this._ensureSpriteLayerMaps();
        this._disableTiledCulling();
        const story = this._findStoryManager();
        if (!this.map1StoryConfig && story?.mapConfig) {
            this._storyMap1Captured = story.mapConfig;
        } else {
            this._storyMap1Captured = this.map1StoryConfig;
        }
        void this._ensureMap2StoryLoaded();
        // 后台预建 map2 拼块，避免首次传送时才加载
        void this._ensureMapChunks(2);
    }

    private _loadTmxByUuid(uuid: string): Promise<TiledMapAsset | null> {
        return new Promise((resolve) => {
            assetManager.loadAny({ uuid }, (err, asset) => {
                if (err || !asset) {
                    Logger.warn('MapManager: 加载 TiledMapAsset 失败', uuid, err?.message ?? err);
                    resolve(null);
                    return;
                }
                if (asset instanceof TiledMapAsset) {
                    resolve(asset);
                    return;
                }
                resolve(null);
            });
        });
    }

    /**
     * 若场景无该 mapId 拼块，按 RUNTIME_CHUNK_DEFS 动态创建子节点并挂 TiledMap。
     */
    private _ensureMapChunks(mapId: number): Promise<boolean> {
        const existing = this._chunkEnsureTasks.get(mapId);
        if (existing) return existing;
        const task = this._ensureMapChunksImpl(mapId).finally(() => {
            this._chunkEnsureTasks.delete(mapId);
        });
        this._chunkEnsureTasks.set(mapId, task);
        return task;
    }

    private async _ensureMapChunksImpl(mapId: number): Promise<boolean> {
        if (this._chunksByMap.has(mapId) && (this._chunksByMap.get(mapId)?.length ?? 0) > 0) {
            return true;
        }
        this._scanChunks();
        if (this._chunksByMap.has(mapId) && (this._chunksByMap.get(mapId)?.length ?? 0) > 0) {
            return true;
        }
        const defs = RUNTIME_CHUNK_DEFS[mapId];
        if (!defs?.length) return false;
        const root = this.mapRoot;
        if (!root?.isValid) return false;

        for (let i = 0; i < defs.length; i++) {
            const def = defs[i];
            if (root.getChildByName(def.name)?.isValid) continue;
            const asset = await this._loadTmxByUuid(def.uuid);
            if (!asset) continue;
            const node = new Node(def.name);
            root.addChild(node);
            node.layer = root.layer;
            node.setPosition(def.x, def.y, 0);
            const ut = node.addComponent(UITransform);
            ut.setAnchorPoint(0, 1);
            // 先激活再建层，避免部分预览环境下 inactive 时 tmx 不展开
            node.active = true;
            const tm = node.addComponent(TiledMap);
            tm.enableCulling = false;
            tm.tmxFile = asset;
            node.active = false;
        }
        this._scanChunks();
        const ok = (this._chunksByMap.get(mapId)?.length ?? 0) > 0;
        if (ok) {
            Logger.debug('MapManager: 已运行时补建拼块', { mapId, count: this._chunksByMap.get(mapId)!.length });
        } else {
            Logger.warn('MapManager: 运行时补建拼块失败', mapId);
        }
        return ok;
    }

    private _setTexelOffsetFlag(): void {
        if (!this.enableTileTexelOffset || this._texelFlagSet) return;
        const root = this.mapRoot?.isValid ? this.mapRoot : this.node;
        const probe =
            root.getComponentInChildren(TiledMap, true) ?? this.getComponent(TiledMap);
        if (probe) {
            probe.enableTexelOffset(true);
        } else {
            TiledMap.prototype.enableTexelOffset.call(null as unknown as TiledMap, true);
        }
        this._texelFlagSet = true;
    }

    private _anyTiledMapHasLayers(): boolean {
        const root = this.mapRoot?.isValid ? this.mapRoot : this.node;
        // includeInactive：map2 块默认隐藏，也必须扫到
        const maps = root.getComponentsInChildren(TiledMap, true);
        for (let i = 0; i < maps.length; i++) {
            if (maps[i].getLayers().length > 0) return true;
        }
        return false;
    }

    private _reapplyTiledMapsForTexelOffset(): void {
        if (this._texelReapplied) return;
        this._texelReapplied = true;
        const root = this.mapRoot?.isValid ? this.mapRoot : this.node;
        const maps = root.getComponentsInChildren(TiledMap, true);
        for (let i = 0; i < maps.length; i++) {
            const tm = maps[i];
            const file = tm.tmxFile;
            if (!file) continue;
            tm.tmxFile = null;
            tm.tmxFile = file;
            tm.enableCulling = false;
        }
    }

    private _ensureMap2StoryLoaded(): Promise<JsonAsset | null> {
        if (this.map2StoryConfig) {
            this._map2StoryLoaded = this.map2StoryConfig;
            return Promise.resolve(this.map2StoryConfig);
        }
        if (this._map2StoryLoaded) return Promise.resolve(this._map2StoryLoaded);
        if (this._map2StoryLoading) return this._map2StoryLoading;
        this._map2StoryLoading = new Promise((resolve) => {
            resources.load(MAP2_STORY_PATH, JsonAsset, (err, asset) => {
                if (err || !asset) {
                    Logger.warn('MapManager: 加载 map_2 剧情失败', err?.message ?? err);
                    this._map2StoryLoaded = null;
                    resolve(null);
                    return;
                }
                this._map2StoryLoaded = asset;
                resolve(asset);
            });
        });
        return this._map2StoryLoading;
    }

    private _storyConfigFor(mapId: number): JsonAsset | null {
        if (mapId === 1) {
            return this.map1StoryConfig ?? this._storyMap1Captured;
        }
        if (mapId === 2) {
            return this.map2StoryConfig ?? this._map2StoryLoaded;
        }
        return null;
    }

    private _scanChunks(): void {
        this._chunksByMap.clear();
        this._spriteByMap.clear();
        const root = this.mapRoot;
        if (!root?.isValid) return;
        for (let i = 0; i < root.children.length; i++) {
            const ch = root.children[i];
            const name = ch.name || '';
            const sm = SPRITE_MAP_NAME_RE.exec(name);
            if (sm) {
                const mapId = Number(sm[1]);
                if (Number.isFinite(mapId) && mapId > 0) {
                    this._spriteByMap.set(mapId, ch);
                }
                continue;
            }
            const m = CHUNK_NAME_RE.exec(name);
            if (!m) continue;
            const mapId = Number(m[1]);
            if (!Number.isFinite(mapId) || mapId <= 0) continue;
            let list = this._chunksByMap.get(mapId);
            if (!list) {
                list = [];
                this._chunksByMap.set(mapId, list);
            }
            list.push(ch);
        }
    }

    private _ensureSpriteLayerMaps(): void {
        this._spriteByMap.forEach((node, mapId) => {
            const path = mapId === 1 ? 'Map/M1_walk_flags' : `Map/M${mapId}_walk_flags`;
            SpriteLayerMap.ensureOnNode(node, mapId, path);
        });
    }

    private _hasMapVisual(mapId: number): boolean {
        if (this._spriteByMap.has(mapId)) return true;
        return (this._chunksByMap.get(mapId)?.length ?? 0) > 0;
    }

    private _defaultSpawn(mapId: number): { x: number; y: number } {
        return DEFAULT_SPAWNS[mapId] ?? DEFAULT_SPAWNS[1];
    }

    /**
     * 切到指定地图。同图仅落点；跨图 leave → 显隐块 → 尺寸 → 同步 mapId → 落点 → 剧情 → enter。
     */
    async switchTo(
        mapId: number,
        x?: number,
        y?: number,
        opts?: { skipWorld?: boolean; skipStory?: boolean },
    ): Promise<void> {
        this._ensureInit();
        const mid = Math.max(1, Math.floor(Number(mapId) || 1));
        if (!this._hasMapVisual(mid)) {
            this._scanChunks();
            this._ensureSpriteLayerMaps();
        }
        if (!this._hasMapVisual(mid)) {
            const built = await this._ensureMapChunks(mid);
            if (!built) {
                Logger.warn('MapManager.switchTo: 无该 mapId 的拼接块/Sprite图', mid);
                return;
            }
        }

        // Sprite 图优先于同 mapId 的旧 TMX 拼块（如 map1 已切到 M1）
        const spriteNode = this._spriteByMap.get(mid);
        if (spriteNode?.isValid) {
            const sm = spriteNode.getComponent(SpriteLayerMap);
            if (sm) await sm.ensureReady();
        }

        const sameMap = this._activeMapId === mid;
        const spawn = this._defaultSpawn(mid);
        const px = Number.isFinite(Number(x)) ? Number(x) : spawn.x;
        const py = Number.isFinite(Number(y)) ? Number(y) : spawn.y;

        if (sameMap && !this._switching) {
            this._syncPresenceMapId(mid);
            this._applyPlayerPosition(px, py);
            // 启动时可能已 skipWorld 激活块，登录恢复仍需进房
            if (!opts?.skipWorld) {
                const world = this._findWorldOnlineSync();
                if (world?.enableOnline) {
                    await world.enterCurrentMap();
                }
            }
            return;
        }

        this._switching = true;
        try {
            const world = this._findWorldOnlineSync();
            if (!opts?.skipWorld && world) {
                world.leaveCurrentMap();
            }

            this._activateMapChunks(mid);
            this._refreshMapRootSize();
            this._syncPresenceMapId(mid);
            this._applyPlayerPosition(px, py);

            if (!opts?.skipStory) {
                if (mid === 2) {
                    await this._ensureMap2StoryLoaded();
                }
                const story = this._findStoryManager();
                story?.bindMap(mid, this._storyConfigFor(mid));
            }

            this._activeMapId = mid;

            if (!opts?.skipWorld && world?.enableOnline) {
                await world.enterCurrentMap();
            }
            Logger.debug('MapManager.switchTo ok', { mapId: mid, x: px, y: py });
        } finally {
            this._switching = false;
        }
    }

    private _activateMapChunks(mapId: number): void {
        const useSprite = this._spriteByMap.has(mapId);

        this._spriteByMap.forEach((node, mid) => {
            if (node?.isValid) node.active = mid === mapId;
        });

        this._chunksByMap.forEach((nodes, mid) => {
            // 当前图已有 Sprite 底图时，关掉同 mapId 的旧 TMX，避免叠两套
            const on = !useSprite && mid === mapId;
            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                if (n?.isValid) n.active = on;
            }
        });
        // 关闭瓦片裁剪，减轻预览/真机格缝（Cocos TiledMap 常见）
        this._disableTiledCulling();
    }

    private _disableTiledCulling(): void {
        const root = this.mapRoot;
        if (!root?.isValid) return;
        const maps = root.getComponentsInChildren(TiledMap, true);
        for (let i = 0; i < maps.length; i++) {
            const tm = maps[i];
            if (tm) tm.enableCulling = false;
        }
    }

    /**
     * 仅用当前激活块的 UIT 并集写 mapRoot contentSize（锚点保持左上 0,1）。
     * 支持 TMX 拼块名 `n-m` 与 Sprite 图 `M{n}`。
     */
    private _refreshMapRootSize(): void {
        const root = this.mapRoot;
        if (!root?.isValid) return;
        const rootUt = root.getComponent(UITransform);
        if (!rootUt) return;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let any = false;

        for (let i = 0; i < root.children.length; i++) {
            const ch = root.children[i];
            if (!ch.active) continue;
            const name = ch.name || '';
            if (!CHUNK_NAME_RE.test(name) && !SPRITE_MAP_NAME_RE.test(name)) continue;
            const ut = ch.getComponent(UITransform);
            if (!ut) continue;
            const w = ut.width;
            const h = ut.height;
            const left = ch.position.x - ut.anchorX * w;
            const right = left + w;
            const bottom = ch.position.y - ut.anchorY * h;
            const top = bottom + h;
            minX = Math.min(minX, left);
            maxX = Math.max(maxX, right);
            minY = Math.min(minY, bottom);
            maxY = Math.max(maxY, top);
            any = true;
        }

        if (!any || !isFinite(minX)) return;
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        rootUt.setContentSize(width, height);
        // 保持左上锚点；位置仍为 (0,0)，内容相对父节点从原点向下向右展开
        rootUt.setAnchorPoint(0, 1);
    }

    private _syncPresenceMapId(mapId: number): void {
        const world = this._findWorldOnlineSync();
        if (world) world.mapId = mapId;
        const syncs = findCompsByClassName<PlayerStateLike>('PlayerStateSync');
        for (let i = 0; i < syncs.length; i++) {
            if (syncs[i]?.enabled) syncs[i].mapId = mapId;
        }
    }

    private _applyPlayerPosition(x: number, y: number): void {
        const mv = this._findPlayerMove();
        if (!mv) return;
        mv.setPixelPosition(x, y, true);
        mv.markServerRestored();
    }

    private _findPlayerMove(): PlayerGridMove | null {
        const world = this._findWorldOnlineSync();
        if (world?.localPlayerMove?.node?.isValid) return world.localPlayerMove;
        const scene = director.getScene();
        return scene?.getComponentInChildren(PlayerGridMove) ?? null;
    }

    private _findWorldOnlineSync(): WorldOnlineLike | null {
        return findCompByClassName<WorldOnlineLike>('WorldOnlineSync');
    }

    private _findStoryManager(): StoryBinder | null {
        return findCompByClassName<StoryBinder>('StoryManager');
    }
}
