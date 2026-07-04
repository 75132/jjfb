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
  projects: WorkspaceProject[];
};

export function isWorkspacePayload(input: unknown): input is WorkspacePayload {
  if (!input || typeof input !== "object") return false;
  const v = input as Partial<WorkspacePayload>;
  if (v.version !== 1) return false;
  if (typeof v.savedAt !== "number") return false;
  if (!(typeof v.currentProjectId === "string" || v.currentProjectId === null)) return false;
  if (!Array.isArray(v.projects)) return false;
  for (const p of v.projects) {
    if (!p || typeof p !== "object") return false;
    const x = p as Partial<WorkspaceProject>;
    if (typeof x.id !== "string") return false;
    if (typeof x.name !== "string") return false;
    if (typeof x.createdAt !== "number") return false;
    if (typeof x.updatedAt !== "number") return false;
    if (typeof x.data !== "object" || !x.data) return false;
  }
  return true;
}
