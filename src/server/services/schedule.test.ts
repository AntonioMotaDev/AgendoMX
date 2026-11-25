import { describe, expect, it } from "vitest";
import {
  applyPreset,
  rulesToSchedule,
  SCHEDULE_PRESETS,
  scheduleToRules,
  setWeekdays,
  SHIFT_SUGGESTIONS,
  hasShift,
  timeOptions,
  toggleShift,
  validateSchedule,
  WORKWEEK,
  workweekIsUniform,
  type TimeBlock,
  type WeeklySchedule,
} from "./schedule";

const open = (blocks: Array<[string, string]>) => blocks.map(([start, end]) => ({ start, end }));

describe("validateSchedule", () => {
  it("accepts every preset", () => {
    for (const preset of SCHEDULE_PRESETS) expect(validateSchedule(applyPreset(preset))).toEqual([]);
  });

  it("requires at least one open day", () => {
    expect(validateSchedule({})).toEqual([{ code: "no_open_days" }]);
    expect(validateSchedule({ 1: [] })).toEqual([{ code: "no_open_days" }]);
  });

  it("accepts a split shift (9–14 and 16–20) and a 24:00 close", () => {
    expect(validateSchedule({ 1: open([["09:00", "14:00"], ["16:00", "20:00"]]) })).toEqual([]);
    expect(validateSchedule({ 5: open([["18:00", "24:00"]]) })).toEqual([]);
  });

  it("rejects end before or equal to start", () => {
    expect(validateSchedule({ 2: open([["10:00", "10:00"]]) })).toContainEqual({ code: "end_before_start", weekday: 2 });
    expect(validateSchedule({ 2: open([["18:00", "09:00"]]) })).toContainEqual({ code: "end_before_start", weekday: 2 });
  });

  it("rejects overlapping blocks, even when entered out of order", () => {
    expect(validateSchedule({ 3: open([["09:00", "14:00"], ["13:00", "18:00"]]) })).toContainEqual({ code: "overlap", weekday: 3 });
    expect(validateSchedule({ 3: open([["13:00", "18:00"], ["09:00", "14:00"]]) })).toContainEqual({ code: "overlap", weekday: 3 });
  });

  it("allows back-to-back blocks", () => {
    expect(validateSchedule({ 3: open([["09:00", "14:00"], ["14:00", "18:00"]]) })).toEqual([]);
  });

  it("rejects more than two blocks a day", () => {
    const s: WeeklySchedule = { 4: open([["06:00", "08:00"], ["09:00", "12:00"], ["13:00", "18:00"]]) };
    expect(validateSchedule(s)).toContainEqual({ code: "too_many_blocks", weekday: 4 });
  });

  it("rejects times off the 15-minute grid or malformed", () => {
    expect(validateSchedule({ 1: open([["09:10", "18:00"]]) })).toContainEqual({ code: "bad_time", weekday: 1 });
    expect(validateSchedule({ 1: open([["9am", "18:00"]]) })).toContainEqual({ code: "bad_time", weekday: 1 });
    expect(validateSchedule({ 1: open([["24:00", "24:00"]]) })).toContainEqual({ code: "bad_time", weekday: 1 });
    expect(validateSchedule({ 1: open([["09:00", "25:00"]]) })).toContainEqual({ code: "bad_time", weekday: 1 });
  });
});

describe("rules <-> schedule", () => {
  it("round-trips, trimming Postgres seconds", () => {
    const schedule: WeeklySchedule = { 1: open([["09:00", "14:00"], ["16:00", "20:00"]]), 6: open([["10:00", "15:00"]]) };
    const rules = scheduleToRules(schedule);
    expect(rules).toEqual([
      { weekday: 1, startTime: "09:00", endTime: "14:00" },
      { weekday: 1, startTime: "16:00", endTime: "20:00" },
      { weekday: 6, startTime: "10:00", endTime: "15:00" },
    ]);
    const fromDb = rules.map((r) => ({ ...r, startTime: `${r.startTime}:00`, endTime: `${r.endTime}:00` }));
    expect(rulesToSchedule(fromDb)).toMatchObject(schedule);
  });

  it("sorts blocks inside a day", () => {
    const rules = scheduleToRules({ 2: open([["16:00", "20:00"], ["09:00", "14:00"]]) });
    expect(rules.map((r) => r.startTime)).toEqual(["09:00", "16:00"]);
  });
});

