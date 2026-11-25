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

/** "+525512345678" → "55 1234 5678", the way owners type it. Anything else is returned unchanged. */
export function formatMxPhoneForInput(e164: string | null): string {
  if (!e164) return "";
  const m = /^\+52(\d{2})(\d{4})(\d{4})$/.exec(e164);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : e164;
}
