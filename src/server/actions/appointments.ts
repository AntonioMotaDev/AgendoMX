"use server";

import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { inBackground } from "@/lib/email/send";
import { sendClientBookingEmail, sendClientStatusEmail } from "@/lib/email/booking-emails";
import { requireOwner, getCurrentBusiness } from "@/lib/session";
import { formatInstantTime } from "@/lib/dates";
import { parseLocalDateOrNull, parseTimeOfDay, zonedToUtc } from "@/lib/time";
import { manualAppointmentSchema, manualSlotsSchema } from "@/lib/validators/booking";
import { loadAvailabilityContext } from "@/server/queries/public";
import { listActiveServices } from "@/server/queries/services";
import { computeAvailability } from "@/server/services/availability";
import { parseRequestedStart } from "@/server/services/booking";
import { getOwnerAppointment } from "@/server/queries/appointments";
import { isOwnerAction } from "@/server/services/appointment-status";
import { changeAppointmentStatus } from "./appointment-writes";
import { createManualAppointment } from "./booking-writes";
import type { DayView } from "./booking";
import { firstIssue, guarded } from "./helpers";
import { fail, ok, type ActionResult } from "./result";

const e = copy.panel.agenda.errors;

/**
 * Confirm / reject / cancel / complete / no-show for one appointment of the
 * signed-in owner's business. The business comes from the session, never from
 * the request. The client is emailed (if they left an address) for the three
 * changes that concern them.
 */
export async function changeAppointmentStatusAction(raw: unknown): Promise<ActionResult<{ action: string }>> {
  return guarded("changeAppointmentStatus", async () => {
    await requireOwner();
    const business = await getCurrentBusiness();
    if (!business) return fail(e.generic);

    const input = typeof raw === "object" && raw !== null ? (raw as { id?: unknown; action?: unknown }) : {};
    if (!isOwnerAction(input.action)) return fail(e.generic);
    const action = input.action;

    const db = await getDb();
    const result = await changeAppointmentStatus(db, business.id, input.id, action, new Date());
    if (!result.ok) {
      if (result.error === "not_found") return fail(e.notFound);
      if (result.error === "not_started") return fail(e.notStarted);
      return fail(e.invalid);
    }

    if (action === "confirm" || action === "reject" || action === "cancel") {
      const detail = await getOwnerAppointment(db, business.id, input.id);
      if (detail?.clientEmail) {
        const email =
          action === "confirm"
            ? sendClientBookingEmail({
                to: detail.clientEmail,
                clientName: detail.clientName,
                token: detail.publicToken,
                status: "confirmed",
                startsAt: detail.startsAt,
                serviceName: detail.serviceName,
                business: detail.business,
              })
            : sendClientStatusEmail({
                to: detail.clientEmail,
                clientName: detail.clientName,
                kind: action === "reject" ? "rejected" : "cancelled",
                startsAt: detail.startsAt,
                serviceName: detail.serviceName,
                business: detail.business,
              });
        await inBackground(email, `appointment-${action}-client-email`);
      }
    }
    return ok({ action });
  });
}

const pe = copy.public.booking.errors;

/** Open slots for the owner's manual form: any active service, no lead time. */
export async function getManualSlotsAction(raw: unknown): Promise<ActionResult<{ days: DayView[] }>> {
  return guarded("getManualSlots", async () => {
    await requireOwner();
    const business = await getCurrentBusiness();
    if (!business) return fail(e.generic);
    const parsed = manualSlotsSchema.safeParse(raw);
    if (!parsed.success) return firstIssue(parsed.error, e.generic);

    const db = await getDb();
    const service = (await listActiveServices(db, business.id)).find((x) => x.id === parsed.data.serviceId);
    if (!service) return fail(pe.notFound);
    const now = new Date();
    const context = await loadAvailabilityContext(db, business, now);
    if (!context) return ok({ days: [] });

    const days = computeAvailability({
      timezone: business.timezone,
      rules: context.rules,
      exceptions: context.exceptions,
      busy: context.busy,
      durationMin: service.durationMin,
      bufferAfterMin: service.bufferAfterMin,
      leadTimeMin: 0,
      windowDays: business.bookingWindowDays,
      now,
    });
    return ok({
      days: days
        .filter((d) => d.slots.length > 0)
        .map((d) => ({ date: d.date, slots: d.slots.map((s) => ({ start: s.start.toISOString(), label: formatInstantTime(s.start, business.timezone) })) })),
    });
  });
}

/** Creates a confirmed appointment on behalf of a client (walk-in, phone call, WhatsApp). */
export async function createManualAppointmentAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return guarded("createManualAppointment", async () => {
    await requireOwner();
    const business = await getCurrentBusiness();
    if (!business) return fail(e.generic);
    const parsed = manualAppointmentSchema.safeParse(raw);
    if (!parsed.success) return firstIssue(parsed.error, e.generic);
    const input = parsed.data;

    let start: Date | null = null;
    if (input.mode === "slot") {
      start = parseRequestedStart(input.start);
    } else {
      const date = parseLocalDateOrNull(input.date);
      let minutes: number | null = null;
      try {
        minutes = input.time ? parseTimeOfDay(input.time) : null;
      } catch {
        minutes = null;
      }
      if (date && minutes !== null && minutes < 24 * 60) start = zonedToUtc(date, minutes, business.timezone);
    }
    if (!start) return fail(pe.slotInvalid, input.mode === "slot" ? "start" : "time");

    const db = await getDb();
    const result = await createManualAppointment(db, business, {
      serviceId: input.serviceId,
      start,
      client: { name: input.name, phone: input.phone, email: input.email },
      now: new Date(),
      offHours: input.mode === "custom",
    });
    if (!result.ok) {
      if (result.error === "slot_taken") return fail(pe.slotTaken, input.mode === "slot" ? "start" : "time");
      return fail(pe.notFound);
    }

    const booking = result.data;
    if (input.email) {
      await inBackground(
        sendClientBookingEmail({
          to: input.email,
          clientName: input.name,
          token: booking.publicToken,
          status: "confirmed",
          startsAt: booking.startsAt,
          serviceName: booking.serviceName,
          business,
        }),
        "manual-appointment-client-email",
      );
    }
    return ok({ id: booking.appointmentId });
  });
}
