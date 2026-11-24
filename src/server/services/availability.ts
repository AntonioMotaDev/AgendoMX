/**
 * Slot availability — the heart of AgendoMX. Pure function, no I/O.
 * See CLAUDE.md §5 "Cálculo de disponibilidad".
 *
 * Semantics:
 * - Weekly rules and exceptions are wall-clock times in the business's zone.
 * - For a date with a `closed` exception: no availability that day.
 * - For a date with `custom_hours` exceptions: they REPLACE the weekly rules.
 * - Overlapping/adjacent blocks are merged.
 * - Slots start at block start and advance by `slotStepMin` (default 15).
 * - A slot is valid if [start, start + duration + buffer) fits entirely inside
 *   one block and does not overlap any busy interval.
 * - Busy intervals are existing pending/confirmed appointments as
 *   [starts_at, blocked_until) — they already include their own buffer.
 * - Lead time: start >= now + leadTimeMin.
 * - Window: local dates from today through today + windowDays - 1.
 */
import { addDays, parseTimeOfDay, toLocalDate, weekdayOf, zonedToUtc, type LocalDate } from "@/lib/time";

export const DEFAULT_SLOT_STEP_MIN = 15;

export interface AvailabilityRule {
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** "HH:MM" or "HH:MM:SS" */
  startTime: string;
  endTime: string;
}

export type AvailabilityException =
  | { date: LocalDate; type: "closed"; startTime?: null; endTime?: null }
  | { date: LocalDate; type: "custom_hours"; startTime: string; endTime: string };

export interface BusyInterval {
  start: Date;
  /** Exclusive. For appointments this is blocked_until. */
  end: Date;
}

export interface AvailabilityInput {
  timezone: string;
  rules: readonly AvailabilityRule[];
  exceptions: readonly AvailabilityException[];
  busy: readonly BusyInterval[];
  durationMin: number;
  bufferAfterMin: number;
  leadTimeMin: number;
  windowDays: number;
  now: Date;
  slotStepMin?: number;
  /** Optional sub-range (inclusive, local dates), clipped to the window. */
  fromDate?: LocalDate;
  toDate?: LocalDate;
}

export interface Slot {
  start: Date;
  /** End of the service itself (without buffer) — what the client sees. */
  end: Date;
}

export interface DayAvailability {
  date: LocalDate;
  slots: Slot[];
}

interface MinuteBlock {
  start: number;
  end: number;
}

const MINUTE_MS = 60_000;

function mergeBlocks(blocks: MinuteBlock[]): MinuteBlock[] {
  const sorted = blocks.filter((b) => b.end > b.start).sort((a, b) => a.start - b.start);
  const merged: MinuteBlock[] = [];
  for (const block of sorted) {
    const last = merged.at(-1);
    if (last && block.start <= last.end) {
      last.end = Math.max(last.end, block.end);
    } else {
      merged.push({ ...block });
    }
  }
  return merged;
}

function blocksForDate(
  date: LocalDate,
  rules: readonly AvailabilityRule[],
  exceptions: readonly AvailabilityException[],
): MinuteBlock[] {
  const forDate = exceptions.filter((e) => e.date === date);
  if (forDate.some((e) => e.type === "closed")) return [];

  const custom = forDate.filter((e) => e.type === "custom_hours");
  const source =
    custom.length > 0
      ? custom.map((e) => ({ startTime: e.startTime, endTime: e.endTime }))
      : rules.filter((r) => r.weekday === weekdayOf(date));

  return mergeBlocks(
    source.map((r) => ({ start: parseTimeOfDay(r.startTime), end: parseTimeOfDay(r.endTime) })),
  );
}

function assertValidInput(input: AvailabilityInput, step: number): void {
  const intFields: Array<[string, number]> = [
    ["durationMin", input.durationMin],
    ["bufferAfterMin", input.bufferAfterMin],
    ["leadTimeMin", input.leadTimeMin],
    ["windowDays", input.windowDays],
    ["slotStepMin", step],
  ];
  for (const [name, value] of intFields) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  }
  if (input.durationMin === 0) throw new Error("durationMin must be > 0");
  if (step === 0) throw new Error("slotStepMin must be > 0");
}

export function computeAvailability(input: AvailabilityInput): DayAvailability[] {
  const step = input.slotStepMin ?? DEFAULT_SLOT_STEP_MIN;
  assertValidInput(input, step);
  if (input.windowDays === 0) return [];

  const today = toLocalDate(input.now, input.timezone);
  const lastDay = addDays(today, input.windowDays - 1);
  const from = input.fromDate && input.fromDate > today ? input.fromDate : today;
  const to = input.toDate && input.toDate < lastDay ? input.toDate : lastDay;

  const earliestStart = input.now.getTime() + input.leadTimeMin * MINUTE_MS;
  const occupiedMs = (input.durationMin + input.bufferAfterMin) * MINUTE_MS;
  const serviceMs = input.durationMin * MINUTE_MS;
  const stepMs = step * MINUTE_MS;
  const busy = input.busy.map((b) => ({ start: b.start.getTime(), end: b.end.getTime() }));

  const days: DayAvailability[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const slots: Slot[] = [];
    for (const block of blocksForDate(date, input.rules, input.exceptions)) {
      const blockStart = zonedToUtc(date, block.start, input.timezone).getTime();
      const blockEnd = zonedToUtc(date, block.end, input.timezone).getTime();

      for (let start = blockStart; start + occupiedMs <= blockEnd; start += stepMs) {
        if (start < earliestStart) continue;
        const occupiedEnd = start + occupiedMs;
        const clashes = busy.some((b) => start < b.end && b.start < occupiedEnd);
        if (!clashes) slots.push({ start: new Date(start), end: new Date(start + serviceMs) });
      }
    }
    days.push({ date, slots });
  }
  return days;
}

/**
 * Server-side re-validation before inserting an appointment: the requested
 * start must be exactly one of the computed slots. Never trust the client.
 */
export function isSlotAvailable(input: Omit<AvailabilityInput, "fromDate" | "toDate">, start: Date): boolean {
  const date = toLocalDate(start, input.timezone);
  const [day] = computeAvailability({ ...input, fromDate: date, toDate: date });
  if (!day || day.date !== date) return false;
  return day.slots.some((s) => s.start.getTime() === start.getTime());
}
