/**
 * Schedule exceptions: a date (or a range of dates) that is closed, or runs on
 * special hours instead of the weekly schedule. Pure functions, no I/O.
 * Semantics live in availability.ts: `closed` wins over everything and
 * `custom_hours` REPLACES the weekly rules for that date.
 */
import { addDays, parseLocalDate, type LocalDate } from "@/lib/time";
import { MAX_BLOCKS_PER_DAY, validateSchedule, type TimeBlock } from "./schedule";

export type ExceptionKind = "closed" | "custom_hours";

export interface ExceptionInput {
  startDate: LocalDate;
  /** Inclusive. Omit (or equal to startDate) for a single day. */
  endDate?: LocalDate | null;
  kind: ExceptionKind;
  /** Only for custom_hours: one or two blocks. */
  blocks: TimeBlock[];
}

export const MAX_RANGE_DAYS = 90;
/** How far ahead an exception may be created. */
export const MAX_DAYS_AHEAD = 366;

export type ExceptionIssue =
  | "bad_date"
  | "past"
  | "too_far"
  | "range_order"
  | "range_too_long"
  | "custom_needs_blocks"
  | "bad_blocks";

function isValidDate(value: string): boolean {
  try {
    const { year, month, day } = parseLocalDate(value);
    return addDays(value, 0) === `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  } catch {
    return false;
  }
}

/** Number of calendar days from `from` to `to`, inclusive of both ends. */
function daysInclusive(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000) + 1;
}

/** Every date the exception covers, in order. Assumes a valid input. */
export function expandDates(startDate: LocalDate, endDate?: LocalDate | null): LocalDate[] {
  const last = endDate && endDate > startDate ? endDate : startDate;
  const total = daysInclusive(startDate, last);
  return Array.from({ length: total }, (_, i) => addDays(startDate, i));
}

/** Empty array = valid. `today` is the business's local date. */
export function validateException(input: ExceptionInput, today: LocalDate): ExceptionIssue[] {
  const issues: ExceptionIssue[] = [];
  const end = input.endDate || null;

  if (!isValidDate(input.startDate) || (end !== null && !isValidDate(end))) return ["bad_date"];
  if (input.startDate < today) issues.push("past");
  if (end !== null && end < input.startDate) return [...issues, "range_order"];

  const last = end ?? input.startDate;
  if (daysInclusive(input.startDate, last) > MAX_RANGE_DAYS) issues.push("range_too_long");
  if (daysInclusive(today, last) > MAX_DAYS_AHEAD) issues.push("too_far");

  if (input.kind === "custom_hours") {
    if (input.blocks.length === 0) issues.push("custom_needs_blocks");
    else if (input.blocks.length > MAX_BLOCKS_PER_DAY || validateSchedule({ 1: input.blocks }).length > 0) issues.push("bad_blocks");
  }
  return issues;
}

export interface ExceptionRow {
  date: string;
  type: ExceptionKind;
  startTime: string | null;
  endTime: string | null;
}

export interface ExceptionDay {
  date: LocalDate;
  kind: ExceptionKind;
  blocks: TimeBlock[];
}

const trim = (time: string) => time.slice(0, 5);

/** Rows (several per date for split custom hours) → one entry per date, sorted. `closed` wins a mixed date. */
export function groupExceptionRows(rows: readonly ExceptionRow[]): ExceptionDay[] {
  const byDate = new Map<LocalDate, ExceptionDay>();
  for (const row of rows) {
    const day = byDate.get(row.date) ?? { date: row.date, kind: row.type, blocks: [] };
    if (row.type === "closed") {
      day.kind = "closed";
      day.blocks = [];
    } else if (day.kind !== "closed" && row.startTime && row.endTime) {
      day.blocks.push({ start: trim(row.startTime), end: trim(row.endTime) });
    }
    byDate.set(row.date, day);
  }
  return [...byDate.values()]
    .map((day) => ({ ...day, blocks: [...day.blocks].sort((a, b) => a.start.localeCompare(b.start)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
