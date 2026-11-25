import { describe, expect, it } from "vitest";
import { localDayBounds } from "./time";

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
