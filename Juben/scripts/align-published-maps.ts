/**
 * 将已有 runtime map JSON 双写到 canonical 路径（Cocos + server）
 * 用法: npx tsx scripts/align-published-maps.ts [path/to/map.json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publishMapDual } from "../server/map-runtime-publish";
import { validateRuntimeConfig } from "../src/editor/map-export-pipeline";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

const defaultSources = [
  path.join(repoRoot, "assets", "resources", "Sample", "剧情脚本", "map_1.json"),
];

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const cleanupLegacy = process.argv.includes("--cleanup-legacy");
  const sources = args.length ? args.map((a) => path.resolve(a)) : defaultSources;

  for (const src of sources) {
    if (!fs.existsSync(src)) {
      console.warn("跳过（不存在）:", src);
      continue;
    }
    const raw = JSON.parse(fs.readFileSync(src, "utf-8")) as Record<string, unknown>;
    const validation = validateRuntimeConfig(raw as never);
    console.log(`\n=== ${path.basename(src)} ===`);
    if (!validation.ok) {
      console.warn("校验未通过，仍发布（请后续在 Juben 修复）:");
      for (const m of validation.manifestIssues.filter((i) => i.level === "error")) {
        console.warn(`  [ERROR] ${m.path}: ${m.message}`);
      }
    }

    const pub = publishMapDual(raw, {
      repoRoot,
      overwrite: true,
      writeCocos: true,
      writeServer: true,
      cleanupLegacy,
    });
    if (!pub.ok) {
      console.error("发布失败:", pub.message);
      process.exitCode = 1;
      continue;
    }
    console.log(`Cocos: ${pub.cocos?.relativePath}`);
    console.log(`Server: ${pub.server?.relativePath}`);
    for (const w of pub.legacyWarnings) console.warn(`[legacy] ${w}`);
    for (const r of pub.legacyRemoved) console.log(`[legacy] 已删除 ${r}`);
  }
}

main();
