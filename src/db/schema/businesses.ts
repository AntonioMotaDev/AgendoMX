import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { businessCategory, businessPlan, confirmationMode } from "./enums";

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: businessCategory("category").notNull(),
    description: text("description"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    mapsUrl: text("maps_url"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    logoUrl: text("logo_url"),
    coverUrl: text("cover_url"),
    timezone: text("timezone").notNull().default("America/Mexico_City"),
    isListed: boolean("is_listed").notNull().default(false),
    bookingLeadTimeMin: integer("booking_lead_time_min").notNull().default(60),
    bookingWindowDays: integer("booking_window_days").notNull().default(30),
    cancellationMinHours: integer("cancellation_min_hours").notNull().default(4),
    confirmationMode: confirmationMode("confirmation_mode").notNull().default("auto"),
    /** Manual mode only: hours before a `pending` request expires and frees the slot. */
    pendingExpiryHours: integer("pending_expiry_hours").notNull().default(24),
    cancellationPolicyText: text("cancellation_policy_text"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    plan: businessPlan("plan").notNull().default("free"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("businesses_owner_user_id_idx").on(t.ownerUserId),
    check("businesses_slug_format", sql`${t.slug} ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'`),
    check("businesses_lead_time_nonneg", sql`${t.bookingLeadTimeMin} >= 0`),
    check("businesses_window_range", sql`${t.bookingWindowDays} BETWEEN 1 AND 365`),
    check("businesses_pending_expiry_range", sql`${t.pendingExpiryHours} BETWEEN 1 AND 168`),
    check("businesses_cancel_hours_nonneg", sql`${t.cancellationMinHours} >= 0`),
  ],
);
