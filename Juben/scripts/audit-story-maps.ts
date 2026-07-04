/**
 * 审计已发布剧情 map JSON 的 defer 契约与校验状态。
 *
 * 用法:
 *   npx tsx scripts/audit-story-maps.ts
 *   npx tsx scripts/audit-story-maps.ts --fix
 *   npx tsx scripts/audit-story-maps.ts path/to/map_0.json --fix --publish
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fixRuntimeMapDeferContracts,
  isDeferChoiceOption,
  shouldRuntimeCompleteChoice,
  summarizeExportedChoiceEvents,
} from "../src/editor/choice-option-defer";
import { validateRuntimeConfig } from "../src/editor/map-export-pipeline";
import type { RuntimeMapConfig } from "../src/editor/map-runtime";
import { publishMapDual } from "../server/map-runtime-publish";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

const defaultGlobDir = path.join(repoRoot, "assets", "resources", "Sample", "剧情脚本");

function listDefaultMaps(): string[] {
  if (!fs.existsSync(defaultGlobDir)) return [];
  return fs
    .readdirSync(defaultGlobDir)
    .filter((f) => f.startsWith("map_") && f.endsWith(".json"))
    .map((f) => path.join(defaultGlobDir, f));
}

function auditDeferIssues(config: RuntimeMapConfig): string[] {
  const issues: string[] = [];
  const scripts = config.client?.choiceScripts ?? {};
  for (const npc of config.npcs ?? []) {
    for (const ev of npc.events ?? []) {
      if (ev.eventType !== "choice" && ev.eventType !== "teleport") continue;
      const sid = ev.client?.choiceScriptId;
      if (!sid) continue;
      const script = scripts[sid];
      if (!script?.options?.length) continue;
      const allowed = ev.server?.allowedChoiceIds ?? [];
      for (let i = 0; i < script.options.length; i++) {
        const opt = script.options[i]!;
        const ctx = { optionIndex: i, peerOptions: script.options };
        const defer = isDeferChoiceOption(opt, ctx);
        if (defer && allowed.includes(opt.id)) {
          issues.push(
            `${npc.npcUid ?? "?"} event ${ev.eventId}: defer「${opt.text ?? opt.id}」仍在 allowedChoiceIds`,
          );
        }
        if (defer && (opt.completesEvent !== false || opt.forcedResult !== "block")) {
          issues.push(
            `${npc.npcUid ?? "?"} event ${ev.eventId}: 暂缓选项「${opt.text}」未 block（completesEvent=${String(opt.completesEvent)}）`,
          );
        }
        if (!defer && shouldRuntimeCompleteChoice(opt, allowed) && /暂缓|拒绝|还没准备好/.test(opt.text ?? "")) {
          issues.push(
            `${npc.npcUid ?? "?"} event ${ev.eventId}: 暂缓文案「${opt.text}」未 block（completesEvent=${String(opt.completesEvent)}）`,
          );
        }
      }
    }
  }
  return issues;
}

function main() {
  const argv = process.argv.slice(2);
  const fix = argv.includes("--fix");
  const publish = argv.includes("--publish");
  const strict = argv.includes("--strict");
  const paths = argv.filter((a) => !a.startsWith("--")).map((p) => path.resolve(p));
  const sources = paths.length ? paths : listDefaultMaps();

  if (!sources.length) {
    console.error("未找到 map JSON。请传入路径或确保 Sample/剧情脚本 存在 map_*.json");
    process.exit(1);
  }

  let totalIssues = 0;
  let exitCode = 0;

  for (const src of sources) {
    if (!fs.existsSync(src)) {
      console.warn("跳过（不存在）:", src);
      continue;
    }
    console.log(`\n=== ${path.relative(repoRoot, src)} ===`);
    const raw = JSON.parse(fs.readFileSync(src, "utf-8")) as RuntimeMapConfig;

    const deferIssues = auditDeferIssues(raw);
    const validation = validateRuntimeConfig(raw);
    if (deferIssues.length) {
      totalIssues += deferIssues.length;
      console.log("Defer 契约问题:");
      for (const m of deferIssues) console.log(`  [WARN] ${m}`);
    } else {
      console.log("Defer 契约: OK");
    }
    if (!validation.ok) {
      console.log("Pipeline 校验未通过:");
      for (const m of validation.manifestIssues.filter((i) => i.level === "error")) {
        console.log(`  [ERROR] ${m.path}: ${m.message}`);
        exitCode = 1;
      }
    } else {
      console.log("Pipeline 校验: OK");
    }

    const summary = summarizeExportedChoiceEvents(raw);
    if (summary.length) {
      console.log("选项摘要:");
      for (const row of summary) {
        console.log(`  ${row.npcUid} #${row.eventId}`);
        for (const line of row.options) console.log(`    ${line}`);
      }
    }

    if (fix && deferIssues.length) {
      const result = fixRuntimeMapDeferContracts(raw);
      fs.writeFileSync(src, `${JSON.stringify(raw, null, 2)}\n`, "utf-8");
      console.log(
        `已修补: options=${result.optionsFixed} allowed=${result.allowedFixed} effects=${result.effectsStripped}`,
      );
      const after = auditDeferIssues(raw);
      if (after.length) {
        console.warn("修补后仍有问题:", after.length);
        exitCode = 1;
      }
    }

    if (publish) {
      const pub = publishMapDual(raw, {
        repoRoot,
        overwrite: true,
        writeCocos: true,
        writeServer: true,
      });
      if (!pub.ok) {
        console.error("双写失败:", pub.message);
        exitCode = 1;
      } else {
        console.log(`双写 Cocos: ${pub.cocos?.relativePath}`);
        console.log(`双写 Server: ${pub.server?.relativePath}`);
      }
    }
  }

  console.log(`\n合计 defer 问题: ${totalIssues}`);
  if (strict && totalIssues > 0 && !fix) exitCode = 1;
  process.exit(exitCode);
}

main();
