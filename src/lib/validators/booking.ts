import { z } from "zod";
import { copy } from "@/lib/copy";
import { normalizeMxPhone } from "@/lib/phone";

const e = copy.public.booking.errors;

/** Public slug as it arrives from the URL; the query validates the format again. */
const slug = z.string().trim().min(3).max(40);

export const availabilityRequestSchema = z.object({
  slug,
  serviceId: z.string().trim().min(1, e.serviceInvalid).max(64),
});

export const bookingRequestSchema = z.object({
  slug,
  serviceId: z.string().trim().min(1, e.serviceInvalid).max(64),
  start: z.string().min(1, e.slotInvalid).max(40),
  name: z.string().trim().min(1, e.nameRequired).max(80, e.nameLong),
  phone: z
    .string()
    .trim()
    .min(1, e.phoneInvalid)
    .max(30, e.phoneInvalid)
    .transform((value, ctx) => {
      const normalized = normalizeMxPhone(value);
      if (!normalized) ctx.addIssue({ code: "custom", message: e.phoneInvalid });
      return normalized ?? "";
    }),
  email: z
    .string()
    .trim()
    .max(254, e.emailInvalid)
    .nullish()
    .transform((value, ctx) => {
      if (!value) return null;
      if (!z.email().safeParse(value).success) ctx.addIssue({ code: "custom", message: e.emailInvalid });
      return value.toLowerCase();
    }),
  /** Honeypot: hidden from people, bots fill it in. */
  website: z.string().max(200).nullish(),
  turnstileToken: z.string().max(2048).nullish(),
});

export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export const cancelRequestSchema = z.object({
  token: z.string().min(1).max(64),
});
