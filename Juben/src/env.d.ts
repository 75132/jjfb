/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STORAGE_API_BASE?: string;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

declare module "elkjs/lib/elk.bundled.js" {
  import type { ELK as ElkType } from "elkjs/lib/elk-api";
  const ELK: new () => ElkType;
  export default ELK;
}
