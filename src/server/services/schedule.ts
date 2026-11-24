/**
 * Weekly schedule logic shared by onboarding and the schedule screen.
 * Pure functions, no I/O. Times are wall-clock "HH:MM" in the business's zone
 * and live on a 15-minute grid (the booking slot granularity).
 */
import { parseTimeOfDay } from "@/lib/time";

export interface TimeBlock {
  /** "HH:MM", 00:00–23:45 */
  start: string;
  /** "HH:MM", up to 24:00 */
  end: string;
}

/** weekday (0 = Sunday … 6 = Saturday) → blocks. Missing or empty = closed. */
export type WeeklySchedule = Partial<Record<number, TimeBlock[]>>;

export interface ScheduleRule {
  weekday: number;
  startTime: string;
  endTime: string;
}

export const MAX_BLOCKS_PER_DAY = 2;
export const TIME_STEP_MIN = 15;
/** Mexican week order for display: Monday first. */
export const DISPLAY_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

export type ScheduleIssue =
  | { code: "no_open_days" }
  | { code: "bad_time" | "end_before_start" | "overlap" | "too_many_blocks"; weekday: number };

function minutes(value: string): number | null {
  try {
    return parseTimeOfDay(value);
  } catch {
    return null;
  }
}

export function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Sorts blocks by start time within each day. Does not mutate the input. */
export function normalizeSchedule(schedule: WeeklySchedule): WeeklySchedule {
  const result: WeeklySchedule = {};
  for (let weekday = 0; weekday <= 6; weekday++) {
    const blocks = schedule[weekday] ?? [];
    result[weekday] = [...blocks].sort((a, b) => (minutes(a.start) ?? 0) - (minutes(b.start) ?? 0));
  }
  return result;
}

/** Empty array = valid. */
export function validateSchedule(schedule: WeeklySchedule): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  let openDays = 0;

  for (let weekday = 0; weekday <= 6; weekday++) {
    const blocks = normalizeSchedule(schedule)[weekday] ?? [];
    if (blocks.length === 0) continue;
    openDays++;
    if (blocks.length > MAX_BLOCKS_PER_DAY) issues.push({ code: "too_many_blocks", weekday });

    let previousEnd = -1;
    for (const block of blocks) {
      const start = minutes(block.start);
      const end = minutes(block.end);
      const onGrid = start !== null && end !== null && start % TIME_STEP_MIN === 0 && end % TIME_STEP_MIN === 0;
      if (start === null || end === null || !onGrid || start >= 24 * 60) {
        issues.push({ code: "bad_time", weekday });
        continue;
      }
      if (end <= start) {
        issues.push({ code: "end_before_start", weekday });
        continue;
      }
      if (start < previousEnd) issues.push({ code: "overlap", weekday });
      previousEnd = Math.max(previousEnd, end);
    }
  }

  if (openDays === 0) issues.push({ code: "no_open_days" });
  return issues;
}

/** Flattens a valid schedule into availability_rules rows (sorted by day, then start). */
export function scheduleToRules(schedule: WeeklySchedule): ScheduleRule[] {
  const normalized = normalizeSchedule(schedule);
  const rules: ScheduleRule[] = [];
  for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
    for (const block of normalized[weekday] ?? []) {
      rules.push({ weekday, startTime: block.start, endTime: block.end });
    }
  }
  return rules;
}

/** availability_rules rows (Postgres `time` may include seconds) → editable schedule. */
export function rulesToSchedule(rules: readonly ScheduleRule[]): WeeklySchedule {
  const schedule: WeeklySchedule = {};
  for (const rule of rules) {
    const start = minutes(rule.startTime);
    const end = minutes(rule.endTime);
    if (start === null || end === null) continue;
    (schedule[rule.weekday] ??= []).push({ start: formatTime(start), end: formatTime(end) });
  }
  return normalizeSchedule(schedule);
}

export interface SchedulePreset {
  id: "weekdays" | "mon_sat" | "every_day";
  weekdays: readonly number[];
  block: TimeBlock;
}

