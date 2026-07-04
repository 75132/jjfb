/** DeepSeek API 配置 — apiKey 从环境变量读取，禁止硬编码 */
export const DEEPSEEK_CONFIG = {
  get apiKey(): string {
    return String(process.env.DEEPSEEK_API_KEY ?? "").trim();
  },
  baseUrl: String(process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").trim(),
  model: String(process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro").trim(),
  thinking: { type: "disabled" as const },
  temperature: Number(process.env.DEEPSEEK_TEMPERATURE ?? 1.0),
  maxTokens: Number(process.env.DEEPSEEK_MAX_TOKENS ?? 8192),
};

/** AI 服务是否已配置（apiKey 非空） */
export function isDeepSeekConfigured(): boolean {
  return DEEPSEEK_CONFIG.apiKey.length > 0;
}
