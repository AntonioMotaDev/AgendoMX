import { describe, expect, it } from "vitest";
import { expandDates, groupExceptionRows, MAX_RANGE_DAYS, validateException, type ExceptionInput } from "./exceptions";

const today = "2026-12-01";
const closed = (startDate: string, endDate?: string): ExceptionInput => ({ startDate, endDate, kind: "closed", blocks: [] });
const special = (startDate: string, blocks: Array<[string, string]>): ExceptionInput => ({
  startDate,
  kind: "custom_hours",
  blocks: blocks.map(([start, end]) => ({ start, end })),
});

describe("expandDates", () => {
  it("returns a single day, or an inclusive range", () => {
    expect(expandDates("2026-12-24")).toEqual(["2026-12-24"]);
    expect(expandDates("2026-12-24", "2026-12-24")).toEqual(["2026-12-24"]);
    expect(expandDates("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
  it("handles leap days and ignores an end before the start", () => {
    expect(expandDates("2028-02-28", "2028-03-01")).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
    expect(expandDates("2026-12-10", "2026-12-01")).toEqual(["2026-12-10"]);
  });
});

describe("validateException", () => {
  it("accepts a closed day, today included, and a closed range", () => {
    expect(validateException(closed("2026-12-24"), today)).toEqual([]);
    expect(validateException(closed("2026-12-01"), today)).toEqual([]);
    expect(validateException(closed("2026-12-20", "2027-01-05"), today)).toEqual([]);
  });

  it("rejects malformed and impossible dates", () => {
    expect(validateException(closed("24/12/2026"), today)).toEqual(["bad_date"]);
    expect(validateException(closed("2026-02-30"), today)).toEqual(["bad_date"]);
    expect(validateException(closed("2026-13-01"), today)).toEqual(["bad_date"]);
    expect(validateException(closed("2026-12-24", "nope"), today)).toEqual(["bad_date"]);
  });

  it("rejects past dates, reversed ranges, huge ranges and dates too far ahead", () => {
    expect(validateException(closed("2026-11-30"), today)).toContain("past");
    expect(validateException(closed("2026-12-10", "2026-12-05"), today)).toContain("range_order");
    expect(validateException(closed("2026-12-02", "2027-03-30"), today)).toContain("range_too_long");
    expect(MAX_RANGE_DAYS).toBe(90);
    expect(validateException(closed("2028-01-15"), today)).toContain("too_far");
  });

  it("requires valid blocks for special hours", () => {
    expect(validateException(special("2026-12-24", [["10:00", "14:00"]]), today)).toEqual([]);
    expect(validateException(special("2026-12-24", [["09:00", "13:00"], ["16:00", "19:00"]]), today)).toEqual([]);
    expect(validateException(special("2026-12-24", []), today)).toEqual(["custom_needs_blocks"]);
    expect(validateException(special("2026-12-24", [["14:00", "10:00"]]), today)).toEqual(["bad_blocks"]);
    expect(validateException(special("2026-12-24", [["09:00", "14:00"], ["13:00", "18:00"]]), today)).toEqual(["bad_blocks"]);
    expect(validateException(special("2026-12-24", [["09:10", "14:00"]]), today)).toEqual(["bad_blocks"]);
    expect(validateException(special("2026-12-24", [["06:00", "08:00"], ["09:00", "12:00"], ["13:00", "18:00"]]), today)).toEqual(["bad_blocks"]);
  });
});

describe("groupExceptionRows", () => {
  it("merges split custom hours into one day, sorted, with seconds trimmed", () => {
    const days = groupExceptionRows([
      { date: "2026-12-26", type: "closed", startTime: null, endTime: null },
      { date: "2026-12-24", type: "custom_hours", startTime: "16:00:00", endTime: "19:00:00" },
      { date: "2026-12-24", type: "custom_hours", startTime: "09:00:00", endTime: "13:00:00" },
    ]);
    expect(days).toEqual([
      { date: "2026-12-24", kind: "custom_hours", blocks: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "19:00" }] },
      { date: "2026-12-26", kind: "closed", blocks: [] },
    ]);
  });

  it("lets closed win when a date somehow has both", () => {
    const [day] = groupExceptionRows([
      { date: "2026-12-24", type: "custom_hours", startTime: "09:00:00", endTime: "13:00:00" },
      { date: "2026-12-24", type: "closed", startTime: null, endTime: null },
    ]);
    expect(day).toEqual({ date: "2026-12-24", kind: "closed", blocks: [] });
  });
});
