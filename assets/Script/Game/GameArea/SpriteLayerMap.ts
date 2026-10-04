/**
 * 分层 Sprite 地图（如 M1）：与 TiledMap 同规格（48px 格、左上锚点），
 * 用预计算 walk flags 判定通行（默认 B/E 层不可通行）。
 */
import { _decorator, Component, JsonAsset, Node, UITransform, resources } from 'cc';
import { Logger } from '../../global/Logger';
import { TILE_CELL } from '../tilemap-coords';

const { ccclass, property } = _decorator;

export type SpriteWalkFlagsData = {
    cols: number;
    rows: number;
    tile?: number;
    flags: number[] | string;
    blockedLayers?: string[];
};

@ccclass('SpriteLayerMap')
export class SpriteLayerMap extends Component {
    @property({ tooltip: '逻辑 mapId（MapManager 用 M{mapId} 节点名扫描）' })
    mapId = 1;

    @property({
        tooltip: '不可通行子层名（逗号分隔，仅文档/导出约定；实际阻挡以 walkFlags 为准）',
    })
    blockedLayerNames = 'M1_B,M1_E';

    @property({ type: JsonAsset, tooltip: '预计算通行表（cols/rows/flags）；留空则走 resourcesPath' })
    walkFlagsAsset: JsonAsset | null = null;

    @property({ tooltip: 'resources 相对路径（无扩展名），如 Map/M1_walk_flags' })
    resourcesPath = 'Map/M1_walk_flags';

    @property({ tooltip: '格像素（须与 PlayerGridMove / tilemap-coords 一致）' })
    tileSize = TILE_CELL;

    private _cols = 0;
    private _rows = 0;
    private _flags: Uint8Array | null = null;
    private _ready = false;
    private _loading: Promise<void> | null = null;

    onLoad(): void {
        void this.ensureReady();
    }

    get cols(): number {
        return this._cols;
    }

    get rows(): number {
        return this._rows;
    }

    get isReady(): boolean {
        return this._ready && !!this._flags;
    }

    /** 确保 flags 已加载（切图/寻路前可 await） */
    ensureReady(): Promise<void> {
        if (this._ready) return Promise.resolve();
        if (this._loading) return this._loading;
        this._loading = this._loadFlags().finally(() => {
            this._loading = null;
        });
        return this._loading;
    }

    /**
     * 父节点（通常为 TiledMap/MapRoot）本地坐标上的格是否阻挡。
     * 假定本节点与 mapRoot 同位（0,0）、锚点左上 (0,1)。
     */
    isBlockedAtMapLocal(mapLocalX: number, mapLocalY: number): boolean {
        if (!this._flags || this._cols <= 0 || this._rows <= 0) return false;
        const tile = this.tileSize > 0 ? this.tileSize : TILE_CELL;
        const ut = this.getComponent(UITransform);
        const originX = this.node.position.x;
        const originY = this.node.position.y;
        // 相对本节点内容区：左上原点向下为正行
        let col = Math.floor((mapLocalX - originX) / tile);
        let row = Math.floor((originY - mapLocalY) / tile);
        if (ut) {
            // 若 mapRoot 与本节点不完全重合，仍以本节点锚点格子为准
            col = Math.floor((mapLocalX - originX) / tile);
            row = Math.floor((originY - mapLocalY) / tile);
        }
        return this.isBlockedCell(col, row);
    }

    isBlockedCell(col: number, row: number): boolean {
        if (!this._flags || this._cols <= 0 || this._rows <= 0) return false;
        if (col < 0 || row < 0 || col >= this._cols || row >= this._rows) return true;
        return this._flags[row * this._cols + col] !== 0;
    }

    /** 把本节点 UIT 同步到像素尺寸（cols*tile × rows*tile），锚点左上 */
    applyContentSizeFromFlags(): void {
        if (this._cols <= 0 || this._rows <= 0) return;
        const tile = this.tileSize > 0 ? this.tileSize : TILE_CELL;
        const ut = this.getComponent(UITransform) || this.addComponent(UITransform);
        ut.setAnchorPoint(0, 1);
        ut.setContentSize(this._cols * tile, this._rows * tile);
    }

