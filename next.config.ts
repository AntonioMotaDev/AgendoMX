import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // cacheComponents / partialPrefetching are off on purpose: OpenNext for
  // Cloudflare does not fully support Cache Components yet (CLAUDE.md §2).
  // Logo/cover uploads arrive already compressed (<= 1 MB, see src/lib/images.ts);
  // the default 1 MB body limit would cut it too close with multipart overhead.
  experimental: { serverActions: { bodySizeLimit: "1.5mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// Exposes Cloudflare bindings (Hyperdrive, R2, rate limiter) to `next dev`
// through getCloudflareContext().
// Local R2/binding state lives outside the project: every upload writes files there,
// and inside the project the dev server's file watcher saw them and recompiled in a loop.
initOpenNextCloudflareForDev({ persist: { path: process.env.WRANGLER_PERSIST_PATH ?? join(tmpdir(), "agendomx-wrangler-state") } });
