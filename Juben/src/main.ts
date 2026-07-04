import { createApp } from "vue";
import "./style.css";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/controls/dist/style.css";
import "@vue-flow/minimap/dist/style.css";
import "./vue-flow-overrides.css";
import EditorRoot from "./editor/EditorRoot.vue";
import { loadClientRuntimeManifestFromUrl } from "./editor/client-runtime-manifest";

void loadClientRuntimeManifestFromUrl();

createApp(EditorRoot).mount("#app");
