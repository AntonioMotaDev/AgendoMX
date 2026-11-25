import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { isExclusionViolation } from "@/db/errors";
import { appointmentEvents, appointments, businesses, clients } from "@/db/schema";
import { generatePublicToken } from "@/lib/tokens";
import { getBookableService, loadAvailabilityContext, type BusinessRow } from "@/server/queries/public";
import { isSlotAvailable } from "@/server/services/availability";
import {
  bookingTimes,
  checkClientCancellation,
  initialAppointment,
  MAX_ACTIVE_APPOINTMENTS_PER_CLIENT,
} from "@/server/services/booking";

/**
 * Public booking writes. Plain functions over `db` so they can be integration
 * tested; the server actions add Turnstile, rate limits and input validation.
 *
 * Defence in depth against double bookings:
 *  1. a per-staff advisory lock serializes concurrent bookings, so the slot is
 *     revalidated against a consistent view of the busy ranges;
 *  2. the EXCLUDE constraint is the real guarantee: if anything slips past (a
 *     manual insert, a second app instance) Postgres raises 23P01.
 */

export type BookingError = "not_found" | "slot_taken" | "too_many";

export type BookingResult<T> = { ok: true; data: T } | { ok: false; error: BookingError };

export interface BookingInput {
  serviceId: unknown;
  start: Date;
  client: { name: string; phone: string; email: string | null };
  now: Date;
}

export interface CreatedBooking {
  appointmentId: string;
  publicToken: string;
  status: "confirmed" | "pending";
  startsAt: Date;
  endsAt: Date;
  serviceName: string;
  priceCents: number | null;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function lockStaff(tx: Tx, staffId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`booking:${staffId}`}))`);
}

export async function createPublicBooking(db: Db, business: BusinessRow, input: BookingInput): Promise<BookingResult<CreatedBooking>> {
  try {
    return await db.transaction(async (tx): Promise<BookingResult<CreatedBooking>> => {
      const service = await getBookableService(tx, business.id, input.serviceId);
      if (!service) return { ok: false, error: "not_found" };

      // Read the context first only to learn the staff id, then lock and read again.
      const probe = await loadAvailabilityContext(tx, business, input.now);
      if (!probe) return { ok: false, error: "not_found" };
      await lockStaff(tx, probe.staffId);
      const context = await loadAvailabilityContext(tx, business, input.now);
      if (!context) return { ok: false, error: "not_found" };

      const available = isSlotAvailable(
        {
          timezone: business.timezone,
          rules: context.rules,
          exceptions: context.exceptions,
          busy: context.busy,
          durationMin: service.durationMin,
          bufferAfterMin: service.bufferAfterMin,
          leadTimeMin: business.bookingLeadTimeMin,
          windowDays: business.bookingWindowDays,
          now: input.now,
        },
        input.start,
      );
      if (!available) return { ok: false, error: "slot_taken" };

      const [client] = await tx
        .insert(clients)
        .values({ businessId: business.id, name: input.client.name, phone: input.client.phone, email: input.client.email })
        .onConflictDoUpdate({
          target: [clients.businessId, clients.phone],
          // Keep the latest name; keep the stored email unless a new one was given.
          set: { name: input.client.name, email: sql`COALESCE(excluded.email, ${clients.email})` },
        })
        .returning({ id: clients.id });
      if (!client) throw new Error("client upsert returned no row");

      const [active] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(appointments)
        .where(and(eq(appointments.clientId, client.id), inArray(appointments.status, ["pending", "confirmed"]), gt(appointments.startsAt, input.now)));
      if ((active?.n ?? 0) >= MAX_ACTIVE_APPOINTMENTS_PER_CLIENT) return { ok: false, error: "too_many" };

      const times = bookingTimes(input.start, service.durationMin, service.bufferAfterMin);
      const initial = initialAppointment(business.confirmationMode, input.now, business.pendingExpiryHours);
      const publicToken = generatePublicToken();

      const [created] = await tx
        .insert(appointments)
        .values({
          businessId: business.id,
          staffId: context.staffId,
          serviceId: service.id,
          clientId: client.id,
          startsAt: times.startsAt,
          endsAt: times.endsAt,
          blockedUntil: times.blockedUntil,
          serviceNameSnapshot: service.name,
          priceCentsSnapshot: service.priceCents,
          status: initial.status,
          source: "public_link",
          publicToken,
          expiresAt: initial.expiresAt,
        })
        .returning({ id: appointments.id });
      if (!created) throw new Error("appointment insert returned no row");

      await tx.insert(appointmentEvents).values({ appointmentId: created.id, type: "created", actor: "client" });

      return {
        ok: true,
        data: {
          appointmentId: created.id,
          publicToken,
          status: initial.status,
          startsAt: times.startsAt,
          endsAt: times.endsAt,
          serviceName: service.name,
          priceCents: service.priceCents,
        },
      };
    });
  } catch (error) {
    if (isExclusionViolation(error)) return { ok: false, error: "slot_taken" };
    throw error;
  }
}

export type CancelError = "not_found" | "status" | "started" | "too_late";

/** Cancels from the client's private link, only if the business's cancellation window allows it. */
export async function cancelByClient(db: Db, publicToken: string, now: Date): Promise<BookingResult<{ appointmentId: string }> | { ok: false; error: CancelError }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: appointments.id,
        status: appointments.status,
        startsAt: appointments.startsAt,
        cancellationMinHours: businesses.cancellationMinHours,
      })
      .from(appointments)
      .innerJoin(businesses, eq(businesses.id, appointments.businessId))
      .where(eq(appointments.publicToken, publicToken))
      .for("update", { of: appointments })
      .limit(1);
    if (!row) return { ok: false as const, error: "not_found" as const };

    const check = checkClientCancellation({ status: row.status, startsAt: row.startsAt, now, cancellationMinHours: row.cancellationMinHours });
    if (!check.ok) return { ok: false as const, error: check.reason };

    await tx.update(appointments).set({ status: "cancelled", cancelledBy: "client" }).where(eq(appointments.id, row.id));
    await tx.insert(appointmentEvents).values({ appointmentId: row.id, type: "cancelled", actor: "client" });
    return { ok: true as const, data: { appointmentId: row.id } };
  });
}
