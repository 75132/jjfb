import type { AiStoryMode, AiStoryPhase, ChatMessage, RequirementsBrief, StoryAiContext } from "./types";

export type StreamCallbacks = {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

export type StoryStreamParams = {
  phase: AiStoryPhase;
  mode: AiStoryMode;
  messages: ChatMessage[];
  context: StoryAiContext;
  requirementsBrief?: RequirementsBrief;
  focusNpcUid?: string;
  signal?: AbortSignal;
};

const API_BASE = (import.meta.env.VITE_STORAGE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

export async function streamStoryAi(params: StoryStreamParams, callbacks: StreamCallbacks): Promise<void> {
  const url = `${API_BASE}/api/ai/story/stream`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: params.signal,
    });
  } catch (e) {
    callbacks.onError(e instanceof Error ? e.message : String(e));
    return;
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg =
      (errBody as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    callbacks.onError(msg);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError("响应无 body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as { content?: string };
            if (parsed.content) callbacks.onChunk(parsed.content);
          } catch {
            // ignore
          }
        }
      }
    }
    callbacks.onDone();
  } catch (e) {
    if (params.signal?.aborted) {
      callbacks.onDone();
      return;
    }
    callbacks.onError(e instanceof Error ? e.message : String(e));
  }
}
