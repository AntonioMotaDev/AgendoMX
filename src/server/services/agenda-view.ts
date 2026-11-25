/**
 * Turns appointment rows into what an agenda card shows. Pure: no I/O, so the
 * labels, WhatsApp links and offered actions are unit-tested. Everything here is
 * serializable (strings only) because it crosses into a client component.
 */
import type { BusinessCategory } from "@/lib/categories";
import { copy } from "@/lib/copy";
import { formatInstantDate, formatInstantDateTime, formatInstantTime } from "@/lib/dates";
import { formatMxnShort } from "@/lib/money";
import { whatsappLink } from "@/lib/public-links";
import type { AgendaItem } from "@/server/queries/appointments";
import { availableActions, type AppointmentStatus, type OwnerAction } from "./appointment-status";
import { isSensitiveCategory } from "./booking";

const t = copy.panel.agenda;

export type AgendaMode = "today" | "tomorrow" | "week" | "pending";

export interface AgendaCardData {
  id: string;
  status: AppointmentStatus;
  /** "10:00 a.m. – 10:45 a.m." */
  timeLabel: string;
  /** Full date and start time; used where the day matters (pending requests). */
  whenLabel: string;
  clientName: string;
  serviceName: string;
  priceLabel: string | null;
  /** wa.me link with a ready message, or null when the mode has none. */
  whatsappHref: string | null;
  whatsappLabel: string;
  actions: OwnerAction[];
}

interface Context {
  business: { name: string; category: BusinessCategory; timezone: string };
  now: Date;
}

const firstName = (full: string) => full.trim().split(/\s+/)[0] || full;

export function buildAgendaCard(item: AgendaItem, mode: AgendaMode, { business, now }: Context): AgendaCardData {
  const tz = business.timezone;
  const startTime = formatInstantTime(item.startsAt, tz);
  const live = item.status === "pending" || item.status === "confirmed";

  let whatsappHref: string | null = null;
  let whatsappLabel: string = t.whatsapp;
  if (mode === "tomorrow" && live) {
    const service = isSensitiveCategory(business.category) ? null : item.serviceName;
    whatsappHref = whatsappLink(item.clientPhone, t.messages.reminder(firstName(item.clientName), business.name, formatInstantDate(item.startsAt, tz).toLowerCase().replace(",", ""), startTime, service));
    whatsappLabel = t.remind;
  } else if (mode === "today" && live) {
    whatsappHref = whatsappLink(item.clientPhone, t.messages.contact(firstName(item.clientName), business.name, startTime));
  } else if (mode === "pending" || (mode === "week" && live)) {
    whatsappHref = whatsappLink(item.clientPhone);
  }

  return {
    id: item.id,
    status: item.status,
    timeLabel: `${startTime} – ${formatInstantTime(item.endsAt, tz)}`,
    whenLabel: formatInstantDateTime(item.startsAt, tz),
    clientName: item.clientName,
    serviceName: item.serviceName,
    priceLabel: item.priceCents === null ? null : formatMxnShort(item.priceCents),
    whatsappHref,
    whatsappLabel,
    // Tomorrow is only for reminding and cancelling: closing out an appointment makes no sense yet.
    actions: availableActions(item, now),
  };
}
