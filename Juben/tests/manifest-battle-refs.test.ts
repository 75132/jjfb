import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getBundledManifestBattleRefs } from "../src/editor/client-runtime-manifest";

describe("client-runtime-manifest", () => {
  it("bundled battleRefs align with Cocos battle_refs.json", () => {
    const repoRoot = path.resolve(import.meta.dirname, "../..");
    const battleRefsPath = path.join(repoRoot, "server", "data", "battle_refs.json");
    if (!fs.existsSync(battleRefsPath)) {
      // CI 外或无 server 目录时跳过
      return;
    }
    const battleRefs = Object.keys(JSON.parse(fs.readFileSync(battleRefsPath, "utf-8")) as Record<string, unknown>);
    const manifestRefs = getBundledManifestBattleRefs();
    for (const ref of manifestRefs) {
      expect(battleRefs).toContain(ref);
    }
  });
});
