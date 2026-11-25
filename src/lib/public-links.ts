import { toWhatsAppNumber } from "@/lib/phone";

/** wa.me link with an optional prefilled message. `e164` is the stored "+52…" number. */
export function whatsappLink(e164: string, message?: string): string {
  const base = `https://wa.me/${toWhatsAppNumber(e164)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function telLink(e164: string): string {
  return `tel:${e164}`;
}

/** The owner's own maps link, or a Google Maps search built from the address. */
export function directionsLink(business: { mapsUrl: string | null; address: string | null; city: string | null; state: string | null }): string | null {
  if (business.mapsUrl) return business.mapsUrl;
  const query = [business.address, business.city, business.state].filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

/** OpenStreetMap embed centered on a pin (about 400 m across). Only built from numeric coordinates. */
export function osmEmbedUrl(lat: number, lng: number): string {
  const d = 0.003;
  const bbox = [lng - d, lat - d, lng + d, lat + d].map((n) => n.toFixed(6)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
