import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { appointments, businesses, clients, user, verification } from "@/db/schema";
import { keyFromMediaUrl } from "@/lib/images";
import type { Reader } from "@/server/queries/business";
import { deleteQuietly, type ImageBucket } from "./media-writes";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface AccountSummary {
  email: string;
  businessName: string | null;
  clients: number;
  appointments: number;
  /** Pending or confirmed appointments that have not happened yet: those clients are NOT notified when the account is deleted. */
  upcoming: number;
}

/** What deleting the account would remove, shown before the owner confirms. */
export async function getAccountSummary(db: Reader, userId: string, now: Date): Promise<AccountSummary | null> {
  const [owner] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  if (!owner) return null;
  const [business] = await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(eq(businesses.ownerUserId, userId)).limit(1);
  if (!business) return { email: owner.email, businessName: null, clients: 0, appointments: 0, upcoming: 0 };

  const [clientCount] = await db.select({ n: sql<number>`count(*)::int` }).from(clients).where(eq(clients.businessId, business.id));
  const [apptCount] = await db.select({ n: sql<number>`count(*)::int` }).from(appointments).where(eq(appointments.businessId, business.id));
  const [upcoming] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(appointments)
    .where(and(eq(appointments.businessId, business.id), inArray(appointments.status, ["pending", "confirmed"]), gt(appointments.startsAt, now)));
  return { email: owner.email, businessName: business.name, clients: clientCount?.n ?? 0, appointments: apptCount?.n ?? 0, upcoming: upcoming?.n ?? 0 };
}

export type DeleteAccountResult = { ok: true; data: { removedUrls: string[] } } | { ok: false; error: "not_found" };

async function lockOwner(tx: Tx, userId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`account:${userId}`}))`);
}

/**
 * Permanently removes an owner and everything that hangs from them: appointments (and their
 * events), clients, the business with its staff, services and hours, sessions, linked accounts and
 * pending verification tokens. One transaction under a per-owner lock, so a double tap deletes
 * once and the second call is simply "not found". Images in R2 are removed afterwards.
 * Order matters: appointments reference staff/services/clients with RESTRICT, and the business
 * references the owner with RESTRICT.
 */
export async function deleteOwnerAccount(db: Db, bucket: ImageBucket, userId: string): Promise<DeleteAccountResult> {
  const removed = await db.transaction(async (tx): Promise<{ urls: string[] } | null> => {
    await lockOwner(tx, userId);
    const [owner] = await tx.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
    if (!owner) return null;

    const [business] = await tx.select().from(businesses).where(eq(businesses.ownerUserId, userId)).limit(1);
    const urls: string[] = [];
    if (business) {
      for (const url of [business.logoUrl, business.coverUrl]) if (url) urls.push(url);
      await tx.delete(appointments).where(eq(appointments.businessId, business.id)); // events cascade
      await tx.delete(clients).where(eq(clients.businessId, business.id));
      await tx.delete(businesses).where(eq(businesses.id, business.id)); // staff, services, hours, exceptions cascade
    }
    await tx.delete(verification).where(eq(verification.identifier, owner.email));
    await tx.delete(user).where(eq(user.id, userId)); // sessions and accounts cascade
    return { urls };
  });
  if (!removed) return { ok: false, error: "not_found" };

  for (const url of removed.urls) await deleteQuietly(bucket, keyFromMediaUrl(url));
  return { ok: true, data: { removedUrls: removed.urls } };
}
