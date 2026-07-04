import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadFromStorage,
  mergeWorkspaces,
  readLocalWorkspace,
  resolveBootWorkspace,
  saveToStorageRemote,
  writeLocalWorkspace,
} from "../src/editor/persistence";

const originalFetch = global.fetch;

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const mock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  vi.stubGlobal("localStorage", mock);
  return mock;
}

function mockFetch(handlers: Record<string, (url: string, init?: RequestInit) => Response | Promise<Response>>) {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    for (const [prefix, handler] of Object.entries(handlers)) {
      if (url.includes(prefix)) return handler(url, init);
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

function projectWithNodes(id: string, name: string, nodeCount: number, updatedAt: number) {
  return {
    id,
    name,
    createdAt: 1,
    updatedAt,
    data: {
      variables: [],
      quests: [],
      graphs: [
        {
          id: `g_${id}`,
          name: "g",
          kind: "timeline" as const,
          nodes: Array.from({ length: nodeCount }, (_, i) => ({
            id: `n_${id}_${i}`,
            kind: "mapPortal" as const,
            title: "p",
            position: { x: 0, y: 0 },
            options: [],
          })),
        },
      ],
    },
  };
}

describe("persistence load priority", () => {
  beforeEach(() => {
    installLocalStorageMock();
    localStorage.removeItem("juben_workspace_v1");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("prefers remote when remote has content and is newer", async () => {
    const remote = {
      version: 1 as const,
      savedAt: 9000,
      currentProjectId: "remote",
      projects: [projectWithNodes("remote", "磁盘项目", 2, 9000)],
    };
    const local = {
      version: 1 as const,
      savedAt: 5000,
      currentProjectId: "local",
      projects: [projectWithNodes("local", "浏览器项目", 1, 5000)],
    };
    writeLocalWorkspace(local);

    mockFetch({
      "/api/health": () =>
        new Response(JSON.stringify({ ok: true, storage: { workspaceFile: "/tmp/workspace.json" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      "/api/workspace": () =>
        new Response(JSON.stringify({ workspace: remote }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    const result = await loadFromStorage();
    expect(result.storageOnline).toBe(true);
    expect(result.source).toBe("merged");
    expect(result.workspace?.projects.some((p) => p.id === "remote")).toBe(true);
    expect(result.workspace?.projects.some((p) => p.id === "local")).toBe(true);
    expect(result.shouldSyncDisk).toBe(true);
  });

  it("recovers from localStorage when remote workspace is null", async () => {
    const local = {
      version: 1 as const,
      savedAt: 3000,
      currentProjectId: "local-only",
      projects: [projectWithNodes("local-only", "离线缓存", 3, 3000)],
    };
    writeLocalWorkspace(local);

    mockFetch({
      "/api/health": () =>
        new Response(JSON.stringify({ ok: true, storage: { workspaceFile: "/tmp/workspace.json" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      "/api/workspace": () =>
        new Response(JSON.stringify({ workspace: null }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    const result = await loadFromStorage();
    expect(result.source).toBe("local");
    expect(result.recoveredFromLocal).toBe(true);
    expect(result.shouldSyncDisk).toBe(true);
    expect(result.workspace?.currentProjectId).toBe("local-only");
  });

  it("recovers from local when remote is empty shell", () => {
    const remote = {
      version: 1 as const,
      savedAt: 9000,
      currentProjectId: "empty",
      projects: [
        {
          id: "empty",
          name: "空项目",
          createdAt: 1,
          updatedAt: 9000,
          data: { variables: [], quests: [], graphs: [{ id: "tl", name: "t", kind: "timeline" as const, nodes: [] }] },
        },
      ],
    };
    const local = {
      version: 1 as const,
      savedAt: 3000,
      currentProjectId: "rich",
      projects: [projectWithNodes("rich", "有内容", 4, 3000)],
    };
    const resolved = resolveBootWorkspace(remote, local);
    expect(resolved.source).toBe("merged");
    expect(resolved.recoveredFromLocal).toBe(true);
    expect(resolved.workspace?.projects.some((p) => p.id === "rich")).toBe(true);
  });

  it("loads localStorage when storage is offline", async () => {
    const local = {
      version: 1 as const,
      savedAt: 3000,
      currentProjectId: "local-only",
      projects: [projectWithNodes("local-only", "离线缓存", 1, 3000)],
    };
    writeLocalWorkspace(local);

    mockFetch({
      "/api/health": () => new Response("offline", { status: 503 }),
    });

    const result = await loadFromStorage();
    expect(result.storageOnline).toBe(false);
    expect(result.source).toBe("local");
    expect(result.workspace?.currentProjectId).toBe("local-only");
  });

  it("mergeWorkspaces keeps both project ids", () => {
    const a = {
      version: 1 as const,
      savedAt: 100,
      currentProjectId: "a",
      projects: [projectWithNodes("a", "A", 1, 100)],
    };
    const b = {
      version: 1 as const,
      savedAt: 200,
      currentProjectId: "b",
      projects: [projectWithNodes("b", "B", 2, 200)],
    };
    const merged = mergeWorkspaces(a, b);
    expect(merged.projects.some((p) => p.id === "a")).toBe(true);
    expect(merged.projects.some((p) => p.id === "b")).toBe(true);
  });

  it("saveToStorageRemote throws when PUT fails", async () => {
    mockFetch({
      "/api/workspace": (_url, init) => {
        if (init?.method === "PUT") {
          return new Response("write failed", { status: 500 });
        }
        return new Response("{}", { status: 200 });
      },
    });

    const ws = {
      version: 1 as const,
      savedAt: Date.now(),
      currentProjectId: "p1",
      projects: [
        {
          id: "p1",
          name: "t",
          createdAt: 1,
          updatedAt: 2,
          data: { variables: [], quests: [], graphs: [] },
        },
      ],
    };

    await expect(saveToStorageRemote(ws)).rejects.toThrow(/PUT.*failed/i);
  });
});
