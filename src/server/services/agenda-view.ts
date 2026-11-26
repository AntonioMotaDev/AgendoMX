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
  /** 24-hour clock in the business's zone, for the agenda's time column: "10:00" and "10:45". */
  startClock: string;
  endClock: string;
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

/** "10:30" (24 h) for an instant, in the business's zone. */
export function clockLabel(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(instant);
}

/** The appointment the owner should look at next: the first confirmed one that has not ended yet. Expects `items` sorted by start. */
export function nextUpcoming(items: AgendaItem[], now: Date): AgendaItem | null {
  return items.find((i) => i.status === "confirmed" && i.endsAt.getTime() > now.getTime()) ?? null;
}

/** Free minutes between two consecutive appointments, or null when the gap is too short to be worth showing (under 30 min). */
export function gapMinutes(previous: Pick<AgendaItem, "endsAt">, next: Pick<AgendaItem, "startsAt">): number | null {
  const minutes = Math.round((next.startsAt.getTime() - previous.endsAt.getTime()) / 60000);
  return minutes >= 30 ? minutes : null;
}

/** "45 min", "1 h", "1 h 15 min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** How far away an appointment starts: "en 18 min", "en 2 h 5 min", or "en curso" once it has started. */
export function untilLabel(startsAt: Date, now: Date): string {
  const minutes = Math.ceil((startsAt.getTime() - now.getTime()) / 60000);
  return minutes <= 0 ? t.inProgress : t.startsIn(formatDuration(minutes));
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
    startClock: clockLabel(item.startsAt, tz),
    endClock: clockLabel(item.endsAt, tz),
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
