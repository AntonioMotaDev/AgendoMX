import { parseLocalDate, type LocalDate } from "@/lib/time";

const dayFormatter = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });
const longFormatter = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** A calendar date (no time zone attached) shown as "jue 24 de diciembre". Pinned to UTC so it never shifts a day. */
export function displayLocalDate(date: LocalDate, long = false): string {
  const { year, month, day } = parseLocalDate(date);
  const instant = new Date(Date.UTC(year, month - 1, day, 12));
  const text = (long ? longFormatter : dayFormatter).format(instant);
  // Sentence case: only the first letter. CSS `capitalize` would also capitalize "de".
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "miércoles 2 de diciembre" for an instant, in the business's zone. */
export function formatInstantDate(instant: Date, timezone: string): string {
  const text = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: timezone }).format(instant);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "10:00 a.m." for an instant, in the business's zone. */
export function formatInstantTime(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: timezone })
    .format(instant)
    .replace(/\s/g, " ");
}

/** "Miércoles 2 de diciembre, 10:00 a.m." */
export function formatInstantDateTime(instant: Date, timezone: string): string {
  return `${formatInstantDate(instant, timezone)}, ${formatInstantTime(instant, timezone)}`;
}
