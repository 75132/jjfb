/**
 * 从 workspace 导出指定 mapCode 到 Cocos assets（map_{mapId}.json）
 * 用法: npx tsx scripts/export-to-cocos-map.ts <mapId> [mapCode]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GraphData, ProjectData, WorkspacePayload } from "../src/types";
import { exportProjectMapPipeline } from "../src/editor/map-export-pipeline";
import { buildMergeShellFromGameMap } from "../src/editor/map-import";
import { resolveCocosMapAbsolutePath } from "../server/cocos-map-publish";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const jubenRoot = path.resolve(scriptDir, "..");
const workspacePath = path.join(jubenRoot, "data", "workspace.json");

function main() {
  const mapId = Number(process.argv[2]);
  const mapCode = process.argv[3] ?? "world_1782661910893";
  if (!Number.isFinite(mapId)) {
    console.error("用法: npx tsx scripts/export-to-cocos-map.ts <mapId> [mapCode]");
    process.exit(1);
  }

  const ws = JSON.parse(fs.readFileSync(workspacePath, "utf-8")) as WorkspacePayload;
  let project: ProjectData | null = null;
  for (const row of ws.projects) {
    const gm = (row.data as ProjectData).gameMaps?.find((m) => m.mapCode === mapCode);
    if (gm) {
      project = row.data as ProjectData;
      break;
    }
  }
  if (!project) {
    console.error(`未找到 mapCode=${mapCode}`);
    process.exit(1);
  }

  const gm = project.gameMaps!.find((m) => m.mapCode === mapCode)!;
  const graph = project.graphs.find((g) => g.id === gm.graphId) as GraphData;
  const shell = buildMergeShellFromGameMap(gm);
  const result = exportProjectMapPipeline(gm, graph, project, { mergeFrom: shell });
  if (!result.ok) {
    console.warn("导出校验有警告，仍写入文件");
  }

  const runtime = { ...result.config, mapId };
  const outPath = resolveCocosMapAbsolutePath(mapId);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const existed = fs.existsSync(outPath);
  fs.writeFileSync(outPath, JSON.stringify(runtime, null, 2), "utf-8");
  console.log(`${existed ? "覆盖" : "新建"} ${outPath}`);
  console.log(`mapId=${mapId} mapCode=${runtime.mapCode} npcs=${runtime.npcs?.length ?? 0}`);
}

main();
