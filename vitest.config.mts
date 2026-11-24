import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    // Integration files each DROP and recreate the same schema (CLAUDE.md §8):
    // they must not run at the same time.
    fileParallelism: false,
    // Unit tests must not depend on the machine's zone.
    env: { TZ: "UTC" },
  },
});
