import { z } from "zod";
import { BUSINESS_CATEGORIES } from "@/lib/categories";
import { copy } from "@/lib/copy";
import { MX_STATES } from "@/lib/mx-states";
import { checkSlug } from "@/lib/reserved-slugs";
import type { ScheduleIssue, WeeklySchedule } from "@/server/services/schedule";

const v = copy.onboarding.validation;
const b = copy.onboarding.business;

export const SLUG_ERROR_MESSAGES = {
  format: b.slugFormat,
  reserved: b.slugReserved,
  double_hyphen: b.slugDoubleHyphen,
} as const;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, v.slugRequired)
  .superRefine((slug, ctx) => {
    const check = checkSlug(slug);
    if (!check.ok) ctx.addIssue({ code: "custom", message: SLUG_ERROR_MESSAGES[check.reason] });
  });

export const CATEGORY_OTHER_MAX = 60;

/** Shared by onboarding and the profile screen so both validate a business the same way. */
export const businessIdentityFields = {
  name: z.string().trim().min(1, v.nameRequired).max(80, v.nameLong),
  category: z.enum(BUSINESS_CATEGORIES, { error: v.categoryRequired }),
  /** Only meaningful when category is "other"; ignored (and cleared) otherwise. */
  categoryOther: z.string().trim().max(CATEGORY_OTHER_MAX, v.categoryOtherRequired).nullish(),
  state: z.enum(MX_STATES, { error: v.stateRequired }),
  city: z.string().trim().min(1, v.cityRequired).max(60, v.cityLong),
};

type CategoryShape = { category: (typeof BUSINESS_CATEGORIES)[number]; categoryOther?: string | null };

/** "Otro" needs the owner's own description of the business. */
export function requireCategoryOther(data: CategoryShape, ctx: z.RefinementCtx) {
  if (data.category === "other" && (data.categoryOther ?? "").length < 2) {
    ctx.addIssue({ code: "custom", path: ["categoryOther"], message: v.categoryOtherRequired });
  }
}

/** Keeps the custom type only for "other"; a stale value from a previous choice never leaks through. */
export function normalizeCategoryOther<T extends CategoryShape>(data: T): Omit<T, "categoryOther"> & { categoryOther: string | null } {
  return { ...data, categoryOther: data.category === "other" ? (data.categoryOther ?? "") : null };
}

export const businessStepSchema = z
  .object({ ...businessIdentityFields, slug: slugSchema })
  .superRefine(requireCategoryOther)
  .transform(normalizeCategoryOther);

export type BusinessStepInput = z.input<typeof businessStepSchema>;
export type BusinessStepData = z.output<typeof businessStepSchema>;

export const MAX_PRICE_CENTS = 100_000_000; // $1,000,000.00

/**
 * "180", "180.5", "$1,200.00" → cents. Empty → null (price hidden).
 * Returns "invalid" for anything else (negative, 3 decimals, letters).
 */
export function parsePriceToCents(input: string): number | null | "invalid" {
  const cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "").replace(/\s/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return "invalid";
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export const DURATION_OPTIONS_MIN = [15, 30, 45, 60, 90, 120] as const;

/** Price field: "$1,200.50" → cents, empty → null (hidden). */
export const priceSchema = z
  .string()
  .default("")
  .transform((value, ctx) => {
    const cents = parsePriceToCents(value);
    if (cents === "invalid") {
      ctx.addIssue({ code: "custom", message: v.priceInvalid });
      return z.NEVER;
    }
    if (cents !== null && cents > MAX_PRICE_CENTS) {
      ctx.addIssue({ code: "custom", message: v.priceTooHigh });
      return z.NEVER;
    }
    return cents;
  });

export const durationSchema = z
  .number({ error: v.durationInvalid })
  .int(v.durationInvalid)
  .min(5, v.durationInvalid)
  .max(720, v.durationInvalid);

export const serviceStepSchema = z.object({
  name: z.string().trim().min(1, v.serviceNameRequired).max(80, v.serviceNameLong),
  price: priceSchema,
  durationMin: durationSchema,
});

export type ServiceStepInput = z.input<typeof serviceStepSchema>;
export type ServiceStepData = z.output<typeof serviceStepSchema>;

const timeBlockSchema = z.object({ start: z.string().max(5), end: z.string().max(5) });

/** Seven entries, one per weekday 0–6. Business rules live in validateSchedule. */
export const scheduleStepSchema = z.object({
  days: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), blocks: z.array(timeBlockSchema).max(6) }))
    .length(7),
});

export type ScheduleStepInput = z.input<typeof scheduleStepSchema>;

export function daysToSchedule(days: ScheduleStepInput["days"]): WeeklySchedule {
  const schedule: WeeklySchedule = {};
  for (const day of days) schedule[day.weekday] = day.blocks.map((block) => ({ ...block }));
  return schedule;
}

export function scheduleIssueMessage(issue: ScheduleIssue): string {
  const day = "weekday" in issue ? copy.onboarding.schedule.days[issue.weekday] : null;
  const text = copy.onboarding.schedule.issues[issue.code];
  return day ? `${day}: ${text}` : text;
}
