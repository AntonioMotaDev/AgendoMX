import { describe, expect, it } from "vitest";
import { localDayBounds, parseLocalDateOrNull, weekStart } from "./time";

describe("localDayBounds", () => {
  it("is [local midnight, next local midnight) in UTC", () => {
    const { start, end } = localDayBounds("2026-12-02", "America/Mexico_City");
    expect(start.toISOString()).toBe("2026-12-02T06:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-03T06:00:00.000Z");
  });
  it("handles a 25-hour day (DST ends in Tijuana on 2026-11-01)", () => {
    const { start, end } = localDayBounds("2026-11-01", "America/Tijuana");
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });
});

describe("weekStart", () => {
  it("is the Monday of the week, for any day of it", () => {
    for (const d of ["2026-11-23", "2026-11-25", "2026-11-29"]) expect(weekStart(d)).toBe("2026-11-23");
    expect(weekStart("2026-11-30")).toBe("2026-11-30");
  });
  it("crosses month and year boundaries", () => {
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
  });
});

describe("parseLocalDateOrNull", () => {
  it("accepts real dates only", () => {
    expect(parseLocalDateOrNull("2026-12-02")).toBe("2026-12-02");
    for (const bad of ["2026-02-30", "26-1-1", "", null, undefined, 5, "2026-12-02T00:00"]) expect(parseLocalDateOrNull(bad)).toBeNull();
  });
});
