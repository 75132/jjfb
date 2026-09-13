/** DeepSeek API 配置 — apiKey 从环境变量读取，禁止硬编码 */

/** 官方 V4.1-Flash 模型名；兼容用户常写的别名 */
export function resolveDeepSeekModel(raw: string): string {
  const m = String(raw ?? "").trim().toLowerCase();
  if (!m) return "deepseek-flash";
  // 用户口中的 v4.1 flash / v4.1flash → 官方 id
  if (
    m === "deepseek-flash" ||
    m === "deepseek-v4.1-flash" ||
    m === "deepseek-v4.1flash" ||
    m === "deepseek-v4-flash" ||
    m === "deepseek-v4-flash-vision-exp" ||
    m === "deepseek-chat" ||
    m === "v4.1-flash" ||
    m === "v4.1flash" ||
    m === "flash"
  ) {
    return "deepseek-flash";
  }
  return String(raw).trim();
}

/** 拼官方 Chat Completions URL（文档为 /chat/completions，兼容 /v1） */
export function deepSeekChatCompletionsUrl(baseUrl: string): string {
  const base = String(baseUrl ?? "https://api.deepseek.com").trim().replace(/\/+$/, "");
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`;
  if (/\/chat\/completions$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

export const DEEPSEEK_CONFIG = {
  get apiKey(): string {
    return String(process.env.DEEPSEEK_API_KEY ?? "").trim();
  },
  baseUrl: String(process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").trim(),
  /** 默认 deepseek-flash = DeepSeek-V4.1-Flash */
  get model(): string {
    return resolveDeepSeekModel(process.env.DEEPSEEK_MODEL ?? "deepseek-flash");
  },
  /**
   * thinking 默认关闭：写 NDJSON 时开启易长时间无 content、浏览器像卡死/崩溃。
   * 需要质量推理时设 DEEPSEEK_THINKING=enabled。
   */
  thinking: {
    type: (String(process.env.DEEPSEEK_THINKING ?? "disabled").trim().toLowerCase() === "enabled"
      ? "enabled"
      : "disabled") as "enabled" | "disabled",
  },
  temperature: Number(process.env.DEEPSEEK_TEMPERATURE ?? 0.9),
  maxTokens: Number(process.env.DEEPSEEK_MAX_TOKENS ?? 8192),
};

/** AI 服务是否已配置（apiKey 非空） */
export function isDeepSeekConfigured(): boolean {
  return DEEPSEEK_CONFIG.apiKey.length > 0;
}
