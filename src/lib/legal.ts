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

/**
 * Health categories (psychology, physiotherapy, nutrition, dentistry, medical) are not offered while the
 * legal texts are published, until the express-consent mechanism for sensitive data is validated by a lawyer.
 * A runtime var like LEGAL_PUBLISHED; staging and E2E can turn it on to exercise the consent flow.
 */
export function healthCategoriesEnabled(): boolean {
  return optionalEnv("HEALTH_CATEGORIES_ENABLED") === "true";
}

/** Both switches, as the pure helpers in server/services/booking.ts take them. */
export function legalSwitches(): { published: boolean; healthEnabled: boolean } {
  return { published: legalPublished(), healthEnabled: healthCategoriesEnabled() };
}