export const SCHEDULE_PRESETS: readonly SchedulePreset[] = [
  { id: "weekdays", weekdays: [1, 2, 3, 4, 5], block: { start: "09:00", end: "18:00" } },
  { id: "mon_sat", weekdays: [1, 2, 3, 4, 5, 6], block: { start: "10:00", end: "19:00" } },
  { id: "every_day", weekdays: [0, 1, 2, 3, 4, 5, 6], block: { start: "10:00", end: "20:00" } },
];

export function applyPreset(preset: SchedulePreset): WeeklySchedule {
  const schedule: WeeklySchedule = {};
  for (let weekday = 0; weekday <= 6; weekday++) {
    schedule[weekday] = preset.weekdays.includes(weekday) ? [{ ...preset.block }] : [];
  }
  return schedule;
}

/** 05:00–23:45 start options and 05:15–24:00 end options for the pickers. */
export function timeOptions(kind: "start" | "end"): string[] {
  const options: string[] = [];
  const first = kind === "start" ? 5 * 60 : 5 * 60 + TIME_STEP_MIN;
  const last = kind === "start" ? 23 * 60 + 45 : 24 * 60;
  for (let t = first; t <= last; t += TIME_STEP_MIN) options.push(formatTime(t));
  return options;
}

/** Monday to Friday: the days owners usually run on one schedule. */
export const WORKWEEK = [1, 2, 3, 4, 5] as const;

export function blocksEqual(a: readonly TimeBlock[], b: readonly TimeBlock[]): boolean {
  return a.length === b.length && a.every((block, i) => block.start === b[i]!.start && block.end === b[i]!.end);
}

/** True when Monday to Friday all have exactly the same blocks (closed on all five counts too). */
export function workweekIsUniform(schedule: WeeklySchedule): boolean {
  const normalized = normalizeSchedule(schedule);
  const monday = normalized[WORKWEEK[0]] ?? [];
  return WORKWEEK.every((weekday) => blocksEqual(normalized[weekday] ?? [], monday));
}

/** Copies `blocks` onto each of `weekdays`. Does not mutate the input. */
export function setWeekdays(schedule: WeeklySchedule, weekdays: readonly number[], blocks: readonly TimeBlock[]): WeeklySchedule {
  const next: WeeklySchedule = { ...schedule };
  for (const weekday of weekdays) next[weekday] = blocks.map((block) => ({ ...block }));
  return next;
}

export interface ShiftSuggestion {
  id: "morning" | "afternoon" | "full";
  block: TimeBlock;
}

/** Quick shifts. Morning + afternoon together make the usual split shift. */
export const SHIFT_SUGGESTIONS: readonly ShiftSuggestion[] = [
  { id: "morning", block: { start: "09:00", end: "14:00" } },
  { id: "afternoon", block: { start: "16:00", end: "20:00" } },
  { id: "full", block: { start: "09:00", end: "18:00" } },
];

export function hasShift(blocks: readonly TimeBlock[], shift: TimeBlock): boolean {
  return blocks.some((block) => block.start === shift.start && block.end === shift.end);
}

function overlaps(blocks: readonly TimeBlock[]): boolean {
  const sorted = [...blocks].sort((a, b) => (minutes(a.start) ?? 0) - (minutes(b.start) ?? 0));
  return sorted.some((block, i) => i > 0 && (minutes(block.start) ?? 0) < (minutes(sorted[i - 1]!.end) ?? 0));
}

/**
 * Taps a suggested shift. A selected one is removed; otherwise it is added next
 * to the existing blocks. If that would overlap or exceed the daily limit, the
 * suggestion replaces the day's blocks instead, so a tap always does something sensible.
 */
export function toggleShift(blocks: readonly TimeBlock[], shift: TimeBlock): TimeBlock[] {
  if (hasShift(blocks, shift)) return blocks.filter((block) => !(block.start === shift.start && block.end === shift.end)).map((b) => ({ ...b }));
  const candidate = [...blocks.map((b) => ({ ...b })), { ...shift }];
  if (candidate.length > MAX_BLOCKS_PER_DAY || overlaps(candidate)) return [{ ...shift }];
  return candidate.sort((a, b) => (minutes(a.start) ?? 0) - (minutes(b.start) ?? 0));
}