    private async _loadFlags(): Promise<void> {
        let raw: unknown = this.walkFlagsAsset?.json ?? null;
        if (!raw && this.resourcesPath) {
            raw = await new Promise<unknown>((resolve) => {
                resources.load(this.resourcesPath, JsonAsset, (err, asset) => {
                    if (err || !asset) {
                        Logger.warn('SpriteLayerMap: 加载 walk flags 失败', this.resourcesPath, err?.message ?? err);
                        resolve(null);
                        return;
                    }
                    resolve(asset.json);
                });
            });
        }
        if (!raw || typeof raw !== 'object') {
            Logger.warn('SpriteLayerMap: 无 walk flags，通行判定将放行', this.node.name);
            this._ready = true;
            return;
        }
        const data = raw as SpriteWalkFlagsData;
        const cols = Math.max(0, Math.floor(Number(data.cols) || 0));
        const rows = Math.max(0, Math.floor(Number(data.rows) || 0));
        const flagsArr = this._parseFlags(data.flags, cols * rows);
        this._cols = cols;
        this._rows = rows;
        this._flags = flagsArr;
        if (typeof data.tile === 'number' && data.tile > 0) {
            this.tileSize = data.tile;
        }
        if (Array.isArray(data.blockedLayers) && data.blockedLayers.length) {
            this.blockedLayerNames = data.blockedLayers.join(',');
        }
        this.applyContentSizeFromFlags();
        this._ready = true;
        Logger.debug('SpriteLayerMap ready', {
            name: this.node.name,
            mapId: this.mapId,
            cols,
            rows,
            blocked: flagsArr ? flagsArr.reduce((s, v) => s + (v ? 1 : 0), 0) : 0,
        });
    }

    private _parseFlags(raw: number[] | string | undefined, expect: number): Uint8Array {
        const out = new Uint8Array(Math.max(0, expect));
        if (!raw || expect <= 0) return out;
        if (typeof raw === 'string') {
            // 支持 "0101..." 或 base64 暂不启用，仅数字串
            const s = raw.replace(/\s+/g, '');
            const n = Math.min(expect, s.length);
            for (let i = 0; i < n; i++) out[i] = s.charCodeAt(i) === 49 ? 1 : 0;
            return out;
        }
        if (Array.isArray(raw)) {
            const n = Math.min(expect, raw.length);
            for (let i = 0; i < n; i++) out[i] = Number(raw[i]) ? 1 : 0;
        }
        return out;
    }

    /** 在 mapRoot 下查找激活的 SpriteLayerMap（优先 mapId 匹配） */
    static findActiveUnder(mapRoot: Node | null, mapId?: number): SpriteLayerMap | null {
        if (!mapRoot?.isValid) return null;
        const all = mapRoot.getComponentsInChildren(SpriteLayerMap);
        let fallback: SpriteLayerMap | null = null;
        for (let i = 0; i < all.length; i++) {
            const sm = all[i];
            if (!sm?.node?.activeInHierarchy) continue;
            if (mapId != null && sm.mapId === mapId) return sm;
            if (!fallback) fallback = sm;
        }
        return fallback;
    }

    /** 确保名为 M{n} 的子节点挂有 SpriteLayerMap */
    static ensureOnNode(node: Node | null, mapId: number, resourcesPath?: string): SpriteLayerMap | null {
        if (!node?.isValid) return null;
        let sm = node.getComponent(SpriteLayerMap);
        if (!sm) {
            sm = node.addComponent(SpriteLayerMap);
            sm.mapId = mapId;
            if (resourcesPath) sm.resourcesPath = resourcesPath;
        } else {
            sm.mapId = mapId;
            if (resourcesPath) sm.resourcesPath = resourcesPath;
        }
        void sm.ensureReady();
        return sm;
    }
}
