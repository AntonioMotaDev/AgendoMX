import "server-only";
import { optionalEnv } from "@/lib/env";

/**
 * The legal pages, the registration checkbox and the booking notice are built but dark until
 * legal approves the texts. Production leaves LEGAL_PUBLISHED unset; staging and E2E turn it on.
 * Read at request time (a runtime var), never inlined at build.
 */
export function legalPublished(): boolean {
  return optionalEnv("LEGAL_PUBLISHED") === "true";
}
