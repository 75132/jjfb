import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadDotEnv } from "../server/load-env";

describe("loadDotEnv", () => {
  const prev = { ...process.env };
  let tmpDir = "";

  afterEach(() => {
    process.env = { ...prev };
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = "";
    }
  });

  it("loads .env into process.env when key unset", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "juben-env-"));
    fs.writeFileSync(
      path.join(tmpDir, ".env"),
      "DEEPSEEK_API_KEY=test-from-file\n# comment\nPORT=9999\n",
      "utf8",
    );
    delete process.env.DEEPSEEK_API_KEY;
    loadDotEnv(tmpDir);
    expect(process.env.DEEPSEEK_API_KEY).toBe("test-from-file");
    expect(process.env.PORT).toBe("9999");
  });

  it("does not override existing environment variables", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "juben-env-"));
    fs.writeFileSync(path.join(tmpDir, ".env"), "DEEPSEEK_API_KEY=from-file\n", "utf8");
    process.env.DEEPSEEK_API_KEY = "from-shell";
    loadDotEnv(tmpDir);
    expect(process.env.DEEPSEEK_API_KEY).toBe("from-shell");
  });
});
