import type { InjectionKey } from "vue";

export type MapFrameEditorContext = {
  commitResizeDelta: (mapId: string, dw: number, dh: number) => void;
};

export const MAP_FRAME_EDITOR_KEY: InjectionKey<MapFrameEditorContext> = Symbol("mapFrameEditor");
