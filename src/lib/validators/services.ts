import { z } from "zod";
import { copy } from "@/lib/copy";
import { durationSchema, priceSchema } from "./onboarding";

const t = copy.panel.services;
const v = copy.onboarding.validation;

export const BUFFER_OPTIONS_MIN = [0, 5, 10, 15, 20, 30, 45, 60] as const;

export const serviceFormSchema = z
  .object({
    name: z.string().trim().min(1, v.serviceNameRequired).max(80, v.serviceNameLong),
    description: z
      .string()
      .trim()
      .max(280, t.errors.descriptionLong)
      .nullish()
      .transform((value) => (value ? value : null)),
    price: priceSchema,
    priceIsFrom: z.boolean(),
    durationMin: durationSchema,
    bufferAfterMin: z.number({ error: t.errors.bufferInvalid }).int(t.errors.bufferInvalid).min(0, t.errors.bufferInvalid).max(240, t.errors.bufferInvalid),
    isBookableOnline: z.boolean(),
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.priceIsFrom && data.price === null) {
      ctx.addIssue({ code: "custom", path: ["price"], message: t.errors.priceFromNeedsPrice });
    }
  });

export type ServiceFormInput = z.input<typeof serviceFormSchema>;
export type ServiceFormData = z.output<typeof serviceFormSchema>;
