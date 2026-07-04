import type { GameMapDef } from "../types";

/** Cocos TiledMap 1-1 → 1-2 → 1-3 竖向拼接（与 Juben/Map 目录一致） */
export const COCOS_WORLD_MAP_SLICES = ["/Map/1-1.png", "/Map/1-2.png", "/Map/1-3.png"] as const;

/** Cocos Game 场景 TiledMap 竖拼 1-1→1-2→1-3 的内容区尺寸 */
export const COCOS_RUNTIME_MAP_WIDTH = 1584;
export const COCOS_RUNTIME_MAP_HEIGHT = 1728;

/** 新建/导出到 Cocos 时推荐的底图配置（与 Game.scene TiledMap 一致） */
export const DEFAULT_COCOS_GAME_MAP_IMAGE: Pick<GameMapDef, "imagePath" | "imageSlices"> = {
  imagePath: "/Map/1-1.png",
  imageSlices: [...COCOS_WORLD_MAP_SLICES],
};

/** 已知切片尺寸（与 Juben/Map/*.png 一致；导出 mapWidth/mapHeight 时使用） */
export const MAP_SLICE_KNOWN_SIZES: Record<string, { width: number; height: number }> = {
  "/Map/1-1.png": { width: 1584, height: 720 },
  "/Map/1-2.png": { width: 1584, height: 720 },
  "/Map/1-3.png": { width: 1584, height: 288 },
  "/maps/test_base.png": { width: 1584, height: 1728 },
  "/maps/1.png": { width: 938, height: 1024 },
};

export type MapImagePreset = {
  id: string;
  label: string;
  patch: Pick<GameMapDef, "imagePath" | "imageSlices">;
};

export const MAP_IMAGE_PRESETS: MapImagePreset[] = [
  {
    id: "maps/1",
    label: "单图 /maps/1.png",
    patch: { imagePath: "/maps/1.png", imageSlices: undefined },
  },
  {
    id: "maps/test_base",
    label: "单图 /maps/test_base.png",
    patch: { imagePath: "/maps/test_base.png", imageSlices: undefined },
  },
  {
    id: "map/cocos-stitch",
    label: "Cocos 拼接 1-1 → 1-2 → 1-3",
    patch: {
      imagePath: "/Map/1-1.png",
      imageSlices: [...COCOS_WORLD_MAP_SLICES],
    },
  },
];

export function resolveMapSliceSources(gameMap: Pick<GameMapDef, "imagePath" | "imageSlices">): string[] {
  if (gameMap.imageSlices?.length) return [...gameMap.imageSlices];
  if (gameMap.imagePath) return [gameMap.imagePath];
  return ["/maps/1.png"];
}

export function isVerticallyStitchedMap(gameMap: Pick<GameMapDef, "imageSlices">): boolean {
  return (gameMap.imageSlices?.length ?? 0) > 1;
}

/** 竖向拼接后的内容区宽高（单图则取该图尺寸） */
export function stitchedMapMetricsFromSources(sources: string[]): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const src of sources) {
    const dim = MAP_SLICE_KNOWN_SIZES[src];
    if (dim) {
      width = Math.max(width, dim.width);
      height += dim.height;
    }
  }
  if (width > 0 && height > 0) return { width, height };
  return { width: 800, height: 600 };
}

export function resolveMapPresetId(gameMap: Pick<GameMapDef, "imagePath" | "imageSlices">): string {
  const slices = gameMap.imageSlices ?? [];
  if (slices.length > 1) {
    const hit = MAP_IMAGE_PRESETS.find(
      (p) =>
        p.patch.imageSlices?.length === slices.length &&
        p.patch.imageSlices.every((s, i) => s === slices[i]),
    );
    if (hit) return hit.id;
    return "custom/stitch";
  }
  const path = gameMap.imagePath || "/maps/1.png";
  const hit = MAP_IMAGE_PRESETS.find((p) => !p.patch.imageSlices?.length && p.patch.imagePath === path);
  return hit?.id ?? "custom/single";
}

/** 浏览器端：加载全部切片后量出真实像素尺寸 */
export function isCocosStitchMapConfig(gameMap: Pick<GameMapDef, "imagePath" | "imageSlices">): boolean {
  const slices = gameMap.imageSlices ?? [];
  if (slices.length !== COCOS_WORLD_MAP_SLICES.length) return false;
  return slices.every((s, i) => s === COCOS_WORLD_MAP_SLICES[i]);
}

/**
 * 导出到 Cocos 前的底图校验：Juben 摆点坐标是按当前底图像素尺寸 snap 的，
 * 若底图与 Game.scene 的 1584×1728 竖拼不一致，导出坐标会在 Cocos 里错位。
 */
export function collectCocosExportMapImageIssues(
  gameMap: Pick<GameMapDef, "imagePath" | "imageSlices">,
): string[] {
  const issues: string[] = [];
  const sources = resolveMapSliceSources(gameMap);
  const metrics = stitchedMapMetricsFromSources(sources);

  if (!isCocosStitchMapConfig(gameMap)) {
    issues.push(
      `当前底图为「${gameMap.imagePath ?? "/maps/1.png"}」单图（约 ${metrics.width}×${metrics.height}），` +
        `与 Cocos Game 场景的竖拼地图（${COCOS_RUNTIME_MAP_WIDTH}×${COCOS_RUNTIME_MAP_HEIGHT}，1-1/1-2/1-3）不一致。` +
        `请在左侧「底图预设」切换为「Cocos 拼接 1-1 → 1-2 → 1-3」，在地图上重新拖放 NPC 后再导出。`,
    );
    return issues;
  }

  if (metrics.width !== COCOS_RUNTIME_MAP_WIDTH || metrics.height !== COCOS_RUNTIME_MAP_HEIGHT) {
    issues.push(
      `竖拼底图尺寸为 ${metrics.width}×${metrics.height}，与 Cocos 运行时 ${COCOS_RUNTIME_MAP_WIDTH}×${COCOS_RUNTIME_MAP_HEIGHT} 不一致，请检查 Juben/Map 切片 PNG 尺寸。`,
    );
  }
  return issues;
}

export function measureMapSourcesInBrowser(sources: string[]): Promise<{ width: number; height: number }> {
  if (sources.length === 0) return Promise.resolve({ width: 800, height: 600 });
  return Promise.all(
    sources.map(
      (src) =>
        new Promise<{ w: number; h: number }>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
          img.onerror = () => reject(new Error(`无法加载地图图：${src}`));
          img.src = src;
        }),
    ),
  ).then((parts) => {
    const width = Math.max(0, ...parts.map((p) => p.w));
    const height = parts.reduce((sum, p) => sum + p.h, 0);
    if (width > 0 && height > 0) return { width, height };
    return stitchedMapMetricsFromSources(sources);
  });
}
