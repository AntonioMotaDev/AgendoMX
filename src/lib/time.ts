import { TZDate } from "@date-fns/tz";

/** Calendar date in the business's zone, "YYYY-MM-DD". */
export type LocalDate = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

export const DEFAULT_TIMEZONE = "America/Mexico_City";

/** "09:30" or "09:30:00" (Postgres `time`) → minutes since midnight. Accepts "24:00". */
export function parseTimeOfDay(value: string): number {
  const m = TIME_RE.exec(value);
  if (!m) throw new Error(`Invalid time of day: ${value}`);
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  const seconds = Number(m[3] ?? "0");
  const total = hours * 60 + minutes;
  if (minutes > 59 || seconds !== 0 || total > 24 * 60) {
    throw new Error(`Invalid time of day: ${value}`);
  }
  return total;
}

export function parseLocalDate(value: LocalDate): { year: number; month: number; day: number } {
  const m = DATE_RE.exec(value);
  if (!m) throw new Error(`Invalid date: ${value}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new Error(`Invalid date: ${value}`);
  }
  return { year, month, day };
}

function formatLocalDate(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Calendar date of an instant as seen in `timezone`. */
export function toLocalDate(instant: Date, timezone: string): LocalDate {
  const z = new TZDate(instant.getTime(), timezone);
  return formatLocalDate(z.getFullYear(), z.getMonth() + 1, z.getDate());
}

/** Pure calendar arithmetic, independent of any time zone. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return formatLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Wall-clock time in `timezone` → UTC instant. `minutes` may be 1440 (24:00),
 * which resolves to midnight of the next day. Non-existent local times
 * (DST gaps) shift forward; ambiguous ones resolve to the first occurrence.
 */
export function zonedToUtc(date: LocalDate, minutes: number, timezone: string): Date {
  const { year, month, day } = parseLocalDate(date);
  const z = TZDate.tz(timezone, year, month - 1, day, 0, minutes);
  return new Date(z.getTime());
}
