import type { PlanStepPayload, RequirementsBrief } from "./types";

const BRIEF_MARKER = '"type": "requirementsBrief"';
const BRIEF_MARKER_ALT = '"type":"requirementsBrief"';
const PLAN_MARKER = '"type": "planStep"';
const PLAN_MARKER_ALT = '"type":"planStep"';

/** 从 discuss 阶段流式/完整文本中提取 requirementsBrief */
export function extractRequirementsBrief(text: string): RequirementsBrief | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/g);
  if (fenced) {
    for (const block of fenced) {
      const inner = block.replace(/```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = tryParseBrief(inner);
      if (parsed) return parsed;
    }
  }
  const start = text.indexOf("{");
  if (start >= 0) {
    const slice = text.slice(start);
    const parsed = tryParseBrief(slice);
    if (parsed) return parsed;
  }
  if (text.includes(BRIEF_MARKER) || text.includes(BRIEF_MARKER_ALT)) {
    const jsonStart = text.indexOf("{", text.indexOf("requirementsBrief") - 20);
    if (jsonStart >= 0) {
      const parsed = tryParseBrief(text.slice(jsonStart));
      if (parsed) return parsed;
    }
  }
  return null;
}

/** 从 discuss 阶段文本中提取 planStep */
export function extractPlanStep(text: string): PlanStepPayload | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/g);
  if (fenced) {
    for (const block of fenced) {
      const inner = block.replace(/```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = tryParsePlanStep(inner);
      if (parsed) return parsed;
    }
  }
  const start = text.indexOf("{");
  if (start >= 0) {
    const parsed = tryParsePlanStep(text.slice(start));
    if (parsed) return parsed;
  }
  if (text.includes(PLAN_MARKER) || text.includes(PLAN_MARKER_ALT)) {
    const jsonStart = text.indexOf("{", text.indexOf("planStep") - 20);
    if (jsonStart >= 0) {
      const parsed = tryParsePlanStep(text.slice(jsonStart));
      if (parsed) return parsed;
    }
  }
  return null;
}

function tryParsePlanStep(raw: string): PlanStepPayload | null {
  try {
    const obj = JSON.parse(raw) as PlanStepPayload;
    if (obj?.type === "planStep" && obj.stepId && obj.title) return normalizePlanStep(obj);
  } catch {
    const extracted = extractBalancedJson(raw);
    if (extracted) {
      try {
        const obj = JSON.parse(extracted) as PlanStepPayload;
        if (obj?.type === "planStep" && obj.stepId && obj.title) return normalizePlanStep(obj);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function normalizePlanStep(p: PlanStepPayload): PlanStepPayload {
  return {
    type: "planStep",
    stepId: p.stepId,
    title: p.title,
    prompt: p.prompt,
    selectionMode: p.selectionMode ?? "single",
    options: Array.isArray(p.options) ? p.options : undefined,
    allowCustom: p.allowCustom,
    customPlaceholder: p.customPlaceholder,
    min: p.min,
    max: p.max,
    required: p.required !== false,
  };
}

/** 剥离 assistant 消息中的 JSON 块，仅保留可读文本 */
export function stripStructuredJsonBlocks(text: string): string {
  let out = text.replace(/```(?:json)?\s*[\s\S]*?```/g, "").trim();
  const plan = extractPlanStep(text);
  const brief = extractRequirementsBrief(text);
  if (plan && !out) return plan.prompt ?? plan.title;
  if (brief && !out) return brief.storyGoal ?? "需求已确认";
  return out;
}

function tryParseBrief(raw: string): RequirementsBrief | null {
  try {
    const obj = JSON.parse(raw) as RequirementsBrief;
    if (obj?.type === "requirementsBrief") return normalizeBrief(obj);
  } catch {
    // try balanced brace extraction
    const extracted = extractBalancedJson(raw);
    if (extracted) {
      try {
        const obj = JSON.parse(extracted) as RequirementsBrief;
        if (obj?.type === "requirementsBrief") return normalizeBrief(obj);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function extractBalancedJson(s: string): string | null {
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function normalizeBrief(b: RequirementsBrief): RequirementsBrief {
  return {
    type: "requirementsBrief",
    npcUid: b.npcUid,
    storyGoal: b.storyGoal ?? "",
    character: b.character ?? {},
    beats: Array.isArray(b.beats) ? b.beats : [],
    constraints: Array.isArray(b.constraints) ? b.constraints : [],
  };
}

export function isValidBrief(b: RequirementsBrief | null | undefined): b is RequirementsBrief {
  return (
    !!b &&
    b.type === "requirementsBrief" &&
    !!(b.storyGoal?.trim() || (b.beats && b.beats.length > 0))
  );
}

function extractStreamOpsFromText(text: string): import("./types").StreamOp[] {
  const ops: import("./types").StreamOp[] = [];
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("//")) return ops;

  const tryPush = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) tryPush(item);
      return;
    }
    if (value && typeof value === "object" && "op" in (value as object)) {
      ops.push(value as import("./types").StreamOp);
    }
  };

  try {
    tryPush(JSON.parse(trimmed));
    if (ops.length > 0) return ops;
  } catch {
    /* fall through */
  }

  let depth = 0;
  let start = -1;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        const slice = trimmed.slice(start, i + 1);
        start = -1;
        try {
          tryPush(JSON.parse(slice));
        } catch {
          /* ignore fragment */
        }
      }
    }
  }
  return ops;
}

/** NDJSON 行缓冲解析器（generate 阶段） */
export class NdjsonLineParser {
  private buffer = "";
  private warnings: string[] = [];

  push(chunk: string): { ops: import("./types").StreamOp[]; warnings: string[] } {
    this.buffer += chunk;
    this.buffer = this.buffer.replace(/```(?:json|ndjson)?\s*/gi, "").replace(/```/g, "");
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? "";
    const ops: import("./types").StreamOp[] = [];
    for (const line of lines) {
      const parsed = extractStreamOpsFromText(line);
      if (parsed.length > 0) {
        ops.push(...parsed);
      } else if (line.trim() && !line.trim().startsWith("//")) {
        this.warnings.push(`跳过无效行: ${line.trim().slice(0, 80)}`);
      }
    }
    const pending = this.buffer.trim();
    if (pending.startsWith("[") || (pending.startsWith("{") && pending.includes('"op"'))) {
      const buffered = extractStreamOpsFromText(pending);
      if (buffered.length > 0) {
        ops.push(...buffered);
        this.buffer = "";
      }
    }
    return { ops, warnings: [...this.warnings] };
  }

  flush(): { ops: import("./types").StreamOp[]; warnings: string[] } {
    const trimmed = this.buffer.trim();
    this.buffer = "";
    const ops = extractStreamOpsFromText(trimmed);
    if (ops.length === 0 && trimmed && !trimmed.startsWith("//")) {
      this.warnings.push(`尾部无效: ${trimmed.slice(0, 80)}`);
    }
    return { ops, warnings: [...this.warnings] };
  }

  reset() {
    this.buffer = "";
    this.warnings = [];
  }
}
