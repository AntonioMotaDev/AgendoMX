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
import { businessCategory, businessPlan, businessTheme, confirmationMode } from "./enums";

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
    /** Free-text business type, only when category = 'other'. */
    categoryOther: text("category_other"),
    description: text("description"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    mapsUrl: text("maps_url"),
    // Social profiles, stored as normalized https URLs (see src/lib/social.ts).
    facebookUrl: text("facebook_url"),
    instagramUrl: text("instagram_url"),
    twitterUrl: text("twitter_url"),
    tiktokUrl: text("tiktok_url"),
    youtubeUrl: text("youtube_url"),
    linkedinUrl: text("linkedin_url"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    logoUrl: text("logo_url"),
    coverUrl: text("cover_url"),
    timezone: text("timezone").notNull().default("America/Mexico_City"),
    theme: businessTheme("theme").notNull().default("studio"),
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
    check(
      "businesses_category_other",
      sql`${t.categoryOther} IS NULL OR (${t.category} = 'other' AND char_length(${t.categoryOther}) BETWEEN 2 AND 60)`,
    ),
    check(
      "businesses_media_paths",
      sql`(${t.logoUrl} IS NULL OR ${t.logoUrl} LIKE '/media/businesses/%') AND (${t.coverUrl} IS NULL OR ${t.coverUrl} LIKE '/media/businesses/%')`,
    ),
    check(
      "businesses_social_https",
      sql`(${t.facebookUrl} IS NULL OR ${t.facebookUrl} LIKE 'https://%')
        AND (${t.instagramUrl} IS NULL OR ${t.instagramUrl} LIKE 'https://%')
        AND (${t.twitterUrl} IS NULL OR ${t.twitterUrl} LIKE 'https://%')
        AND (${t.tiktokUrl} IS NULL OR ${t.tiktokUrl} LIKE 'https://%')
        AND (${t.youtubeUrl} IS NULL OR ${t.youtubeUrl} LIKE 'https://%')
        AND (${t.linkedinUrl} IS NULL OR ${t.linkedinUrl} LIKE 'https://%')`,
    ),
    check("businesses_pending_expiry_range", sql`${t.pendingExpiryHours} BETWEEN 1 AND 168`),
    check("businesses_cancel_hours_nonneg", sql`${t.cancellationMinHours} >= 0`),
  ],
);
