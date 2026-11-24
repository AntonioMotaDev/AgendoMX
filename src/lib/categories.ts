/** Mirrors the `business_category` enum (checked in src/lib/lib.test.ts-style test below). */
export const BUSINESS_CATEGORIES = [
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
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];
