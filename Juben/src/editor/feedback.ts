/**
 * 统一用户反馈文案与弹窗入口（基于 useModal）
 */
import { appAlert, appConfirm } from "./useModal";

export function showError(title: string, reason: string, hint?: string): Promise<void> {
  const body = hint ? `${reason}\n\n修正方向：${hint}` : reason;
  return appAlert(body, title);
}

export function showSuccess(message: string, title = "完成"): Promise<void> {
  return appAlert(message, title);
}

export function confirmDestructive(message: string, title = "确认操作"): Promise<boolean> {
  return appConfirm(`${message}\n\n此操作不可自动撤销，请确认。`, title);
}

export function showSaveConflict(diskSavedAt: number | undefined): Promise<"reload" | "overwrite" | "cancel"> {
  return appConfirm(
    `磁盘 workspace 已被其他标签页更新${diskSavedAt != null ? `（savedAt=${diskSavedAt}）` : ""}。\n\n确定 = 重新加载远端；取消 = 强制覆盖本地。`,
    "保存冲突",
  ).then((reload) => (reload ? "reload" : "overwrite"));
}

export function showValidationError(details: string): Promise<void> {
  return showError("保存失败", "project.data 校验未通过，未写入磁盘。", details);
}

export function showExportFailed(errors: string[]): Promise<void> {
  const top = errors.slice(0, 5).join("\n");
  return showError("导出失败", top || "运行时 map 校验未通过", "请使用「全局检查修复」或 Inspector 修正标红项");
}

export function showPublishFailed(reason: string): Promise<void> {
  return showError("发布失败", reason, "请确认 storage 服务已启动且目标路径可写");
}

export function showAiNotConfigured(): Promise<void> {
  return showError(
    "AI 不可用",
    "未配置 DEEPSEEK_API_KEY 环境变量。",
    "复制 .env.example 为 .env 并填入密钥后重启 npm run dev",
  );
}
