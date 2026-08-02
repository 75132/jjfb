import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/runtime/**/*.test.ts"],
  },
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      "@protocol": path.resolve(root, "assets/Script/global/protocol"),
      "@game": path.resolve(root, "assets/Script/Game"),
    },
  },
});
