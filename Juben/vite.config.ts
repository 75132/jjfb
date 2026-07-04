import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** 开发/预览时提供 Juben 静态资源目录；构建时复制到 dist */
function serveJubenStaticDir(urlPrefix: string, sourceDir: string, pluginName: string): Plugin {
  const absSource = path.join(rootDir, sourceDir);
  return {
    name: pluginName,
    configureServer(server) {
      server.middlewares.use(urlPrefix, (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
        const filePath = path.normalize(path.join(absSource, rel));
        if (!filePath.startsWith(absSource) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          next();
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader("Content-Type", MIME_BY_EXT[ext] ?? "application/octet-stream");
        fs.createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      const out = path.join(rootDir, "dist", sourceDir);
      if (fs.existsSync(absSource)) {
        fs.cpSync(absSource, out, { recursive: true });
      }
    },
  };
}

/** 开发/预览时提供 data/ 目录（client-runtime-manifest.json 等） */
function serveDataDir(): Plugin {
  const absSource = path.join(rootDir, "data");
  return {
    name: "juben-data-dir",
    configureServer(server) {
      server.middlewares.use("/data", (req, res, next) => {
        const rawUrl = req.url ?? "/";
        // Vite 将 JSON 静态 import 转为 ?import 模块请求，须交回 Vite 处理（否则 MIME 为 application/json）
        if (/\?(?:import|url|raw)(?:&|$)/.test(rawUrl)) {
          next();
          return;
        }
        const rel = decodeURIComponent(rawUrl.split("?")[0] ?? "/");
        const filePath = path.normalize(path.join(absSource, rel));
        if (!filePath.startsWith(absSource) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          next();
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader("Content-Type", ext === ".json" ? "application/json" : "application/octet-stream");
        fs.createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      const out = path.join(rootDir, "dist", "data");
      if (fs.existsSync(absSource)) {
        fs.cpSync(absSource, out, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    vue(),
    serveJubenStaticDir("/Map", "Map", "juben-map-dir"),
    serveJubenStaticDir("/Npc", "Npc", "juben-npc-dir"),
    serveDataDir(),
  ],
  server: {
    port: 5173,
    strictPort: false,
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
