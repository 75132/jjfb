/**
 * 将 Cocos Sample 下的运行时 map JSON 同步到 server/data/story_maps/
 * 用法: npm run sync:test-map
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const source = path.join(
  repoRoot,
  "assets",
  "resources",
  "Sample",
  "剧情脚本",
  "map_world_1782661910893.json",
);
const target = path.join(repoRoot, "server", "data", "story_maps", "map_0_world_1782661910893.json");

function main() {
  if (!fs.existsSync(source)) {
    console.error("源文件不存在:", source);
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(source, "utf-8")) as { mapId?: number; mapCode?: string };
  const mapId = cfg.mapId ?? 0;
  const mapCode = cfg.mapCode ?? "world_1782661910893";
  const out = path.join(repoRoot, "server", "data", "story_maps", `map_${mapId}_${mapCode}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.copyFileSync(source, out);
  if (path.resolve(out) !== path.resolve(target)) {
    console.log("已同步:", out);
  } else {
    console.log("已同步:", target);
  }
  console.log(`mapCode=${mapCode}  npcs=${(cfg as { npcs?: unknown[] }).npcs?.length ?? 0}`);
}

main();
