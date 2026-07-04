import type { Response } from "express";
import { DEEPSEEK_CONFIG, isDeepSeekConfigured } from "./deepseek-config";
import { buildMessagesForPhase } from "./ai-prompts";
import type { StoryStreamRequest } from "./ai-types";

export async function streamDeepSeekToResponse(req: StoryStreamRequest, res: Response): Promise<void> {
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

  const upstream = await fetch(`${DEEPSEEK_CONFIG.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_CONFIG.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    res.status(upstream.status).json({
      error: {
        code: "DEEPSEEK_ERROR",
        message: `DeepSeek API ${upstream.status}: ${errText.slice(0, 500)}`,
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
