import { and, asc, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { appointments, availabilityExceptions, availabilityRules, businesses, clients, services, user } from "@/db/schema";
import { isUuid } from "@/lib/ids";
import { addDays, toLocalDate } from "@/lib/time";
import { isPublicToken } from "@/server/services/booking";
import type { AvailabilityException, AvailabilityRule, BusyInterval } from "@/server/services/availability";
import { getPrimaryStaff, type Reader } from "./business";

/**
 * Everything the public pages and the booking flow read. Rows are mapped into
 * explicit DTOs: never spread a database row into something a visitor can see
 * (owner id, plan, staff ids and settings must stay private).
 */

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number | null;
  priceIsFrom: boolean;
}

export interface PublicBusiness {
  slug: string;
  name: string;
  category: typeof businesses.$inferSelect["category"];
  categoryOther: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  linkedinUrl: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  timezone: string;
  confirmationMode: "auto" | "manual";
  cancellationMinHours: number;
  cancellationPolicyText: string | null;
  bookingWindowDays: number;
  services: PublicService[];
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

function toPublicService(row: typeof services.$inferSelect): PublicService {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMin: row.durationMin,
    priceCents: row.priceCents,
    priceIsFrom: row.priceIsFrom,
  };
}

/** Bookable services of a business, in display order. */
export async function listPublicServices(db: Reader, businessId: string): Promise<PublicService[]> {
  const rows = await db
    .select()
    .from(services)
    .where(and(eq(services.businessId, businessId), eq(services.isActive, true), eq(services.isBookableOnline, true)))
    .orderBy(asc(services.sortOrder), asc(services.name), asc(services.id));
  return rows.map(toPublicService);
}

/**
 * A business is public once its onboarding is finished. Returns the DTO plus the
 * internal id (kept apart so it cannot leak by serializing the DTO into a page).
 */
export async function getPublicBusinessBySlug(db: Reader, slug: string): Promise<{ businessId: string; business: PublicBusiness } | null> {
  if (!SLUG_RE.test(slug)) return null;
  const [row] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.slug, slug), isNotNull(businesses.onboardingCompletedAt)))
    .limit(1);
  if (!row) return null;
  return {
    businessId: row.id,
    business: {
      slug: row.slug,
      name: row.name,
      category: row.category,
      categoryOther: row.categoryOther,
      description: row.description,
      phone: row.phone,
      whatsapp: row.whatsapp,
      address: row.address,
      city: row.city,
      state: row.state,
      mapsUrl: row.mapsUrl,
      lat: row.lat,
      lng: row.lng,
      facebookUrl: row.facebookUrl,
      instagramUrl: row.instagramUrl,
      twitterUrl: row.twitterUrl,
      tiktokUrl: row.tiktokUrl,
      youtubeUrl: row.youtubeUrl,
      linkedinUrl: row.linkedinUrl,
      logoUrl: row.logoUrl,
      coverUrl: row.coverUrl,
      timezone: row.timezone,
      confirmationMode: row.confirmationMode,
      cancellationMinHours: row.cancellationMinHours,
      cancellationPolicyText: row.cancellationPolicyText,
      bookingWindowDays: row.bookingWindowDays,
      services: [],
    },
  };
}

export type BusinessRow = typeof businesses.$inferSelect;

export interface AvailabilityContext {
  staffId: string;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  busy: BusyInterval[];
}

/**
 * Inputs of the availability engine for the business's staff: weekly rules,
 * exceptions inside the booking window and the busy ranges of pending/confirmed
 * appointments that have not ended yet.
 */
