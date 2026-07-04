/**
 * 与 Juben/src/editor/tilemap-coords.ts、AItools/tilemap_coordinate_viewer.py 对齐。
 * 逻辑坐标：X/Y 均为格心像素；Y 向上为正（地图上方 y 更大，向下为负）。
 */
export const TILE_CELL = 48;

/** 逻辑格心 (lx, ly) → 格索引 tx, ty（ty=0 为地图视觉顶行） */
export function logicalToTileIndices(
    lx: number,
    ly: number,
    tileSize = TILE_CELL,
): { tx: number; ty: number } {
    const tx = Math.round((lx - tileSize / 2) / tileSize);
    const ty = Math.round((tileSize / 2 - ly) / tileSize);
    return { tx, ty };
}

/** 格索引 → 逻辑格心（与 Juben snapImageToLogical 一致） */
export function tileIndicesToLogical(
    tx: number,
    ty: number,
    tileSize = TILE_CELL,
): { x: number; y: number } {
    return {
        x: tx * tileSize + tileSize / 2,
        y: tileSize / 2 - ty * tileSize,
    };
}

/** 逻辑 Y → 图像像素 Y（向下为正，与 Juben logicalYToImagePy 一致） */
export function logicalYToImagePy(ly: number, mapH: number, tileSize = TILE_CELL): number {
    if (mapH <= tileSize / 2) return tileSize / 2;
    const tyMax = Math.max(0, Math.floor((mapH - tileSize / 2 - 1) / tileSize));
    const ty = Math.round((tileSize / 2 - ly) / tileSize);
    const cty = Math.max(0, Math.min(tyMax, ty));
    return cty * tileSize + tileSize / 2;
}

/** 逻辑格心 → 地图父节点本地坐标（内容区左上为 minX/maxY，与 Juben MapEditorView 一致） */
export function logicalToParentLocal(
    lx: number,
    ly: number,
    bounds: { minX: number; maxY: number; minY: number },
    tileSize = TILE_CELL,
): { x: number; y: number } {
    const mapH = bounds.maxY - bounds.minY;
    const imagePy = logicalYToImagePy(ly, mapH, tileSize);
    return {
        x: bounds.minX + lx,
        y: bounds.maxY - imagePy,
    };
}

/**
 * mapRoot 自身 UITransform 在父节点坐标系中的内容区。
 * 与 Cocos 检视面板 TiledMap → Content Size 一致；勿用子层 union（多块拼接会算大）。
 */
export function mapContentBoundsInParentSpace(
    mapPos: Readonly<{ x: number; y: number }>,
    mapUt: Readonly<{ width: number; height: number; anchorX: number; anchorY: number }>,
): { minX: number; maxX: number; minY: number; maxY: number } {
    const w = mapUt.width;
    const h = mapUt.height;
    const left = mapPos.x - mapUt.anchorX * w;
    const right = left + w;
    const bottom = mapPos.y - mapUt.anchorY * h;
    const top = bottom + h;
    return { minX: left, maxX: right, minY: bottom, maxY: top };
}
