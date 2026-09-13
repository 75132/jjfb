import type { Response as ExpressResponse } from "express";
import {
  DEEPSEEK_CONFIG,
  deepSeekChatCompletionsUrl,
  isDeepSeekConfigured,
} from "./deepseek-config";
import { buildMessagesForPhase } from "./ai-prompts";
import type { StoryStreamRequest } from "./ai-types";

export async function streamDeepSeekToResponse(req: StoryStreamRequest, res: ExpressResponse): Promise<void> {
  if (!isDeepSeekConfigured()) {
    res.status(503).json({
      error: {
        code: "AI_NOT_CONFIGURED",
        message: "未配置 DEEPSEEK_API_KEY 环境变量，AI 功能不可用。请参考 .env.example 配置。",
      },
    });
    return;
  }

  const userMessages = (req.messages ?? []).filter(
    (m): m is { role: "user" | "assistant"; content: string } =>
      m.role === "user" || m.role === "assistant",
  );

  if (req.phase === "generate" && !req.requirementsBrief) {
    res.status(400).json({
      error: { code: "MISSING_BRIEF", message: "generate phase requires requirementsBrief" },
    });
    return;
  }

  const messages = buildMessagesForPhase(
    req.phase,
    req.mode,
    req.context,
    userMessages,
    req.requirementsBrief,
    req.focusNpcUid,
  );

  const body = {
    model: DEEPSEEK_CONFIG.model,
    messages,
    stream: true,
    temperature: DEEPSEEK_CONFIG.temperature,
    max_tokens: DEEPSEEK_CONFIG.maxTokens,
    thinking: DEEPSEEK_CONFIG.thinking,
  };

  // 官方文档：POST https://api.deepseek.com/chat/completions
  const upstreamUrl = deepSeekChatCompletionsUrl(DEEPSEEK_CONFIG.baseUrl);
  const upstreamAbort = new AbortController();
  const upstreamTimer = setTimeout(() => upstreamAbort.abort(), 180_000);
  let upstream: globalThis.Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_CONFIG.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: upstreamAbort.signal,
    });
  } catch (e) {
    clearTimeout(upstreamTimer);
    const aborted = e instanceof Error && e.name === "AbortError";
    res.status(aborted ? 504 : 502).json({
      error: {
        code: aborted ? "DEEPSEEK_TIMEOUT" : "DEEPSEEK_FETCH_FAILED",
        message: aborted
          ? "DeepSeek 请求超时（180s）。可稍后重试，或在 .env 设 DEEPSEEK_THINKING=disabled。"
          : `DeepSeek 连接失败: ${e instanceof Error ? e.message : String(e)}`,
        model: DEEPSEEK_CONFIG.model,
        endpoint: upstreamUrl,
      },
    });
    return;
  }
  clearTimeout(upstreamTimer);

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    const authHint =
      upstream.status === 401
        ? " API Key 无效或已失效：请到 https://platform.deepseek.com/api_keys 新建密钥，写入 Juben/.env 的 DEEPSEEK_API_KEY 后重启 npm run dev。"
        : "";
    res.status(upstream.status).json({
      error: {
        code: upstream.status === 401 ? "DEEPSEEK_AUTH" : "DEEPSEEK_ERROR",
        message: `DeepSeek API ${upstream.status}: ${errText.slice(0, 400)}${authHint}`,
        model: DEEPSEEK_CONFIG.model,
        endpoint: upstreamUrl,
      },
    });
    return;
  }

  if (!upstream.body) {
    res.status(502).json({ error: { code: "NO_BODY", message: "DeepSeek returned empty body" } });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          res.write("data: [DONE]\n\n");
          continue;
        }
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch {
          // skip malformed chunk
        }
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: { code: "STREAM_FAILED", message: String(e) } });
    } else {
      res.end();
    }
  }
}
