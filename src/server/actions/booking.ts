"use server";

import { headers } from "next/headers";
import { getDb } from "@/db";
import { hitRateLimit } from "@/db/rate-limit";
import { sha256Hex } from "@/lib/auth-rate-limit";
import { copy } from "@/lib/copy";
import { formatInstantTime } from "@/lib/dates";
import { legalPublished, legalSwitches } from "@/lib/legal";
import { LEGAL_VERSION } from "@/lib/legal-content";
import { inBackground } from "@/lib/email/send";
import { sendClientBookingEmail, sendOwnerBookingEmail } from "@/lib/email/booking-emails";
import { verifyTurnstile } from "@/lib/turnstile";
import { turnstileConfig } from "@/lib/turnstile-config";
import { availabilityRequestSchema, bookingRequestSchema, cancelRequestSchema } from "@/lib/validators/booking";
import { getAppointmentByToken, getBookableService, getBookingBusinessBySlug, getOwnerContact, loadAvailabilityContext } from "@/server/queries/public";
import { computeAvailability } from "@/server/services/availability";
import { isPublicToken, parseRequestedStart, publicBookingRequirements } from "@/server/services/booking";
import { cancelByClient, createPublicBooking } from "./booking-writes";
import { firstIssue } from "./helpers";
import { fail, ok, type ActionResult } from "./result";

const t = copy.public.booking;

const HOUR = 3600;
const DAY = 24 * HOUR;
const SLOTS_PER_IP_HOUR = 90;
const BOOKINGS_PER_IP_HOUR = 20;
const BOOKINGS_PER_PHONE_DAY = 6;
const CANCELS_PER_IP_HOUR = 20;

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Keys never carry an IP or a phone in clear text. */
async function limited(scope: string, subject: string, limit: number, windowSeconds: number): Promise<boolean> {
  const db = await getDb();
  const { allowed } = await hitRateLimit(db, `public:${scope}:${await sha256Hex(subject)}`, limit, windowSeconds);
  return !allowed;
}

function guard<T>(label: string, fallback: string, work: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return work().catch((error: unknown) => {
    if (typeof error === "object" && error !== null && "digest" in error) throw error;
    console.error(`${label} failed`, error instanceof Error ? error.message : "unknown error");
    return fail(fallback);
  });
}

export interface SlotView {
  /** ISO instant, exactly what createBooking expects back. */
  start: string;
  label: string;
}
export interface DayView {
  date: string;
  slots: SlotView[];
}

/** Open slots of one service for the whole booking window, in the business's zone. Public, read-only. */
export async function getSlotsAction(raw: unknown): Promise<ActionResult<{ days: DayView[] }>> {
  return guard("getSlots", t.errors.generic, async () => {
    const parsed = availabilityRequestSchema.safeParse(raw);
    if (!parsed.success) return firstIssue(parsed.error, t.errors.generic);
    if (await limited("slots-ip", await clientIp(), SLOTS_PER_IP_HOUR, HOUR)) return fail(t.errors.rateLimited);

    const db = await getDb();
    const business = await getBookingBusinessBySlug(db, parsed.data.slug);
    if (!business) return fail(t.errors.notFound);
    const service = await getBookableService(db, business.id, parsed.data.serviceId);
    if (!service) return fail(t.errors.notFound);

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
      leadTimeMin: business.bookingLeadTimeMin,
      windowDays: business.bookingWindowDays,
      now,
    });
    return ok({
      days: days
        .filter((d) => d.slots.length > 0)
        .map((d) => ({
          date: d.date,
          slots: d.slots.map((s) => ({ start: s.start.toISOString(), label: formatInstantTime(s.start, business.timezone) })),
        })),
    });
  });
}

/**
 * Creates an appointment from the public profile. Order matters: cheap checks
 * (honeypot, shape, IP limit) before the Turnstile call, and the per-phone
 * limit only once the phone is known to be valid. The slot is always
 * re-validated inside the transaction; nothing the browser says is trusted.
 */
