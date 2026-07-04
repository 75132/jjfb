/**
 * 将 Juben 权威 tilemap-coords.ts 同步到 Cocos 运行时目录（单向）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const jubenRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(jubenRoot, "..");
const source = path.join(jubenRoot, "src", "editor", "tilemap-coords.ts");
const target = path.join(repoRoot, "assets", "Script", "Game", "tilemap-coords.ts");

const header = `/** 本文件由 Juben scripts/sync-tilemap-coords.ts 自动生成，请勿手改。源：Juben/src/editor/tilemap-coords.ts */\n`;

function main() {
  if (!fs.existsSync(source)) {
    console.error(`源文件不存在: ${source}`);
    process.exit(1);
  }
  const content = fs.readFileSync(source, "utf-8");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, header + content, "utf-8");
  console.log(`已同步 tilemap-coords → ${path.relative(repoRoot, target)}`);
}

main();
