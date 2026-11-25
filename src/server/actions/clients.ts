"use server";

import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { getCurrentBusiness, requireOwner } from "@/lib/session";
import { anonymizeClient } from "./client-writes";
import { guarded } from "./helpers";
import { fail, ok, type ActionResult } from "./result";

const e = copy.panel.clients.errors;

/** Erases one customer's personal data. The business comes from the session, never from the request. */
export async function eraseClientAction(raw: unknown): Promise<ActionResult<{ erased: true }>> {
  await requireOwner();
  return guarded("eraseClient", async () => {
    const business = await getCurrentBusiness();
    if (!business) return fail(e.generic);
    const id = typeof raw === "object" && raw !== null ? (raw as { id?: unknown }).id : undefined;

    const result = await anonymizeClient(await getDb(), business.id, id, new Date());
    if (result.ok) return ok({ erased: true as const });
    if (result.error === "has_upcoming") return fail(e.hasUpcoming(result.upcoming ?? 0));
    return fail(result.error === "already_erased" ? e.alreadyErased : e.notFound);
  });
}
