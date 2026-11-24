import { describe, expect, it } from "vitest";
import {
  computeAvailability,
  isSlotAvailable,
  type AvailabilityInput,
  type AvailabilityRule,
} from "./availability";

const CDMX = "America/Mexico_City"; // UTC-6 all year (no DST since 2022)
const TIJUANA = "America/Tijuana"; // border zone, keeps DST

// Tuesday 2026-11-24, 06:00 CDMX = 12:00Z
const NOW = new Date("2026-11-24T12:00:00Z");

/** Local CDMX wall clock → UTC Date. */
const cdmx = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00-06:00`);
const hhmm = (d: Date, tz = CDMX) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

const weekdays = (start: string, end: string, days = [1, 2, 3, 4, 5]): AvailabilityRule[] =>
  days.map((weekday) => ({ weekday, startTime: start, endTime: end }));

function base(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    timezone: CDMX,
    rules: weekdays("09:00", "12:00"),
    exceptions: [],
    busy: [],
    durationMin: 60,
    bufferAfterMin: 0,
    leadTimeMin: 0,
    windowDays: 7,
    now: NOW,
    ...overrides,
  };
}

function slotsOn(input: AvailabilityInput, date: string): string[] {
  const day = computeAvailability(input).find((d) => d.date === date);
  if (!day) throw new Error(`date ${date} not in result`);
  return day.slots.map((s) => hhmm(s.start, input.timezone));
}

describe("computeAvailability — basics", () => {
  it("generates 15-min slots that fit fully inside the block", () => {
    expect(slotsOn(base(), "2026-11-24")).toEqual([
      "09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30", "10:45", "11:00",
    ]);
  });

  it("slot end is start + duration (buffer is not shown to the client)", () => {
    const [day] = computeAvailability(base({ bufferAfterMin: 15, fromDate: "2026-11-24", toDate: "2026-11-24" }));
    const first = day!.slots[0]!;
    expect(first.end.getTime() - first.start.getTime()).toBe(60 * 60_000);
  });

  it("buffer must also fit inside the block", () => {
    const slots = slotsOn(base({ bufferAfterMin: 15 }), "2026-11-24");
    expect(slots.at(-1)).toBe("10:45"); // 10:45 + 60 + 15 = 12:00
  });

  it("respects a custom slot step", () => {
    expect(slotsOn(base({ slotStepMin: 30 }), "2026-11-24")).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("returns no slots when the service is longer than the block", () => {
    expect(slotsOn(base({ durationMin: 240 }), "2026-11-24")).toEqual([]);
  });

  it("returns no slots on weekdays without rules", () => {
    expect(slotsOn(base(), "2026-11-29")).toEqual([]); // Sunday
  });

  it("accepts Postgres time format HH:MM:SS", () => {
    const rules = [{ weekday: 2, startTime: "09:00:00", endTime: "10:00:00" }];
    expect(slotsOn(base({ rules }), "2026-11-24")).toEqual(["09:00"]);
  });
});

describe("computeAvailability — split shifts", () => {
  it("handles two blocks in the same day (9–14 and 16–20)", () => {
    const rules = [
      { weekday: 2, startTime: "09:00", endTime: "14:00" },
      { weekday: 2, startTime: "16:00", endTime: "20:00" },
    ];
    const slots = slotsOn(base({ rules, durationMin: 120, slotStepMin: 60 }), "2026-11-24");
    expect(slots).toEqual(["09:00", "10:00", "11:00", "12:00", "16:00", "17:00", "18:00"]);
  });

  it("never lets a slot span the gap between blocks", () => {
    const rules = [
      { weekday: 2, startTime: "09:00", endTime: "14:00" },
      { weekday: 2, startTime: "16:00", endTime: "20:00" },
    ];
    const slots = slotsOn(base({ rules, durationMin: 60 }), "2026-11-24");
    expect(slots).not.toContain("13:15");
    expect(slots).toContain("13:00");
    expect(slots).toContain("16:00");
  });

  it("merges overlapping rules without duplicating slots", () => {
    const rules = [
      { weekday: 2, startTime: "09:00", endTime: "11:00" },
      { weekday: 2, startTime: "10:00", endTime: "12:00" },
    ];
    expect(slotsOn(base({ rules }), "2026-11-24")).toEqual(slotsOn(base(), "2026-11-24"));
  });

  it("supports a block ending at 24:00", () => {
    const rules = [{ weekday: 2, startTime: "22:00", endTime: "24:00" }];
    const slots = slotsOn(base({ rules, slotStepMin: 60 }), "2026-11-24");
    expect(slots).toEqual(["22:00", "23:00"]);
  });
});

describe("computeAvailability — existing appointments", () => {
  it("excludes slots that overlap a busy interval", () => {
    const busy = [{ start: cdmx("2026-11-24", "10:00"), end: cdmx("2026-11-24", "11:00") }];
    expect(slotsOn(base({ busy }), "2026-11-24")).toEqual(["09:00", "11:00"]);
  });

  it("allows a slot that ends exactly when a busy interval starts (half-open ranges)", () => {
    const busy = [{ start: cdmx("2026-11-24", "10:00"), end: cdmx("2026-11-24", "11:00") }];
    expect(slotsOn(base({ busy }), "2026-11-24")).toContain("09:00");
  });

  it("new slot's buffer cannot overlap the next appointment", () => {
    const busy = [{ start: cdmx("2026-11-24", "10:15"), end: cdmx("2026-11-24", "11:00") }];
    // 09:00 + 60 + 15 buffer = 10:15 → OK; 09:15 + 75 = 10:30 → clashes
    const slots = slotsOn(base({ busy, bufferAfterMin: 15 }), "2026-11-24");
    expect(slots).toContain("09:00");
    expect(slots).not.toContain("09:15");
  });

  it("existing appointment's buffer (blocked_until) blocks the following slot", () => {
    // Existing 09:00–10:00 with 15-min buffer → blocked until 10:15
    const busy = [{ start: cdmx("2026-11-24", "09:00"), end: cdmx("2026-11-24", "10:15") }];
    const slots = slotsOn(base({ busy }), "2026-11-24");
    expect(slots).not.toContain("10:00");
    expect(slots[0]).toBe("10:15");
  });
});

describe("computeAvailability — exceptions", () => {
  it("closed exception removes the whole day", () => {
    const exceptions = [{ date: "2026-11-24", type: "closed" as const }];
    expect(slotsOn(base({ exceptions }), "2026-11-24")).toEqual([]);
    expect(slotsOn(base({ exceptions }), "2026-11-25")).not.toEqual([]);
  });

  it("custom_hours replaces weekly rules for that date", () => {
    const exceptions = [{ date: "2026-11-24", type: "custom_hours" as const, startTime: "15:00", endTime: "17:00" }];
    expect(slotsOn(base({ exceptions, slotStepMin: 60 }), "2026-11-24")).toEqual(["15:00", "16:00"]);
  });

  it("custom_hours can open a day without weekly rules", () => {
    const exceptions = [{ date: "2026-11-29", type: "custom_hours" as const, startTime: "10:00", endTime: "11:00" }];
    expect(slotsOn(base({ exceptions }), "2026-11-29")).toEqual(["10:00"]);
  });

  it("closed wins over custom_hours on the same date", () => {
    const exceptions = [
      { date: "2026-11-24", type: "custom_hours" as const, startTime: "15:00", endTime: "17:00" },
      { date: "2026-11-24", type: "closed" as const },
    ];
    expect(slotsOn(base({ exceptions }), "2026-11-24")).toEqual([]);
  });
});

describe("computeAvailability — lead time and window", () => {
  it("excludes slots earlier than now + lead time", () => {
    const now = cdmx("2026-11-24", "09:20");
    const slots = slotsOn(base({ now, leadTimeMin: 60 }), "2026-11-24");
    expect(slots[0]).toBe("10:30"); // earliest allowed 10:20 → next slot 10:30
  });

  it("excludes past slots even with zero lead time", () => {
    const now = cdmx("2026-11-24", "10:00");
    expect(slotsOn(base({ now }), "2026-11-24")[0]).toBe("10:00");
  });

  it("window covers today through today + windowDays - 1", () => {
    const days = computeAvailability(base({ windowDays: 3 }));
    expect(days.map((d) => d.date)).toEqual(["2026-11-24", "2026-11-25", "2026-11-26"]);
  });

  it("windowDays 0 returns nothing", () => {
    expect(computeAvailability(base({ windowDays: 0 }))).toEqual([]);
  });

  it("'today' is the business's local date, not the UTC date", () => {
    // 2026-11-25T03:00Z is still Nov 24 at 21:00 in CDMX
    const days = computeAvailability(base({ now: new Date("2026-11-25T03:00:00Z"), windowDays: 1 }));
    expect(days.map((d) => d.date)).toEqual(["2026-11-24"]);
  });

  it("fromDate/toDate are clipped to the window", () => {
    const days = computeAvailability(base({ windowDays: 3, fromDate: "2026-11-01", toDate: "2027-01-01" }));
    expect(days.map((d) => d.date)).toEqual(["2026-11-24", "2026-11-25", "2026-11-26"]);
  });
});

describe("computeAvailability — time zones", () => {
  it("stores instants in UTC: 09:00 CDMX is 15:00Z", () => {
    const [day] = computeAvailability(base({ fromDate: "2026-11-24", toDate: "2026-11-24" }));
    expect(day!.slots[0]!.start.toISOString()).toBe("2026-11-24T15:00:00.000Z");
  });

  it("CDMX has no DST: April 09:00 is still 15:00Z", () => {
    const now = new Date("2026-04-07T06:00:00Z");
    const [day] = computeAvailability(base({ now, windowDays: 1 }));
    expect(day!.slots[0]!.start.toISOString()).toBe("2026-04-07T15:00:00.000Z");
  });

  it("Tijuana follows DST: 09:00 is 17:00Z in winter and 16:00Z in summer", () => {
    const rules = weekdays("09:00", "10:00");
    const winter = computeAvailability(
      base({ timezone: TIJUANA, rules, now: new Date("2026-02-03T10:00:00Z"), windowDays: 1 }),
    );
    const summer = computeAvailability(
      base({ timezone: TIJUANA, rules, now: new Date("2026-07-07T10:00:00Z"), windowDays: 1 }),
    );
    expect(winter[0]!.slots[0]!.start.toISOString()).toBe("2026-02-03T17:00:00.000Z");
    expect(summer[0]!.slots[0]!.start.toISOString()).toBe("2026-07-07T16:00:00.000Z");
  });

  it("DST start day in Tijuana keeps slots in local wall-clock terms", () => {
    // 2026-03-08 (Sunday): clocks jump 02:00 → 03:00
    const rules = [{ weekday: 0, startTime: "09:00", endTime: "11:00" }];
    const slots = slotsOn(
      base({ timezone: TIJUANA, rules, now: new Date("2026-03-08T08:00:00Z"), windowDays: 1, slotStepMin: 60 }),
      "2026-03-08",
    );
    expect(slots).toEqual(["09:00", "10:00"]);
  });
});

describe("computeAvailability — input validation", () => {
  it("rejects zero duration", () => {
    expect(() => computeAvailability(base({ durationMin: 0 }))).toThrow();
  });

  it("rejects non-integer values", () => {
    expect(() => computeAvailability(base({ bufferAfterMin: 2.5 }))).toThrow();
  });

  it("rejects malformed times", () => {
    expect(() => computeAvailability(base({ rules: [{ weekday: 2, startTime: "9am", endTime: "10:00" }] }))).toThrow();
  });
});

describe("isSlotAvailable", () => {
  it("accepts an exact computed slot", () => {
    expect(isSlotAvailable(base(), cdmx("2026-11-24", "09:15"))).toBe(true);
  });

  it("rejects a start not aligned to the slot grid", () => {
    expect(isSlotAvailable(base(), cdmx("2026-11-24", "09:07"))).toBe(false);
  });

  it("rejects a taken slot", () => {
    const busy = [{ start: cdmx("2026-11-24", "09:00"), end: cdmx("2026-11-24", "10:00") }];
    expect(isSlotAvailable(base({ busy }), cdmx("2026-11-24", "09:30"))).toBe(false);
  });

  it("rejects a slot outside the booking window", () => {
    expect(isSlotAvailable(base({ windowDays: 7 }), cdmx("2026-12-15", "09:00"))).toBe(false);
  });

  it("rejects a slot inside the lead time", () => {
    const now = cdmx("2026-11-24", "08:30");
    expect(isSlotAvailable(base({ now, leadTimeMin: 60 }), cdmx("2026-11-24", "09:00"))).toBe(false);
  });
});
