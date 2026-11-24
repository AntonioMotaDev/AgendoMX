import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // cacheComponents / partialPrefetching are off on purpose: OpenNext for
  // Cloudflare does not fully support Cache Components yet (CLAUDE.md §2).
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
initOpenNextCloudflareForDev();