export async function createBookingAction(raw: unknown): Promise<ActionResult<{ token: string; status: "confirmed" | "pending" }>> {
  return guard("createBooking", t.errors.generic, async () => {
    const parsed = bookingRequestSchema.safeParse(raw);
    if (!parsed.success) return firstIssue(parsed.error, t.errors.generic);
    const input = parsed.data;

    // Honeypot: people never see this field. Answer like any other failure.
    if (input.website) return fail(t.errors.generic);

    const start = parseRequestedStart(input.start);
    if (!start) return fail(t.errors.slotInvalid, "start");

    const ip = await clientIp();
    if (await limited("book-ip", ip, BOOKINGS_PER_IP_HOUR, HOUR)) return fail(t.errors.rateLimited);

    const verdict = await verifyTurnstile({ token: input.turnstileToken, remoteIp: ip, config: turnstileConfig() });
    if (!verdict.ok) return fail(verdict.reason === "unavailable" ? t.errors.unavailable : t.errors.captcha);

    if (await limited("book-phone", input.phone, BOOKINGS_PER_PHONE_DAY, DAY)) return fail(t.errors.rateLimited);

    const db = await getDb();
    const business = await getBookingBusinessBySlug(db, input.slug);
    if (!business) return fail(t.errors.notFound);

    // While the legal texts are published: the client notice must be able to name its controller, and
    // health categories need the express authorization. Both are enforced here, not only in the form.
    const published = legalPublished();
    const requirements = publicBookingRequirements(legalSwitches(), business);
    if (requirements.closed) return fail(t.errors.bookingClosed);
    if (requirements.needsHealthConsent && input.healthConsent !== true) return fail(t.errors.consentRequired, "healthConsent");

    const now = new Date();
    const result = await createPublicBooking(db, business, {
      serviceId: input.serviceId,
      start,
      client: { name: input.name, phone: input.phone, email: input.email },
      now,
      consent: published ? { privacyNoticeVersion: LEGAL_VERSION, healthConsentAt: requirements.needsHealthConsent ? now : null } : null,
    });
    if (!result.ok) {
      if (result.error === "slot_taken") return fail(t.errors.slotTaken, "start");
      if (result.error === "too_many") return fail(t.errors.tooMany);
      return fail(t.errors.notFound);
    }

    const booking = result.data;
    if (input.email) {
      await inBackground(
        sendClientBookingEmail({
          to: input.email,
          clientName: input.name,
          token: booking.publicToken,
          status: booking.status,
          startsAt: booking.startsAt,
          serviceName: booking.serviceName,
          business,
        }),
        "booking-client-email",
      );
    }
    const owner = await getOwnerContact(db, business.id);
    if (owner) {
      await inBackground(
        sendOwnerBookingEmail({
          to: owner.email,
          ownerName: owner.name,
          kind: booking.status === "pending" ? "request" : "new",
          clientName: input.name,
          clientPhone: input.phone,
          startsAt: booking.startsAt,
          serviceName: booking.serviceName,
          timezone: business.timezone,
        }),
        "booking-owner-email",
      );
    }

    return ok({ token: booking.publicToken, status: booking.status });
  });
}

/** Cancels from the private link, if the business's cancellation window still allows it. */
export async function cancelBookingAction(raw: unknown): Promise<ActionResult<{ cancelled: true }>> {
  const e = copy.public.appointment.errors;
  return guard("cancelBooking", e.generic, async () => {
    const parsed = cancelRequestSchema.safeParse(raw);
    if (!parsed.success || !isPublicToken(parsed.data.token)) return fail(copy.public.appointment.notFoundTitle);
    if (await limited("cancel-ip", await clientIp(), CANCELS_PER_IP_HOUR, HOUR)) return fail(e.rateLimited);

    const db = await getDb();
    const before = await getAppointmentByToken(db, parsed.data.token);
    const result = await cancelByClient(db, parsed.data.token, new Date());
    if (!result.ok) {
      if (result.error === "too_late") return fail(copy.public.appointment.tooLate(before?.business.cancellationMinHours ?? 0), "too_late");
      if (result.error === "started") return fail(e.started);
      if (result.error === "status") return fail(e.status);
      return fail(copy.public.appointment.notFoundTitle);
    }

    if (before) {
      const owner = await getOwnerContact(db, before.business.id);
      if (owner) {
        await inBackground(
          sendOwnerBookingEmail({
            to: owner.email,
            ownerName: owner.name,
            kind: "cancelled",
            clientName: before.clientName,
            clientPhone: null,
            startsAt: before.startsAt,
            serviceName: before.serviceName,
            timezone: before.business.timezone,
          }),
          "booking-cancel-owner-email",
        );
      }
    }
    return ok({ cancelled: true as const });
  });
}
