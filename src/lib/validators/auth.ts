import { z } from "zod";
import { copy } from "@/lib/copy";

const v = copy.auth.validation;

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

const email = z
  .string()
  .trim()
  .min(1, v.emailRequired)
  .max(254, v.emailInvalid)
  .pipe(z.email(v.emailInvalid))
  .transform((value) => value.toLowerCase());

const newPassword = z.string().min(PASSWORD_MIN, v.passwordShort).max(PASSWORD_MAX, v.passwordLong);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, v.passwordRequired).max(PASSWORD_MAX, v.passwordLong),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, v.nameRequired).max(80, v.nameLong),
  email,
  password: newPassword,
});

/** Registration when the legal texts are published: the box must be ticked. */
export const registerWithTermsSchema = registerSchema.extend({
  acceptTerms: z.boolean().refine((value) => value === true, copy.auth.register.acceptRequired),
});
export type RegisterWithTermsInput = z.infer<typeof registerWithTermsSchema>;

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ password: newPassword });

export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
