import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache yet: almost every page is dynamic (per-business data).
// Add the R2 incremental cache when static marketing pages need ISR.
export default defineCloudflareConfig({});
