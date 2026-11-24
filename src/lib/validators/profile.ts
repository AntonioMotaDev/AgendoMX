import { z } from "zod";
import { copy } from "@/lib/copy";
import { normalizeMapsUrl } from "@/lib/maps";
import { normalizeMxPhone } from "@/lib/phone";
import { normalizeSocial, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social";
import { businessIdentityFields, normalizeCategoryOther, requireCategoryOther, slugSchema } from "./onboarding";

const p = copy.panel.profile;

/** Blank → null; otherwise `parse` decides. Keeps "empty means remove" consistent across fields. */
const emptyToNull = (value: string | null | undefined) => (value && value.trim() !== "" ? value.trim() : null);

function optionalPhone(message: string) {
  return z
    .string()
    .nullish()
    .transform((value, ctx) => {
      const raw = emptyToNull(value);
      if (raw === null) return null;
      const e164 = normalizeMxPhone(raw);
      if (!e164) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return e164;
    });
}

export const profileInfoSchema = z
  .object({
    ...businessIdentityFields,
    description: z.string().trim().max(500, p.info.descriptionLong).nullish().transform(emptyToNull),
    address: z.string().trim().max(160, p.info.addressLong).nullish().transform(emptyToNull),
    mapsUrl: z
      .string()
      .nullish()
      .transform((value, ctx) => {
        const result = normalizeMapsUrl(value ?? "");
        if (!result.ok) {
          ctx.addIssue({ code: "custom", message: p.info.mapsUrlInvalid });
          return z.NEVER;
        }
        return result.url;
      }),
    phone: optionalPhone(p.info.phoneInvalid),
    whatsapp: optionalPhone(p.info.phoneInvalid),
    email: z
      .string()
      .trim()
      .max(254, p.info.emailInvalid)
      .nullish()
      .transform((value, ctx) => {
        const raw = emptyToNull(value);
        if (raw === null) return null;
        if (!z.email().safeParse(raw).success) {
          ctx.addIssue({ code: "custom", message: p.info.emailInvalid });
          return z.NEVER;
        }
        return raw.toLowerCase();
      }),
  })
  .superRefine(requireCategoryOther)
  .transform(normalizeCategoryOther);

export type ProfileInfoInput = z.input<typeof profileInfoSchema>;
export type ProfileInfoData = z.output<typeof profileInfoSchema>;

function socialField(platform: SocialPlatform) {
  return z
    .string()
    .nullish()
    .transform((value, ctx) => {
      const result = normalizeSocial(platform, value ?? "");
      if (!result.ok) {
        ctx.addIssue({ code: "custom", message: platform === "linkedin" ? p.social.invalidLinkedin : p.social.invalid(p.social.networks[platform]) });
        return z.NEVER;
      }
      return result.url;
    });
}

export const socialLinksSchema = z.object(
  Object.fromEntries(SOCIAL_PLATFORMS.map((platform) => [platform, socialField(platform)])) as Record<SocialPlatform, ReturnType<typeof socialField>>,
);

export type SocialLinksInput = z.input<typeof socialLinksSchema>;
export type SocialLinksData = z.output<typeof socialLinksSchema>;

export const slugChangeSchema = z.object({
  slug: slugSchema,
  acknowledge: z.literal(true, { error: p.link.acknowledgeRequired }),
});

const whole = (min: number, max: number, message: string) => z.number({ error: message }).int(message).min(min, message).max(max, message);
const generic = copy.panel.common.genericError;

export const bookingSettingsSchema = z.object({
  confirmationMode: z.enum(["auto", "manual"], { error: generic }),
  pendingExpiryHours: whole(1, 168, generic),
  bookingLeadTimeMin: whole(0, 60 * 24 * 30, generic),
  bookingWindowDays: whole(1, 365, generic),
  cancellationMinHours: whole(0, 168, generic),
  cancellationPolicyText: z.string().trim().max(280, p.booking.policyLong).nullish().transform(emptyToNull),
});

export type BookingSettingsInput = z.input<typeof bookingSettingsSchema>;
export type BookingSettingsData = z.output<typeof bookingSettingsSchema>;
