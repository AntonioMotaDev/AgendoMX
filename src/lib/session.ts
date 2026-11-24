import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { businesses } from "@/db/schema";
import { getAuth } from "@/lib/auth";

/** Current session, or null. Memoized per request. */
export const getSession = cache(async () => {
  const auth = await getAuth();
  return auth.api.getSession({ headers: await headers() });
});

/**
 * Guard for every dashboard page, query and server action (CLAUDE.md §6).
 * The user id always comes from the session, never from params or the body.
 */
export async function requireOwner() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

/**
 * The business owned by the signed-in user, or null before onboarding.
 * The MVP supports one business per owner; this is the only way dashboard code
 * should obtain a `businessId`.
 */
export const getCurrentBusiness = cache(async () => {
  const owner = await requireOwner();
  const db = await getDb();
  const [business] = await db.select().from(businesses).where(eq(businesses.ownerUserId, owner.id)).limit(1);
  return business ?? null;
});