export async function loadAvailabilityContext(db: Reader, business: Pick<BusinessRow, "id" | "timezone" | "bookingWindowDays">, now: Date): Promise<AvailabilityContext | null> {
  const staff = await getPrimaryStaff(db, business.id);
  if (!staff || !staff.isActive) return null;

  const today = toLocalDate(now, business.timezone);
  const lastDay = addDays(today, business.bookingWindowDays);

  const [rules, exceptionRows, busyRows] = await Promise.all([
    db
      .select({ weekday: availabilityRules.weekday, startTime: availabilityRules.startTime, endTime: availabilityRules.endTime })
      .from(availabilityRules)
      .where(eq(availabilityRules.staffId, staff.id)),
    db
      .select({ date: availabilityExceptions.date, type: availabilityExceptions.type, startTime: availabilityExceptions.startTime, endTime: availabilityExceptions.endTime })
      .from(availabilityExceptions)
      .where(eq(availabilityExceptions.staffId, staff.id)),
    db
      .select({ start: appointments.startsAt, end: appointments.blockedUntil })
      .from(appointments)
      .where(and(eq(appointments.staffId, staff.id), inArray(appointments.status, ["pending", "confirmed"]), gt(appointments.blockedUntil, now))),
  ]);

  const exceptions: AvailabilityException[] = [];
  for (const e of exceptionRows) {
    if (e.date < today || e.date > lastDay) continue;
    if (e.type === "closed") exceptions.push({ date: e.date, type: "closed" });
    else if (e.startTime && e.endTime) exceptions.push({ date: e.date, type: "custom_hours", startTime: e.startTime, endTime: e.endTime });
  }

  return { staffId: staff.id, rules, exceptions, busy: busyRows };
}

/** A service a visitor may book: active, bookable online and owned by this business. Foreign or malformed ids are "not found". */
export async function getBookableService(db: Reader, businessId: string, serviceId: unknown) {
  if (!isUuid(serviceId)) return null;
  const [row] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.businessId, businessId), eq(services.isActive, true), eq(services.isBookableOnline, true)))
    .limit(1);
  return row ?? null;
}

/** Full row of a published business, for server-side booking logic only. Never send this to the browser. */
export async function getBookingBusinessBySlug(db: Reader, slug: unknown): Promise<BusinessRow | null> {
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) return null;
  const [row] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.slug, slug), isNotNull(businesses.onboardingCompletedAt)))
    .limit(1);
  return row ?? null;
}

/** Where owner notices go: the account that owns the business. */
export async function getOwnerContact(db: Reader, businessId: string): Promise<{ name: string; email: string } | null> {
  const [row] = await db
    .select({ name: user.name, email: user.email })
    .from(businesses)
    .innerJoin(user, eq(user.id, businesses.ownerUserId))
    .where(eq(businesses.id, businessId))
    .limit(1);
  return row ?? null;
}

export interface ClientAppointment {
  id: string;
  status: typeof appointments.$inferSelect["status"];
  startsAt: Date;
  endsAt: Date;
  serviceName: string;
  priceCents: number | null;
  clientName: string;
  business: {
    id: string;
    slug: string;
    name: string;
    category: BusinessRow["category"];
    timezone: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    whatsapp: string | null;
    cancellationMinHours: number;
    cancellationPolicyText: string | null;
  };
}

/**
 * The appointment behind a private link. The token is the only credential, so a
 * malformed one is "not found" without touching the database. Exposes the
 * client's own name, never their phone or email.
 */
export async function getAppointmentByToken(db: Reader, token: unknown): Promise<ClientAppointment | null> {
  if (!isPublicToken(token)) return null;
  const [row] = await db
    .select({ appointment: appointments, business: businesses, clientName: clients.name })
    .from(appointments)
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(eq(appointments.publicToken, token))
    .limit(1);
  if (!row) return null;
  const { appointment: a, business: b } = row;
  return {
    id: a.id,
    status: a.status,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    serviceName: a.serviceNameSnapshot,
    priceCents: a.priceCentsSnapshot,
    clientName: row.clientName,
    business: {
      id: b.id,
      slug: b.slug,
      name: b.name,
      category: b.category,
      timezone: b.timezone,
      address: b.address,
      city: b.city,
      phone: b.phone,
      whatsapp: b.whatsapp,
      cancellationMinHours: b.cancellationMinHours,
      cancellationPolicyText: b.cancellationPolicyText,
    },
  };
}
