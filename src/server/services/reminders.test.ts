import { describe, expect, it } from "vitest";
import { bookedInAdvance, reminderWindow } from "./reminders";

describe("reminders", () => {
  it("window is (now+2h, now+24h]", () => {
    const w = reminderWindow(new Date("2026-12-02T12:00:00Z"));
    expect(w.startsAfter.toISOString()).toBe("2026-12-02T14:00:00.000Z");
    expect(w.startsUntil.toISOString()).toBe("2026-12-03T12:00:00.000Z");
  });
  it("only appointments booked more than 24 h ahead qualify", () => {
    const starts = new Date("2026-12-03T12:00:00Z");
    expect(bookedInAdvance(new Date("2026-12-01T12:00:00Z"), starts)).toBe(true);
    expect(bookedInAdvance(new Date("2026-12-02T11:59:00Z"), starts)).toBe(true);
    expect(bookedInAdvance(new Date("2026-12-02T12:00:00Z"), starts)).toBe(false);
    expect(bookedInAdvance(new Date("2026-12-03T09:00:00Z"), starts)).toBe(false);
  });
});
