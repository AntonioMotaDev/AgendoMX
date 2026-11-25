import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { appointmentEvents, appointments, businesses, clients } from "@/db/schema";
import { bookedInAdvance, REMINDER_BATCH, reminderWindow } from "@/server/services/reminders";

/**
 * Scheduled work. Plain functions over `db`, so they are integration-tested and
 * safe to run twice (or concurrently): each one claims rows atomically.
 */

/** Pending requests nobody answered in time become `expired` and free their slot. Returns how many. */
export async function expirePendingAppointments(db: Db, now: Date): Promise<number> {
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.status, "pending"), isNotNull(appointments.expiresAt), lte(appointments.expiresAt, now)))
      .for("update", { skipLocked: true });
    if (due.length === 0) return 0;
    const ids = due.map((d) => d.id);
    await tx.update(appointments).set({ status: "expired" }).where(inArray(appointments.id, ids));
    await tx.insert(appointmentEvents).values(ids.map((appointmentId) => ({ appointmentId, type: "expired" as const, actor: "system" as const })));
    return ids.length;
  });
}

export interface DueReminder {
  id: string;
  publicToken: string;
  startsAt: Date;
  serviceName: string;
  clientName: string;
  clientEmail: string;
  business: { name: string; category: typeof businesses.$inferSelect["category"]; timezone: string; address: string | null; city: string | null; cancellationMinHours: number };
}

/**
 * Claims up to a batch of due reminders by stamping `reminder_sent_at` in the same
 * statement that selects them, so two overlapping runs never claim the same row.
 * If sending fails the caller hands the ids back with `releaseReminders`.
 */
export async function claimDueReminders(db: Db, now: Date, limit = REMINDER_BATCH): Promise<DueReminder[]> {
  const { startsAfter, startsUntil } = reminderWindow(now);
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ a: appointments, c: clients, b: businesses })
      .from(appointments)
      .innerJoin(clients, eq(clients.id, appointments.clientId))
      .innerJoin(businesses, eq(businesses.id, appointments.businessId))
      .where(
        and(
          eq(appointments.status, "confirmed"),
          isNull(appointments.reminderSentAt),
          isNotNull(clients.email),
          gt(appointments.startsAt, startsAfter),
          lte(appointments.startsAt, startsUntil),
          // Booked more than 24 h ahead: created_at < starts_at - 24 h.
          lt(appointments.createdAt, sql`${appointments.startsAt} - interval '24 hours'`),
        ),
      )
      .orderBy(asc(appointments.startsAt))
      .limit(limit)
      .for("update", { of: appointments, skipLocked: true });

    const eligible = rows.filter((r) => r.c.email && bookedInAdvance(r.a.createdAt, r.a.startsAt));
    if (eligible.length === 0) return [];
    await tx.update(appointments).set({ reminderSentAt: now }).where(inArray(appointments.id, eligible.map((r) => r.a.id)));

    return eligible.map((r) => ({
      id: r.a.id,
      publicToken: r.a.publicToken,
      startsAt: r.a.startsAt,
      serviceName: r.a.serviceNameSnapshot,
      clientName: r.c.name,
      clientEmail: r.c.email as string,
      business: {
        name: r.b.name,
        category: r.b.category,
        timezone: r.b.timezone,
        address: r.b.address,
        city: r.b.city,
        cancellationMinHours: r.b.cancellationMinHours,
      },
    }));
  });
}

/** Gives claimed reminders back (sending failed) so the next run retries them. */
export async function releaseReminders(db: Db, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.update(appointments).set({ reminderSentAt: null }).where(inArray(appointments.id, ids));
}
