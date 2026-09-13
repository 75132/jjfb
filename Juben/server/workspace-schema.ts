export type WorkspaceProject = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: unknown;
};

export type WorkspacePayload = {
  version: 1;
  savedAt: number;
  currentProjectId: string | null;
  /** 单项目模式：运行时最多保留 1 个；读入时可暂时 >1，写盘前会收敛 */
  projects: WorkspaceProject[];
};

function isWorkspaceProject(p: unknown): p is WorkspaceProject {
  if (!p || typeof p !== "object") return false;
  const x = p as Partial<WorkspaceProject>;
  return (
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    typeof x.createdAt === "number" &&
    typeof x.updatedAt === "number" &&
    typeof x.data === "object" &&
    !!x.data
  );
}

/** 将历史多项目收敛为 1 个（优先 currentProjectId）。 */
export function normalizeWorkspaceToSingleProject(workspace: WorkspacePayload): WorkspacePayload {
  const projects = workspace.projects.filter(isWorkspaceProject);
  if (projects.length <= 1) {
    const only = projects[0] ?? null;
    return {
      ...workspace,
      currentProjectId: only?.id ?? null,
      projects: only ? [only] : [],
    };
  }
  const preferred =
    (workspace.currentProjectId && projects.find((p) => p.id === workspace.currentProjectId)) ||
    projects[0]!;
  return {
    ...workspace,
    currentProjectId: preferred.id,
    projects: [preferred],
  };
}

export function isWorkspacePayload(input: unknown): input is WorkspacePayload {
  if (!input || typeof input !== "object") return false;
  const v = input as Partial<WorkspacePayload>;
  if (v.version !== 1) return false;
  if (typeof v.savedAt !== "number") return false;
  if (!(typeof v.currentProjectId === "string" || v.currentProjectId === null)) return false;
  if (!Array.isArray(v.projects)) return false;
  for (const p of v.projects) {
    if (!isWorkspaceProject(p)) return false;
  }
  return true;
}
