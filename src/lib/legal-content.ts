import { privacyClientsFull, privacyClientsHealthConsent, privacyClientsShort, privacyOwners, terms, version } from "@/content/legal/generated";

/** Pure helpers over the generated legal texts (no env, no I/O): safe to unit-test and to import anywhere. */
export const LEGAL_VERSION = version;
export const LEGAL_TEXTS = { privacyOwners, terms, privacyClientsShort, privacyClientsHealthConsent, privacyClientsFull } as const;

export interface BusinessIdentity {
  slug: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
}

const PLACEHOLDERS = {
  name: ["{Nombre del negocio}", "{Nombre / razón social del negocio}"],
  address: ["{domicilio del negocio}"],
  contact: ["{teléfono / WhatsApp del negocio}"],
} as const;

/**
 * The data the client notice must show about its controller (the business). While the legal texts are
 * published, a business without them cannot take online bookings: the notice would be incomplete.
 * Returns what is missing; empty means complete.
 */
export function missingControllerData(business: Pick<BusinessIdentity, "address" | "city" | "state" | "phone" | "whatsapp">): Array<"address" | "contact"> {
  const filled = (value: string | null) => value !== null && value.trim() !== "";
  const missing: Array<"address" | "contact"> = [];
  if (!filled(business.address) || !filled(business.city) || !filled(business.state)) missing.push("address");
  if (!filled(business.phone) && !filled(business.whatsapp)) missing.push("contact");
  return missing;
}

/** "55 1234 5678" for "+525512345678"; anything else is returned as stored. */
function prettyPhone(e164: string): string {
  const m = /^\+52(\d{2})(\d{4})(\d{4})$/.exec(e164);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Fills the business-specific placeholders of the client notice. The business is the data controller there. */
export function fillClientNotice(text: string, business: BusinessIdentity): string {
  const address = [business.address, business.city, business.state].filter(Boolean).join(", ");
  const contact = [business.whatsapp && `WhatsApp ${prettyPhone(business.whatsapp)}`, business.phone && `teléfono ${prettyPhone(business.phone)}`].filter(Boolean).join(" · ");
  let out = text.replaceAll("{slug}", business.slug);
  for (const token of PLACEHOLDERS.name) out = out.replaceAll(token, business.name);
  for (const token of PLACEHOLDERS.address) out = out.replaceAll(token, address || "el que aparece en su perfil público");
  for (const token of PLACEHOLDERS.contact) out = out.replaceAll(token, contact || "los datos de contacto de su perfil público");
  return out;
}

/** Leftovers a reviewer must still resolve before the texts can be published. */
export const DRAFT_MARKER = /\[[^\]\n]+\](?!\()|BORRADOR/;

/**
 * Sign-up gate. While the legal texts are published, an account is only created if the request
 * carries the exact current version, i.e. the person ticked the box on the form that showed that version.
 * Returns the error code to refuse with, or null when the request may proceed.
 */
export function termsAcceptanceError(body: unknown, published: boolean): "TERMS_NOT_ACCEPTED" | null {
  if (!published) return null;
  const given = typeof body === "object" && body !== null && "termsVersion" in body ? (body as { termsVersion: unknown }).termsVersion : undefined;
  return given === LEGAL_VERSION ? null : "TERMS_NOT_ACCEPTED";
}
