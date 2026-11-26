import { pgEnum } from "drizzle-orm/pg-core";

export const businessCategory = pgEnum("business_category", [
  "barbershop",
  "beauty_salon",
  "nails",
  "spa",
  "physiotherapy",
  "psychology",
  "nutrition",
  "dentistry",
  "medical",
  "fitness",
  "tattoo",
  "other",
]);

export const businessPlan = pgEnum("business_plan", ["free", "pro"]);

/** Visual theme of the public profile and booking flow. Keep in sync with `THEME_IDS` in src/lib/themes.ts. */
export const businessTheme = pgEnum("business_theme", ["studio", "noir", "bloom", "earth", "coast", "signal"]);

export const availabilityExceptionType = pgEnum("availability_exception_type", [
  "closed",
  "custom_hours",
]);

export const appointmentStatus = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
  // Manual-confirmation flow: the owner declined, or never answered in time.
  "rejected",
  "expired",
]);

/** auto: bookings start as `confirmed`. manual: they start as `pending` until the owner approves. */
export const confirmationMode = pgEnum("confirmation_mode", ["auto", "manual"]);

export const appointmentEventType = pgEnum("appointment_event_type", [
  "created",
  "confirmed",
  "rejected",
  "expired",
  "cancelled",
  "completed",
  "no_show",
  "rescheduled",
]);

export const eventActor = pgEnum("event_actor", ["owner", "client", "system"]);

export const appointmentSource = pgEnum("appointment_source", [
  "public_link",
  "manual",
  "directory",
]);

export const cancelledBy = pgEnum("cancelled_by", ["business", "client"]);
