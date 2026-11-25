"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { hitRateLimit } from "@/db/rate-limit";
import { getAuth } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { legalPublished } from "@/lib/legal";
import { LEGAL_VERSION } from "@/lib/legal-content";
import { requireOwner } from "@/lib/session";
import { confirmationMatches } from "@/server/services/account";
import { deleteOwnerAccount, getAccountSummary, recordTermsAcceptance } from "./account-writes";
import { guarded } from "./helpers";
import { purgeCachedImages } from "./media-cache";
import { fail, ok, type ActionResult } from "./result";

const e = copy.panel.profile.account.errors;

/**
 * Permanently deletes the signed-in owner's account and everything under it. The user id comes from
 * the session; the owner must type the business name (or the email, before a business exists).
 */
export async function deleteAccountAction(raw: unknown): Promise<ActionResult<{ deleted: true }>> {
  const owner = await requireOwner();
  return guarded("deleteAccount", async () => {
    const db = await getDb();
    const { allowed } = await hitRateLimit(db, `account-delete:${owner.id}`, 5, 3600);
    if (!allowed) return fail(e.rateLimited);

    const summary = await getAccountSummary(db, owner.id, new Date());
    if (!summary) return fail(e.notFound);
    const expected = summary.businessName ?? summary.email;
    const confirm = typeof raw === "object" && raw !== null ? (raw as { confirm?: unknown }).confirm : undefined;
    if (!confirmationMatches(confirm, expected)) return fail(e.mismatch, "confirm");

    // Sign out first so the browser's cookie is cleared while the session row still exists.
    try {
      await (await getAuth()).api.signOut({ headers: await headers() });
    } catch {
      // A stale cookie is harmless once the session row is gone.
    }

    const { env } = await getCloudflareContext({ async: true });
    const result = await deleteOwnerAccount(db, env.ASSETS_BUCKET, owner.id);
    if (!result.ok) return fail(e.notFound);
    await purgeCachedImages(result.data.removedUrls);
    return ok({ deleted: true as const });
  });
}

/**
 * The owner accepts the current version of the terms and privacy notice (the gate shown after the texts
 * change). The version must be the one the server runs: a stale page cannot accept an older text.
 */
export async function acceptTermsAction(raw: unknown): Promise<ActionResult<{ accepted: true }>> {
  const owner = await requireOwner();
  const t = copy.panel.legal.gate;
  return guarded("acceptTerms", async () => {
    if (!legalPublished()) return fail(t.error);
    const version = typeof raw === "object" && raw !== null ? (raw as { version?: unknown }).version : undefined;
    if (version !== LEGAL_VERSION) return fail(t.outdated);
    const db = await getDb();
    const saved = await recordTermsAcceptance(db, owner.id, LEGAL_VERSION, new Date());
    return saved ? ok({ accepted: true as const }) : fail(t.error);
  });
}
