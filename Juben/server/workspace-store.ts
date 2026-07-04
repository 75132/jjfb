import fs from "fs/promises";
import path from "path";
import type { WorkspacePayload } from "./workspace-schema";

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(process.cwd(), "data");
const workspaceFile = process.env.WORKSPACE_FILE
  ? path.resolve(process.env.WORKSPACE_FILE)
  : path.join(dataDir, "workspace.json");

async function ensureDataDir() {
  await fs.mkdir(path.dirname(workspaceFile), { recursive: true });
}

export async function readWorkspace(): Promise<WorkspacePayload | null> {
  await ensureDataDir();
  const raw = await fs.readFile(workspaceFile, "utf-8").catch(() => "");
  if (!raw) return null;
  return JSON.parse(raw) as WorkspacePayload;
}

export type WriteWorkspaceResult =
  | { ok: true; savedAt: number }
  | { ok: false; code: "CONFLICT"; diskSavedAt: number; message: string };

/**
 * 写入 workspace；若 expectedSavedAt 小于磁盘 savedAt 则返回 CONFLICT（双标签页保护）
 */
export async function writeWorkspace(
  payload: WorkspacePayload,
  options?: { expectedSavedAt?: number },
): Promise<WriteWorkspaceResult> {
  await ensureDataDir();
  const existing = await readWorkspace();
  const diskSavedAt = existing?.savedAt ?? 0;
  const expected = options?.expectedSavedAt;
  if (expected != null && diskSavedAt > expected) {
    return {
      ok: false,
      code: "CONFLICT",
      diskSavedAt,
      message: `磁盘 workspace 已更新（savedAt=${diskSavedAt} > 客户端 ${expected}）`,
    };
  }
  const savedAt = payload.savedAt ?? Date.now();
  await fs.writeFile(workspaceFile, JSON.stringify({ ...payload, savedAt }, null, 2), "utf-8");
  return { ok: true, savedAt };
}

export async function clearWorkspace(): Promise<void> {
  await ensureDataDir();
  await fs.unlink(workspaceFile).catch(() => undefined);
}

export function getStorageInfo() {
  return { dataDir, workspaceFile };
}

export async function getWorkspaceSavedAt(): Promise<number | null> {
  const ws = await readWorkspace();
  return ws?.savedAt ?? null;
}
