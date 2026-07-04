/**
 * 从 workspace.json 导出指定 mapCode 的运行时 JSON，并双写 Cocos assets + server。
 *
 * 用法:
 *   npm run publish:map -- world_1782661910893
 *   npm run publish:map -- test_base --workspace path/to/workspace.json --strict
 *   npm run publish:map -- test_base --cleanup-legacy
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GraphData, ProjectData } from "../src/types";
import type { WorkspacePayload } from "../server/workspace-schema";
import {
  exportProjectMapPipeline,
  findGameMapInProject,
  formatPipelineReport,
} from "../src/editor/map-export-pipeline";
import { buildMergeShellFromGameMap } from "../src/editor/map-import";
import { publishMapDual } from "../server/map-runtime-publish";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const jubenRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(jubenRoot, "..");

function usage(): never {
  console.error(
    "用法: npx tsx scripts/publish-runtime-map.ts <mapCode> [--workspace path] [--strict] [--cleanup-legacy]",
  );
  process.exit(1);
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function resolveWorkspacePath(explicit?: string): string {
  if (explicit) return path.resolve(explicit);
  const fromEnv = process.env.WORKSPACE_FILE;
  if (fromEnv) return path.resolve(fromEnv);
  const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(jubenRoot, "data");
  return path.join(dataDir, "workspace.json");
}

function findProjectWithMap(ws: WorkspacePayload, mapCode: string): { project: ProjectData; name: string } | null {
  for (const row of ws.projects) {
    const data = row.data as ProjectData;
    const gm = findGameMapInProject(data, mapCode);
    if (gm) return { project: data, name: row.name };
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) usage();

  let mapCode = "";
  let workspacePath = "";
  let strict = false;
  let cleanupLegacy = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--workspace") {
      workspacePath = path.resolve(args[++i] ?? "");
      continue;
    }
    if (a === "--strict") {
      strict = true;
      continue;
    }
    if (a === "--cleanup-legacy") {
      cleanupLegacy = true;
      continue;
    }
    if (!a.startsWith("--") && !mapCode) mapCode = a;
  }

  if (!mapCode) usage();

  const wsFile = resolveWorkspacePath(workspacePath || undefined);
  if (!fs.existsSync(wsFile)) {
    console.error("workspace 不存在:", wsFile);
    console.error("请先 npm run dev 并在编辑器中保存，或指定 --workspace");
    process.exit(1);
  }

  const ws = readJson(wsFile) as WorkspacePayload;
  const hit = findProjectWithMap(ws, mapCode);
  if (!hit) {
    console.error(`workspace 中未找到 mapCode=${mapCode}`);
    process.exit(1);
  }

  const { project, name } = hit;
  const gameMap = findGameMapInProject(project, mapCode);
  if (!gameMap) {
    console.error(`未找到 gameMap：${mapCode}`);
    process.exit(1);
  }
  const graph = project.graphs.find((g) => g.id === gameMap.graphId) as GraphData | undefined;
  if (!graph) {
    console.error(`未找到 graph：${gameMap.graphId}`);
    process.exit(1);
  }

  const mergeFrom = buildMergeShellFromGameMap(gameMap) as Record<string, unknown>;
  const result = exportProjectMapPipeline(gameMap, graph, project, { mergeFrom });
  console.log(`项目: ${name}`);
  console.log(formatPipelineReport(result));

  if (!result.ok && strict) {
    console.error("严格模式：校验未通过，未写出文件。");
    process.exit(1);
  }
  if (!result.ok) {
    console.error("校验未通过，仍写出文件供排查（加 --strict 可阻止写出）。");
  }

  const runtime = result.config;
  const pub = publishMapDual(runtime, {
    repoRoot,
    overwrite: true,
    writeCocos: true,
    writeServer: true,
    cleanupLegacy,
  });

  if (!pub.ok) {
    console.error("发布失败:", pub.message ?? pub.code);
    process.exit(1);
  }

  if (pub.cocos?.written) {
    console.log(`已写出 Cocos 资源: ${pub.cocos.absolutePath}`);
  }
  if (pub.server?.written) {
    console.log(`已同步服务端: ${pub.server.absolutePath}`);
  }
  for (const w of pub.legacyWarnings) console.warn(`[legacy] ${w}`);
  for (const r of pub.legacyRemoved) console.log(`[legacy] 已删除: ${r}`);

  console.log(
    `mapCode=${String(runtime.mapCode)} npcs=${(runtime.npcs ?? []).length} tasks=${(runtime.tasks ?? []).length}`,
  );
}

main();
