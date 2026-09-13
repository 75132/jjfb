/**
 * 工作区持久化 composable — 从 EditorRoot 抽离 autosave / 冲突 / hydration
 */
import type { Ref } from "vue";
import type { ProjectData } from "../../types";
import {
  loadFromStorage,
  saveToStorage,
  setLastKnownRemoteSavedAt,
  type PersistedWorkspace,
  type PersistedWorkspaceProject,
} from "../persistence";
import { showError, showValidationError } from "../feedback";
import { appConfirm } from "../useModal";

export type SaveStatus = "idle" | "saving" | "synced" | "local-only" | "error";

export type WorkspacePersistDeps = {
  workspaceHydrated: Ref<boolean>;
  currentProjectId: Ref<string | null>;
  projects: Ref<PersistedWorkspaceProject[]>;
  project: Ref<ProjectData>;
  saveStatus: Ref<SaveStatus>;
  saveStatusDetail: Ref<string>;
  storageOnline: Ref<boolean>;
  workspaceFilePath: Ref<string>;
  bootRecoveryMessage: Ref<string>;
  sanitizeProjectData: (data: ProjectData, report: unknown) => ProjectData;
  createIntegrityReport: () => unknown;
  sumIntegrityReport: (report: unknown) => number;
  cloneProject: (data: ProjectData) => ProjectData;
  refreshProjectExportHealth: (data: ProjectData) => void;
  applyLoadedWorkspace: (ws: PersistedWorkspace, source?: string) => void;
};

export function buildWorkspacePayload(deps: WorkspacePersistDeps) {
  const meta = deps.projects.value[0];
  const id = deps.currentProjectId.value ?? meta?.id ?? `proj_${crypto.randomUUID()}`;
  const now = Date.now();
  const entry: PersistedWorkspaceProject = {
    id,
    name: meta?.name ?? "未命名",
    createdAt: meta?.createdAt ?? now,
    updatedAt: now,
    data: deps.cloneProject(deps.project.value),
  };
  deps.projects.value = [entry];
  deps.currentProjectId.value = id;
  return {
    version: 1 as const,
    savedAt: now,
    currentProjectId: id,
    projects: [entry],
  };
}

export function prepareCurrentProjectForSave(deps: WorkspacePersistDeps): PersistedWorkspace | null {
  if (!deps.currentProjectId.value && deps.projects.value.length === 0) return null;
  const report = deps.createIntegrityReport();
  const safeProject = deps.sanitizeProjectData(deps.project.value, report);
  const fixed = deps.sumIntegrityReport(report);
  if (fixed > 0) deps.project.value = safeProject;
  const dataToSave = fixed > 0 ? safeProject : deps.project.value;
  deps.refreshProjectExportHealth(dataToSave);
  const payload = buildWorkspacePayload(deps);
  payload.projects[0]!.data = deps.cloneProject(dataToSave);
  deps.projects.value = [payload.projects[0]!];
  return payload;
}

export async function persistWorkspaceAsync(deps: WorkspacePersistDeps, forceOverwrite = false): Promise<void> {
  if (!deps.workspaceHydrated.value) return;
  const payload = prepareCurrentProjectForSave(deps);
  if (!payload) return;
  deps.saveStatus.value = "saving";
  try {
    const result = await saveToStorage(payload, { forceOverwrite });
    if (result.remote) {
      deps.storageOnline.value = true;
      deps.saveStatus.value = "synced";
      deps.saveStatusDetail.value = deps.workspaceFilePath.value || "Juben/data/workspace.json";
      deps.bootRecoveryMessage.value = "";
    } else if (result.errorCode === "CONFLICT") {
      if (result.diskSavedAt != null) setLastKnownRemoteSavedAt(result.diskSavedAt);
      deps.saveStatus.value = "error";
      deps.saveStatusDetail.value = "远端 workspace 已更新（双标签页冲突）";
      if (forceOverwrite) {
        await showError(
          "保存冲突",
          `无法覆盖远端 workspace（savedAt=${result.diskSavedAt ?? "?"}）。`,
          "请刷新页面后重试。",
        );
        return;
      }
      const reload = await appConfirm(
        `磁盘 workspace 已被其他标签页更新（savedAt=${result.diskSavedAt ?? "?"}）。\n\n重新加载远端数据？（取消则强制覆盖本机编辑）`,
        "保存冲突",
      );
      if (reload) {
        const loaded = await loadFromStorage();
        if (loaded.workspace) {
          deps.applyLoadedWorkspace(loaded.workspace, loaded.source);
          setLastKnownRemoteSavedAt(loaded.workspace.savedAt ?? 0);
        }
        deps.saveStatus.value = "synced";
        deps.saveStatusDetail.value = "已从远端重新加载";
      } else {
        await persistWorkspaceAsync(deps, true);
      }
    } else if (result.errorCode === "VALIDATION") {
      deps.saveStatus.value = "error";
      deps.saveStatusDetail.value = result.error ?? "project.data 校验失败";
      const details = (result.validationDetails ?? []).slice(0, 5).map((d) => `${d.path}: ${d.message}`).join("\n");
      void showValidationError(details);
    } else if (!deps.storageOnline.value) {
      deps.saveStatus.value = "local-only";
      deps.saveStatusDetail.value = result.error || "请运行 npm run dev 以写入 workspace.json";
    } else {
      deps.saveStatus.value = "error";
      deps.saveStatusDetail.value = result.error || "写入 workspace.json 失败";
    }
  } catch (e) {
    deps.saveStatus.value = "error";
    deps.saveStatusDetail.value = e instanceof Error ? e.message : String(e);
  }
}

export function useWorkspacePersistence(deps: WorkspacePersistDeps) {
  let saveChain: Promise<void> = Promise.resolve();
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  function persistWorkspace(forceOverwrite = false) {
    saveChain = saveChain.then(() => persistWorkspaceAsync(deps, forceOverwrite));
  }

  function flushCurrentProjectSave(forceOverwrite = false) {
    persistWorkspace(forceOverwrite);
  }

  function scheduleCurrentProjectSave(autosaveSuspended: Ref<boolean>, throttleMs: number) {
    if (!deps.workspaceHydrated.value || !deps.currentProjectId.value || autosaveSuspended.value) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      flushCurrentProjectSave();
    }, throttleMs);
  }

  function clearAutosaveTimer() {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
  }

  return {
    prepareCurrentProjectForSave: () => prepareCurrentProjectForSave(deps),
    persistWorkspaceAsync: (force?: boolean) => persistWorkspaceAsync(deps, force),
    flushCurrentProjectSave,
    scheduleCurrentProjectSave,
    clearAutosaveTimer,
    awaitSaveChain: () => saveChain,
  };
}
