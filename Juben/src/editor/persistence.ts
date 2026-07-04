import type { ProjectData } from "../types";

export type PersistedWorkspaceProject = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: ProjectData;
};

export type PersistedWorkspace = {
  version: 1;
  savedAt: number;
  currentProjectId: string | null;
  projects: PersistedWorkspaceProject[];
};

export type SaveToStorageResult = {
  local: boolean;
  remote: boolean;
  error?: string;
  errorCode?: "CONFLICT" | "VALIDATION" | "NETWORK" | "LOCAL_FAILED";
  diskSavedAt?: number;
  validationDetails?: Array<{ path: string; message: string }>;
};

export type StorageHealthInfo = {
  ok: boolean;
  storage?: { dataDir: string; workspaceFile: string };
};

export type LoadFromStorageResult = {
  workspace: PersistedWorkspace | null;
  source: "remote" | "local" | "merged" | "none";
  storageOnline: boolean;
  workspaceFile?: string;
  /** 启动时从浏览器缓存恢复或合并了磁盘与本地 */
  recoveredFromLocal?: boolean;
  /** 合并结果需回写 workspace.json */
  shouldSyncDisk?: boolean;
};

export type BootWorkspaceResolution = {
  workspace: PersistedWorkspace | null;
  source: LoadFromStorageResult["source"];
  recoveredFromLocal: boolean;
  shouldSyncDisk: boolean;
};

const LOCAL_STORAGE_KEY = "juben_workspace_v1";

/** 上次成功写入磁盘时的 savedAt（用于冲突检测） */
let lastKnownRemoteSavedAt = 0;

export function getLastKnownRemoteSavedAt(): number {
  return lastKnownRemoteSavedAt;
}

export function setLastKnownRemoteSavedAt(savedAt: number): void {
  lastKnownRemoteSavedAt = savedAt;
}

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    diskSavedAt?: number;
    details?: Array<{ path: string; message: string }>;
  };
};

async function parseApiError(res: Response): Promise<{ status: number; body: ApiErrorBody }> {
  const text = await res.text().catch(() => "");
  let body: ApiErrorBody = {};
  try {
    body = JSON.parse(text) as ApiErrorBody;
  } catch {
    body = { error: { message: text } };
  }
  return { status: res.status, body };
}

function apiBase(): string {
  return String((import.meta as { env?: { VITE_STORAGE_API_BASE?: string } }).env?.VITE_STORAGE_API_BASE ?? "");
}

