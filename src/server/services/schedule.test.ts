import { describe, expect, it } from "vitest";
import {
  applyPreset,
  rulesToSchedule,
  SCHEDULE_PRESETS,
  scheduleToRules,
  timeOptions,
  validateSchedule,
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
