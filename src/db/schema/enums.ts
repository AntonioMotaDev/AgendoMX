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
]);

export const appointmentSource = pgEnum("appointment_source", [
  "public_link",
  "manual",
  "directory",
]);

export const cancelledBy = pgEnum("cancelled_by", ["business", "client"]);
