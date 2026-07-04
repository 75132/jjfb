/** 地图编辑器视口缓存（跨组件重渲染保留 zoom/pan） */
export type MapEditorViewState = {
  zoom: number;
  panX: number;
  panY: number;
};

const viewStateByMapKey = new Map<string, MapEditorViewState>();

export function getMapEditorViewState(mapKey: string): MapEditorViewState | undefined {
  return viewStateByMapKey.get(mapKey);
}

export function setMapEditorViewState(mapKey: string, state: MapEditorViewState): void {
  viewStateByMapKey.set(mapKey, state);
}

export function clearMapEditorViewState(mapKey: string): void {
  viewStateByMapKey.delete(mapKey);
}
