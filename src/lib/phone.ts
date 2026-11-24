import { parsePhoneNumberFromString } from "libphonenumber-js/min";

/**
 * Normalizes a Mexican phone number to E.164 (+52 + 10 digits).
 * Accepts "55 1234 5678", "5512345678", "+52 55 1234 5678" and the legacy
 * mobile prefix "+521…". Returns null when the number is not a valid MX number.
 */
export function normalizeMxPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.length === 0) return null;
  // Legacy "+52 1" mobile prefix: dropped from the numbering plan in 2019.
  const cleaned = digits.replace(/^(\+?52)1(\d{10})$/, "$1$2");
  const parsed = parsePhoneNumberFromString(cleaned, "MX");
  if (!parsed || parsed.country !== "MX" || !parsed.isValid()) return null;
  return parsed.number;
}

/** wa.me expects digits only, without "+". */
export function toWhatsAppNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}
