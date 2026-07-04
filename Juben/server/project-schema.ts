/** 轻量 ProjectData 运行时校验（workspace PUT 时使用） */

export type ProjectValidationError = {
  path: string;
  message: string;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function validateArrayField(
  data: Record<string, unknown>,
  key: string,
  projectPath: string,
  errors: ProjectValidationError[],
): void {
  if (!(key in data)) {
    errors.push({ path: `${projectPath}.${key}`, message: `缺少必填字段 ${key}` });
    return;
  }
  if (!Array.isArray(data[key])) {
    errors.push({ path: `${projectPath}.${key}`, message: `${key} 须为数组` });
  }
}

function validateGraphIds(graphs: unknown[], projectPath: string, errors: ProjectValidationError[]): void {
  for (let i = 0; i < graphs.length; i++) {
    const g = graphs[i];
    if (!g || typeof g !== "object") {
      errors.push({ path: `${projectPath}.graphs[${i}]`, message: "graph 须为对象" });
      continue;
    }
    const gx = g as Record<string, unknown>;
    if (!isNonEmptyString(gx.id)) {
      errors.push({ path: `${projectPath}.graphs[${i}].id`, message: "graph.id 须为非空字符串" });
    }
    if (!Array.isArray(gx.nodes)) {
      errors.push({ path: `${projectPath}.graphs[${i}].nodes`, message: "graph.nodes 须为数组" });
    }
  }
}

function validateGameMaps(gameMaps: unknown[], projectPath: string, errors: ProjectValidationError[]): void {
  for (let i = 0; i < gameMaps.length; i++) {
    const m = gameMaps[i];
    if (!m || typeof m !== "object") {
      errors.push({ path: `${projectPath}.gameMaps[${i}]`, message: "gameMap 须为对象" });
      continue;
    }
    const mx = m as Record<string, unknown>;
    if (!isNonEmptyString(mx.id)) {
      errors.push({ path: `${projectPath}.gameMaps[${i}].id`, message: "gameMap.id 须为非空字符串" });
    }
    if (!isNonEmptyString(mx.graphId)) {
      errors.push({ path: `${projectPath}.gameMaps[${i}].graphId`, message: "gameMap.graphId 须为非空字符串" });
    }
    if (!Array.isArray(mx.npcs)) {
      errors.push({ path: `${projectPath}.gameMaps[${i}].npcs`, message: "gameMap.npcs 须为数组" });
    }
  }
}

function validateQuests(quests: unknown[], projectPath: string, errors: ProjectValidationError[]): void {
  for (let i = 0; i < quests.length; i++) {
    const q = quests[i];
    if (!q || typeof q !== "object") {
      errors.push({ path: `${projectPath}.quests[${i}]`, message: "quest 须为对象" });
      continue;
    }
    const qx = q as Record<string, unknown>;
    if (!isNonEmptyString(qx.id)) {
      errors.push({ path: `${projectPath}.quests[${i}].id`, message: "quest.id 须为非空字符串" });
    }
  }
}

/** 校验单个 project.data（ProjectData 形状） */
export function validateProjectData(data: unknown, projectPath = "projects[].data"): ProjectValidationError[] {
  const errors: ProjectValidationError[] = [];
  if (!data || typeof data !== "object") {
    errors.push({ path: projectPath, message: "project.data 须为对象" });
    return errors;
  }
  const d = data as Record<string, unknown>;
  validateArrayField(d, "graphs", projectPath, errors);
  validateArrayField(d, "quests", projectPath, errors);
  validateArrayField(d, "gameMaps", projectPath, errors);
  validateArrayField(d, "variables", projectPath, errors);

  if (Array.isArray(d.graphs)) validateGraphIds(d.graphs, projectPath, errors);
  if (Array.isArray(d.gameMaps)) validateGameMaps(d.gameMaps, projectPath, errors);
  if (Array.isArray(d.quests)) validateQuests(d.quests, projectPath, errors);

  return errors;
}

export type WorkspaceValidationResult =
  | { ok: true }
  | { ok: false; errors: ProjectValidationError[] };

/** 校验 workspace 内所有 project.data */
export function validateWorkspaceProjects(workspace: {
  projects: Array<{ id: string; data: unknown }>;
}): WorkspaceValidationResult {
  const errors: ProjectValidationError[] = [];
  for (let i = 0; i < workspace.projects.length; i++) {
    const p = workspace.projects[i]!;
    const projectPath = `projects[${i}].data (id=${p.id})`;
    errors.push(...validateProjectData(p.data, projectPath));
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