describe("presets and pickers", () => {
  it("weekdays preset opens Monday to Friday only", () => {
    const s = applyPreset(SCHEDULE_PRESETS[0]!);
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => (s[d]?.length ?? 0) > 0)).toEqual([false, true, true, true, true, true, false]);
  });

  it("start options end at 23:45 and end options reach 24:00", () => {
    expect(timeOptions("start")[0]).toBe("05:00");
    expect(timeOptions("start").at(-1)).toBe("23:45");
    expect(timeOptions("end")[0]).toBe("05:15");
    expect(timeOptions("end").at(-1)).toBe("24:00");
  });
});

describe("workweek helpers", () => {
  it("detects a uniform Monday-to-Friday schedule", () => {
    expect(workweekIsUniform(applyPreset(SCHEDULE_PRESETS[0]!))).toBe(true);
    expect(workweekIsUniform(applyPreset(SCHEDULE_PRESETS[1]!))).toBe(true);
    expect(workweekIsUniform({})).toBe(true);
  });

  it("is not uniform when one weekday differs or has a different split", () => {
    const base = applyPreset(SCHEDULE_PRESETS[0]!);
    expect(workweekIsUniform({ ...base, 3: open([["10:00", "18:00"]]) })).toBe(false);
    expect(workweekIsUniform({ ...base, 5: [] })).toBe(false);
    expect(workweekIsUniform({ ...base, 2: open([["09:00", "14:00"], ["16:00", "18:00"]]) })).toBe(false);
  });

  it("ignores the weekend when judging uniformity", () => {
    expect(workweekIsUniform({ ...applyPreset(SCHEDULE_PRESETS[0]!), 6: open([["10:00", "14:00"]]) })).toBe(true);
  });

  it("setWeekdays copies the blocks to each day without sharing references or touching other days", () => {
    const base = applyPreset(SCHEDULE_PRESETS[0]!);
    const split = open([["09:00", "14:00"], ["16:00", "20:00"]]);
    const next = setWeekdays({ ...base, 6: open([["10:00", "13:00"]]) }, WORKWEEK, split);
    for (const day of WORKWEEK) expect(next[day]).toEqual(split);
    expect(next[1]).not.toBe(next[2]);
    expect(next[6]).toEqual(open([["10:00", "13:00"]]));
    expect(base[1]).toEqual(open([["09:00", "18:00"]]));
    expect(validateSchedule(next)).toEqual([]);
  });
});

describe("toggleShift", () => {
  const [morning, afternoon, full] = SHIFT_SUGGESTIONS.map((s) => s.block) as [TimeBlock, TimeBlock, TimeBlock];

  it("morning then afternoon builds the usual split shift", () => {
    const first = toggleShift([], morning);
    expect(first).toEqual([morning]);
    const second = toggleShift(first, afternoon);
    expect(second).toEqual([morning, afternoon]);
    expect(validateSchedule({ 1: second })).toEqual([]);
  });

  it("keeps the blocks sorted whichever order they are tapped", () => {
    expect(toggleShift([afternoon], morning)).toEqual([morning, afternoon]);
  });

  it("tapping a selected shift removes it", () => {
    expect(toggleShift([morning, afternoon], afternoon)).toEqual([morning]);
    expect(toggleShift([morning], morning)).toEqual([]);
  });

  it("replaces instead of overlapping: 'full day' over a morning shift", () => {
    expect(toggleShift([morning], full)).toEqual([full]);
    expect(toggleShift([afternoon], full)).toEqual([full]);
  });

  it("replaces custom blocks when a third block would exceed the limit", () => {
    const custom = open([["06:00", "08:00"], ["22:00", "23:00"]]);
    expect(toggleShift(custom, morning)).toEqual([morning]);
  });

  it("does not mutate its input", () => {
    const blocks = [{ ...morning }];
    toggleShift(blocks, afternoon);
    expect(blocks).toEqual([morning]);
  });

  it("every suggestion is valid on its own and mutually compatible where it should be", () => {
    for (const s of SHIFT_SUGGESTIONS) expect(validateSchedule({ 1: [s.block] })).toEqual([]);
    expect(hasShift([morning], morning)).toBe(true);
    expect(hasShift([morning], afternoon)).toBe(false);
  });
});
