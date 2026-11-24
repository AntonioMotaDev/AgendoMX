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
