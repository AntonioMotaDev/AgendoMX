/**
 * Booking rules that do not need the database. Pure functions, no I/O.
 * See CLAUDE.md §5 "Flujo de reserva pública".
 */
import type { BusinessCategory } from "@/lib/categories";
import { missingControllerData } from "@/lib/legal-content";

/**
 * Health-related categories: merely having an appointment can be sensitive data
 * (CLAUDE.md §6), so emails to clients never name the service for these.
 */
const SENSITIVE_CATEGORIES: ReadonlySet<BusinessCategory> = new Set(["physiotherapy", "psychology", "nutrition", "dentistry", "medical"]);

export function isSensitiveCategory(category: BusinessCategory): boolean {
  return SENSITIVE_CATEGORIES.has(category);
}

export interface PublicBookingRequirements {
  /** The business cannot take online bookings: its client notice would not be able to name it as controller. */
  closed: boolean;
  /** What the owner still has to register (drives the panel banner). */
  missing: Array<"address" | "contact">;
  /** The booking form must carry the express authorization box (health categories). */
  needsHealthConsent: boolean;
}

/**
 * What a public booking needs while the legal texts are published. When they are not (production today),
 * nothing changes: no requirement, no box. One place so the profile, the form and the server agree.
 */
export function publicBookingRequirements(
  published: boolean,
  business: { category: BusinessCategory; address: string | null; city: string | null; state: string | null; phone: string | null; whatsapp: string | null },
): PublicBookingRequirements {
  if (!published) return { closed: false, missing: [], needsHealthConsent: false };
  const missing = missingControllerData(business);
  return { closed: missing.length > 0, missing, needsHealthConsent: isSensitiveCategory(business.category) };
}

/** Upcoming pending/confirmed appointments one phone number may hold at a business. */
export const MAX_ACTIVE_APPOINTMENTS_PER_CLIENT = 3;

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

export interface BookingTimes {
  startsAt: Date;
  /** startsAt + service duration: what the client sees. */
  endsAt: Date;
  /** endsAt + buffer: the range the staff is actually busy (the EXCLUDE constraint uses it). */
  blockedUntil: Date;
}

export function bookingTimes(start: Date, durationMin: number, bufferAfterMin: number): BookingTimes {
  const endsAt = new Date(start.getTime() + durationMin * MINUTE_MS);
  return { startsAt: new Date(start.getTime()), endsAt, blockedUntil: new Date(endsAt.getTime() + bufferAfterMin * MINUTE_MS) };
}

/** Auto mode confirms immediately; manual mode holds the slot as `pending` until it expires. */
export function initialAppointment(mode: "auto" | "manual", now: Date, pendingExpiryHours: number): { status: "confirmed" | "pending"; expiresAt: Date | null } {
  return mode === "auto"
    ? { status: "confirmed", expiresAt: null }
    : { status: "pending", expiresAt: new Date(now.getTime() + pendingExpiryHours * HOUR_MS) };
}

const CANCELLABLE_STATUSES = new Set(["pending", "confirmed"]);

/** Last moment a client may cancel from their link. */
export function cancellationDeadline(startsAt: Date, cancellationMinHours: number): Date {
  return new Date(startsAt.getTime() - cancellationMinHours * HOUR_MS);
}

export type CancelCheck = { ok: true } | { ok: false; reason: "status" | "started" | "too_late" };

/** Clients cancel until `cancellation_min_hours` before the start; after that they must contact the business. */
export function checkClientCancellation(input: { status: string; startsAt: Date; now: Date; cancellationMinHours: number }): CancelCheck {
  if (!CANCELLABLE_STATUSES.has(input.status)) return { ok: false, reason: "status" };
  if (input.now.getTime() >= input.startsAt.getTime()) return { ok: false, reason: "started" };
  if (input.now.getTime() > cancellationDeadline(input.startsAt, input.cancellationMinHours).getTime()) return { ok: false, reason: "too_late" };
  return { ok: true };
}

/** 24 random bytes in base64url are 32 characters; anything else cannot be one of our tokens. */
const PUBLIC_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

export function isPublicToken(value: unknown): value is string {
  return typeof value === "string" && PUBLIC_TOKEN_RE.test(value);
}

const ISO_UTC_QUARTER_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/;

/**
 * The slot start the browser sends back: exactly `Date#toISOString()` of a whole
 * minute. Strict on purpose: it is only ever compared to server-computed slots.
 */
export function parseRequestedStart(value: unknown): Date | null {
  if (typeof value !== "string" || !ISO_UTC_QUARTER_RE.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.toISOString() !== value ? null : date;
}
