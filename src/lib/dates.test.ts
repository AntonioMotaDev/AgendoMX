import { describe, expect, it } from "vitest";
import { displayLocalDate } from "./dates";

describe("displayLocalDate", () => {
  it("formats a calendar date in es-MX without shifting the day", () => {
    expect(displayLocalDate("2026-12-24")).toMatch(/24 de diciembre/);
    expect(displayLocalDate("2026-12-24", true)).toMatch(/jueves, 24 de diciembre de 2026|jueves 24 de diciembre de 2026/);
    expect(displayLocalDate("2027-01-01")).toMatch(/1 de enero/);
  });
  it("is stable across machine time zones", () => {
    expect(displayLocalDate("2026-03-01")).toMatch(/1 de marzo/);
  });
});
