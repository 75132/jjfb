/**
 * 将 Juben 导出的 story_project_*.json 转为 Cocos 运行时 map JSON。
 */
import fs from "node:fs";
import path from "node:path";
import type { GraphData, ProjectData } from "../src/types";
import {
  exportProjectMapPipeline,
  findGameMapInProject,
  formatPipelineReport,
} from "../src/editor/map-export-pipeline";

function usage(): never {
  console.error(
    "用法: npx tsx scripts/export-story-project-map.ts <story_project.json> [gameMapId|mapCode] [--out path] [--merge path] [--strict]",
  );
  process.exit(1);
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) usage();

  const projectPath = path.resolve(args[0]!);
  let mapKey = "test_base";
  let outPath = "";
  let mergePath = "";
  let strict = false;

  for (let i = 1; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--out") {
      outPath = path.resolve(args[++i] ?? "");
      continue;
    }
    if (a === "--merge") {
      mergePath = path.resolve(args[++i] ?? "");
      continue;
    }
    if (a === "--strict") {
      strict = true;
      continue;
    }
    if (!a.startsWith("--")) mapKey = a;
  }

  const project = readJson(projectPath) as ProjectData;
  const gameMap = findGameMapInProject(project, mapKey);
  if (!gameMap) {
    console.error(`未找到 gameMap：${mapKey}`);
    process.exit(1);
  }
  const graph = project.graphs.find((g) => g.id === gameMap.graphId) as GraphData | undefined;
  if (!graph) {
    console.error(`未找到 graph：${gameMap.graphId}`);
    process.exit(1);
  }

  const repoRoot = path.resolve(path.dirname(projectPath), "../../..");
  const defaultMerge = path.join(repoRoot, "assets", "resources", "Sample", "剧情脚本", "map_0_test_base_shared.json");
  if (!mergePath && gameMap.mapCode === "test_base" && fs.existsSync(defaultMerge)) {
    mergePath = defaultMerge;
  }

  const mergeFrom = mergePath && fs.existsSync(mergePath) ? (readJson(mergePath) as Record<string, unknown>) : null;

  const result = exportProjectMapPipeline(gameMap, graph, project, { mergeFrom });
  console.log(formatPipelineReport(result));

  if (!result.ok && strict) {
    console.error("严格模式：校验未通过，未写出文件。");
    process.exit(1);
  }
  if (!result.ok) {
    console.error("校验未通过，仍写出文件供排查（加 --strict 可阻止写出）。");
  }

  const runtime = result.config;

  if (!outPath) {
    outPath =
      gameMap.mapCode === "test_base"
        ? defaultMerge
        : path.join(
            repoRoot,
            "assets",
            "resources",
            "Sample",
            "剧情脚本",
            `map_${gameMap.mapId ?? 0}_${gameMap.mapCode}_shared.json`,
          );
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(runtime, null, 2)}\n`, "utf-8");
  console.log(`已写出: ${outPath}`);
  console.log(
    `mapCode=${String(runtime.mapCode)} npcs=${(runtime.npcs ?? []).length} tasks=${(runtime.tasks ?? []).length}`,
  );

  const serverDir = path.join(repoRoot, "server", "data", "story_maps");
  const serverPath = path.join(serverDir, path.basename(outPath));
  if (fs.existsSync(path.join(repoRoot, "server"))) {
    fs.mkdirSync(serverDir, { recursive: true });
    fs.writeFileSync(serverPath, `${JSON.stringify(runtime, null, 2)}\n`, "utf-8");
    console.log(`已同步服务端: ${serverPath}`);
  }
}

main();