const API_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`请求超时（${API_TIMEOUT_MS / 1000}s）：${url}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function api<T>(
  method: "GET" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const url = `${apiBase()}${path}`;
  const res = await fetchWithTimeout(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  });
  if (!res.ok) {
    const { status, body: errBody } = await parseApiError(res);
    const err = new Error(
      `${method} ${url} failed: ${status} ${errBody.error?.message ?? JSON.stringify(errBody)}`,
    ) as Error & { status: number; errorBody: ApiErrorBody };
    err.status = status;
    err.errorBody = errBody;
    throw err;
  }
  return (await res.json()) as T;
}

function normalizeWorkspace(ws: PersistedWorkspace): PersistedWorkspace {
  ws.projects = ws.projects.map((p) => ({
    ...p,
    createdAt: typeof p.createdAt === "number" ? p.createdAt : p.updatedAt,
  }));
  return ws;
}

function isValidWorkspace(ws: unknown): ws is PersistedWorkspace {
  if (!ws || typeof ws !== "object") return false;
  const v = ws as Partial<PersistedWorkspace>;
  return v.version === 1 && Array.isArray(v.projects);
}

function normalizePayload(workspace: PersistedWorkspace): PersistedWorkspace {
  return {
    version: 1,
    savedAt: Date.now(),
    currentProjectId: workspace.currentProjectId,
    projects: workspace.projects,
  };
}

export function readLocalWorkspace(): PersistedWorkspace | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const ws = JSON.parse(raw) as PersistedWorkspace;
    if (!isValidWorkspace(ws)) return null;
    return normalizeWorkspace(ws);
  } catch {
    return null;
  }
}

/** 同步写入浏览器 localStorage（离线降级缓存） */
export function writeLocalWorkspace(workspace: PersistedWorkspace): boolean {
  const payload = normalizePayload(workspace);
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[juben] localStorage write failed:", e);
    return false;
  }
}

/** 检测 storage 服务是否在线 */
export async function checkStorageOnline(): Promise<boolean> {
  try {
    const resp = await api<StorageHealthInfo>("GET", "/api/health");
    return resp.ok === true;
  } catch {
    return false;
  }
}

/** 获取 storage 健康信息与 workspace 文件路径 */
export async function fetchStorageHealth(): Promise<StorageHealthInfo | null> {
  try {
    return await api<StorageHealthInfo>("GET", "/api/health");
  } catch {
    return null;
  }
}

async function readRemoteWorkspace(): Promise<PersistedWorkspace | null> {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await api<{ workspace: PersistedWorkspace | null }>("GET", "/api/workspace");
      const ws = resp.workspace;
      if (isValidWorkspace(ws)) {
        lastKnownRemoteSavedAt = ws.savedAt ?? 0;
        return normalizeWorkspace(ws);
      }
      return null;
    } catch {
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      throw new Error("无法读取 workspace.json（storage 服务无响应）");
    }
  }
  return null;
}

/**
 * 加载工作区：在线时合并 workspace.json 与 localStorage，避免空磁盘覆盖浏览器缓存。
 */
export async function loadFromStorage(): Promise<LoadFromStorageResult> {
  const health = await fetchStorageHealth();
  const storageOnline = health?.ok === true;
  const workspaceFile = health?.storage?.workspaceFile;
  const local = readLocalWorkspace();

  if (storageOnline) {
    try {
      const remote = await readRemoteWorkspace();
      const resolved = resolveBootWorkspace(remote, local);
      if (resolved.workspace) {
        writeLocalWorkspace(resolved.workspace);
      }
      return {
        workspace: resolved.workspace,
        source: resolved.source,
        storageOnline: true,
        workspaceFile,
        recoveredFromLocal: resolved.recoveredFromLocal,
        shouldSyncDisk: resolved.shouldSyncDisk,
      };
    } catch {
      return {
        workspace: local,
        source: local ? "local" : "none",
        storageOnline: false,
        workspaceFile,
        recoveredFromLocal: !!local,
        shouldSyncDisk: !!local,
      };
    }
  }

  return {
    workspace: local,
    source: local ? "local" : "none",
    storageOnline: false,
    workspaceFile,
    recoveredFromLocal: !!local,
    shouldSyncDisk: false,
  };
}

/** 写入 workspace.json；失败 throw（供 UI 强提示） */
export async function saveToStorageRemote(
  workspace: PersistedWorkspace,
  options?: { keepalive?: boolean; forceOverwrite?: boolean },
): Promise<number> {
  const payload = normalizePayload(workspace);
  const body: { workspace: PersistedWorkspace; expectedSavedAt?: number } = { workspace: payload };
  if (!options?.forceOverwrite && lastKnownRemoteSavedAt > 0) {
    body.expectedSavedAt = lastKnownRemoteSavedAt;
  }
  const resp = await api<{ ok: boolean; savedAt: number }>("PUT", "/api/workspace", body, {
    keepalive: options?.keepalive ?? false,
  });
  lastKnownRemoteSavedAt = resp.savedAt ?? payload.savedAt;
  return lastKnownRemoteSavedAt;
}

/** 关页/卸载时用 keepalive 尽力写入磁盘（不 throw） */
export function saveToStorageKeepalive(workspace: PersistedWorkspace): void {
  const payload = normalizePayload(workspace);
  const url = `${apiBase()}/api/workspace`;
  try {
    void fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: payload }),
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}

/** 保存：在线时写磁盘（权威）+ 镜像 localStorage；离线时仅 localStorage */
export async function saveToStorage(
  workspace: PersistedWorkspace,
  options?: { forceOverwrite?: boolean },
): Promise<SaveToStorageResult> {
  const payload = normalizePayload(workspace);
  const localOk = writeLocalWorkspace(payload);
  if (!localOk) {
    return { local: false, remote: false, error: "localStorage 写入失败", errorCode: "LOCAL_FAILED" };
  }

  const online = await checkStorageOnline();
  if (!online) {
    return { local: true, remote: false, error: "storage 服务未连接", errorCode: "NETWORK" };
  }

  try {
    await saveToStorageRemote(payload, { forceOverwrite: options?.forceOverwrite });
    return { local: true, remote: true };
  } catch (e) {
    const err = e as Error & { status?: number; errorBody?: ApiErrorBody };
    if (err.status === 409 && err.errorBody?.error?.code === "CONFLICT") {
      return {
        local: true,
        remote: false,
        error: err.errorBody.error.message ?? "远端 workspace 已更新",
        errorCode: "CONFLICT",
        diskSavedAt: err.errorBody.error.diskSavedAt,
      };
    }
    if (err.status === 422) {
      return {
        local: true,
        remote: false,
        error: err.errorBody?.error?.message ?? "project.data 校验失败",
        errorCode: "VALIDATION",
        validationDetails: err.errorBody?.error?.details,
      };
    }
    return {
      local: true,
      remote: false,
      error: err instanceof Error ? err.message : String(e),
      errorCode: "NETWORK",
    };
  }
}

function projectContentScore(p: PersistedWorkspaceProject): number {
  let score = 0;
  for (const g of p.data?.graphs ?? []) score += g.nodes?.length ?? 0;
  for (const gm of p.data?.gameMaps ?? []) score += gm.npcs?.length ?? 0;
  score += p.data?.quests?.length ?? 0;
  return score;
}

export function workspaceContentScore(ws: PersistedWorkspace): number {
  return ws.projects.reduce((sum, p) => sum + projectContentScore(p), 0);
}

export function workspaceHasContent(ws: PersistedWorkspace | null | undefined): boolean {
  return !!ws && workspaceContentScore(ws) > 0;
}

/**
 * 启动时合并 remote / local，避免「磁盘空壳覆盖浏览器里刚编辑的数据」。
 * - 磁盘 null → 用 local
 * - 磁盘空壳 + local 有内容 → 用 local（必要时 merge 保留磁盘上的空项目 id）
 * - 双方都有内容 → mergeWorkspaces（同 id 取更丰富/更新者）
 */
export function resolveBootWorkspace(
  remote: PersistedWorkspace | null,
  local: PersistedWorkspace | null,
): BootWorkspaceResolution {
  if (!remote && !local) {
    return { workspace: null, source: "none", recoveredFromLocal: false, shouldSyncDisk: false };
  }
  if (!remote && local) {
    return { workspace: local, source: "local", recoveredFromLocal: true, shouldSyncDisk: true };
  }
  if (remote && !local) {
    return { workspace: remote, source: "remote", recoveredFromLocal: false, shouldSyncDisk: false };
  }

  const r = remote!;
  const l = local!;
  const remoteScore = workspaceContentScore(r);
  const localScore = workspaceContentScore(l);

  if (remoteScore === 0 && localScore > 0) {
    const merged = mergeWorkspaces(l, r);
    return { workspace: merged, source: "merged", recoveredFromLocal: true, shouldSyncDisk: true };
  }
  if (localScore === 0 && remoteScore > 0) {
    writeLocalWorkspace(r);
    return { workspace: r, source: "remote", recoveredFromLocal: false, shouldSyncDisk: false };
  }

  const primary = (r.savedAt ?? 0) >= (l.savedAt ?? 0) ? r : l;
  const secondary = primary === r ? l : r;
  const merged = mergeWorkspaces(primary, secondary);
  const mergedScore = workspaceContentScore(merged);
  const sameAsRemote =
    merged.projects.length === r.projects.length &&
    merged.currentProjectId === r.currentProjectId &&
    mergedScore === remoteScore;
  if (sameAsRemote && (r.savedAt ?? 0) >= (l.savedAt ?? 0)) {
    return { workspace: r, source: "remote", recoveredFromLocal: false, shouldSyncDisk: false };
  }

  const recoveredFromLocal = localScore > remoteScore || (l.savedAt ?? 0) > (r.savedAt ?? 0);
  return {
    workspace: merged,
    source: "merged",
    recoveredFromLocal,
    shouldSyncDisk: true,
  };
}

function pickRicherProject(
  existing: PersistedWorkspaceProject,
  incoming: PersistedWorkspaceProject,
): PersistedWorkspaceProject {
  const existingScore = projectContentScore(existing);
  const incomingScore = projectContentScore(incoming);
  const existingTime = existing.updatedAt ?? 0;
  const incomingTime = incoming.updatedAt ?? 0;

  if (
    existingScore >= 1 &&
    incomingScore === 0 &&
    incomingTime >= existingTime &&
    incomingTime - existingTime <= 86_400_000
  ) {
    return existing;
  }
  if (
    incomingScore >= 1 &&
    existingScore === 0 &&
    existingTime >= incomingTime &&
    existingTime - incomingTime <= 86_400_000
  ) {
    return incoming;
  }
  if (incomingTime >= existingTime) return incoming;
  return existing;
}

export function mergeWorkspaces(a: PersistedWorkspace, b: PersistedWorkspace): PersistedWorkspace {
  const byId = new Map<string, PersistedWorkspaceProject>();
  for (const p of a.projects) {
    if (p?.id) byId.set(p.id, p);
  }
  for (const p of b.projects) {
    if (!p?.id) continue;
    const existing = byId.get(p.id);
    if (!existing) {
      byId.set(p.id, p);
      continue;
    }
    byId.set(p.id, pickRicherProject(existing, p));
  }
  const projects = [...byId.values()].sort((x, y) => (y.updatedAt ?? 0) - (x.updatedAt ?? 0));
  const savedAt = Math.max(a.savedAt ?? 0, b.savedAt ?? 0);
  const currentProjectId =
    (a.currentProjectId && projects.some((p) => p.id === a.currentProjectId) && a.currentProjectId) ||
    (b.currentProjectId && projects.some((p) => p.id === b.currentProjectId) && b.currentProjectId) ||
    projects[0]?.id ||
    null;
  return normalizeWorkspace({
    version: 1,
    savedAt,
    currentProjectId,
    projects,
  });
}

export async function clearStorage() {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  await api("DELETE", "/api/workspace");
}
