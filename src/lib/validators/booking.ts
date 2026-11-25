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

/** Who the appointment is for. Shared by the public flow and the owner's manual form. */
const clientFields = {
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
};

export const bookingRequestSchema = z.object({
  slug,
  serviceId: z.string().trim().min(1, e.serviceInvalid).max(64),
  start: z.string().min(1, e.slotInvalid).max(40),
  ...clientFields,
  /** Honeypot: hidden from people, bots fill it in. */
  website: z.string().max(200).nullish(),
  /** Express authorization box, shown only for health categories while the legal texts are published. */
  healthConsent: z.boolean().nullish(),
  turnstileToken: z.string().max(2048).nullish(),
});

export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export const cancelRequestSchema = z.object({
  token: z.string().min(1).max(64),
});

/**
 * The owner's manual appointment. "slot" sends an instant the engine offered;
 * "custom" sends a local date and time (the business's zone), for walk-ins and
 * special hours, and the server converts it.
 */
export const manualAppointmentSchema = z
  .object({
    serviceId: z.string().trim().min(1, e.serviceInvalid).max(64),
    mode: z.enum(["slot", "custom"]),
    start: z.string().max(40).nullish(),
    date: z.string().max(10).nullish(),
    time: z.string().max(5).nullish(),
    ...clientFields,
  })
  .superRefine((data, ctx) => {
    if (data.mode === "slot" && !data.start) ctx.addIssue({ code: "custom", path: ["start"], message: e.slotInvalid });
    if (data.mode === "custom" && (!data.date || !data.time)) ctx.addIssue({ code: "custom", path: ["time"], message: e.slotInvalid });
  });

export const manualSlotsSchema = z.object({ serviceId: z.string().trim().min(1, e.serviceInvalid).max(64) });
