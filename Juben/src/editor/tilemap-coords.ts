/**
 * 48×48 格心坐标换算（对齐 AItools/tilemap_coordinate_viewer.py 与 Cocos StoryManager）
 * 逻辑 Y：向上为正；图像 Y：向下为正。
 */

export const DEFAULT_TILE_SIZE = 48;

export function tileTxMax(mapW: number, tileSize = DEFAULT_TILE_SIZE): number {
  if (mapW <= tileSize / 2) return 0;
  return Math.max(0, Math.floor((mapW - tileSize / 2 - 1) / tileSize));
}

export function tileTyMax(mapH: number, tileSize = DEFAULT_TILE_SIZE): number {
  if (mapH <= tileSize / 2) return 0;
  return Math.max(0, Math.floor((mapH - tileSize / 2 - 1) / tileSize));
}

/** 图像像素 (向下为正) → 逻辑格心 lx=24+tx·48，ly=24−ty·48 */
export function snapImageToLogical(
  ix: number,
  iy: number,
  mapW: number,
  mapH: number,
  tileSize = DEFAULT_TILE_SIZE,
): { x: number; y: number } {
  const imx = Math.max(0, Math.min(mapW - 1, Math.round(ix)));
  const imy = Math.max(0, Math.min(mapH - 1, Math.round(iy)));
  const tx = Math.max(0, Math.min(tileTxMax(mapW, tileSize), Math.floor((imx - tileSize / 2) / tileSize)));
  const ty = Math.max(0, Math.min(tileTyMax(mapH, tileSize), Math.floor((imy - tileSize / 2) / tileSize)));
  return {
    x: tx * tileSize + tileSize / 2,
    y: tileSize / 2 - ty * tileSize,
  };
}

export function clampLogical(
  lx: number,
  ly: number,
  mapW: number,
  mapH: number,
  tileSize = DEFAULT_TILE_SIZE,
): { x: number; y: number } {
  const tx = Math.round((lx - tileSize / 2) / tileSize);
  const ty = Math.round((tileSize / 2 - ly) / tileSize);
  const ctx = Math.max(0, Math.min(tileTxMax(mapW, tileSize), tx));
  const cty = Math.max(0, Math.min(tileTyMax(mapH, tileSize), ty));
  return {
    x: ctx * tileSize + tileSize / 2,
    y: tileSize / 2 - cty * tileSize,
  };
}

/** 逻辑格心 → 图像像素 Y（向下为正，用于 Canvas 渲染） */
export function logicalYToImagePy(ly: number, mapH: number, tileSize = DEFAULT_TILE_SIZE): number {
  const ty = Math.round((tileSize / 2 - ly) / tileSize);
  const cty = Math.max(0, Math.min(tileTyMax(mapH, tileSize), ty));
  return cty * tileSize + tileSize / 2;
}

/** 逻辑坐标 → 图像像素 (向下为正) */
export function logicalToImagePx(
  lx: number,
  ly: number,
  mapH: number,
  tileSize = DEFAULT_TILE_SIZE,
): { x: number; y: number } {
  const ty = Math.round((tileSize / 2 - ly) / tileSize);
  const cty = Math.max(0, Math.min(tileTyMax(mapH, tileSize), ty));
  return {
    x: lx,
    y: cty * tileSize + tileSize / 2,
  };
}

/** 逻辑格心 → 地图父节点本地坐标（内容区左上 minX/maxY，与 Cocos StoryManager 一致） */
export function logicalToParentLocal(
  lx: number,
  ly: number,
  bounds: { minX: number; maxY: number; minY: number },
  tileSize = DEFAULT_TILE_SIZE,
): { x: number; y: number } {
  const mapH = bounds.maxY - bounds.minY;
  const imagePy = logicalYToImagePy(ly, mapH, tileSize);
  return {
    x: bounds.minX + lx,
    y: bounds.maxY - imagePy,
  };
}
