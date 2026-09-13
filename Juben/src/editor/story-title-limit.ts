/** 任务链 / NPC 显示名最大字数（含中文，按字符计） */
export const STORY_TITLE_MAX_LEN = 7;

/** 供 brief.constraints 使用的标题长度标记 */
export function storyTitleMaxLenConstraint(): string {
  return `titleMaxLen:${STORY_TITLE_MAX_LEN}`;
}

/** 截断为不超过 max 字的剧情短标题（去首尾空白） */
export function clampStoryTitle(raw: string, max = STORY_TITLE_MAX_LEN): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}

/** 校验标题长度（编辑器 / 导出审计） */
export function storyTitleTooLong(raw: string, max = STORY_TITLE_MAX_LEN): boolean {
  return String(raw ?? "").trim().length > max;
}
