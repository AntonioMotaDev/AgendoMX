import { describe, expect, it } from "vitest";
import { groupSlots, hourOfLabel } from "./slot-groups";

describe("hourOfLabel", () => {
  it("reads 12-hour es-MX labels", () => {
    expect(hourOfLabel("9:30 a.m.")).toBe(9);
    expect(hourOfLabel("12:00 p.m.")).toBe(12);
    expect(hourOfLabel("12:15 a.m.")).toBe(0);
    expect(hourOfLabel("7:45 p.m.")).toBe(19);
    expect(hourOfLabel("4:00 PM")).toBe(16);
  });
  it("returns null for anything else", () => {
    expect(hourOfLabel("16:00")).toBeNull();
    expect(hourOfLabel("")).toBeNull();
  });
});

describe("groupSlots", () => {
  const slot = (label: string) => ({ label, start: label });
  it("groups by part of the day, in order, skipping empty parts", () => {
    const groups = groupSlots([slot("9:00 a.m."), slot("11:30 a.m."), slot("1:00 p.m."), slot("7:00 p.m.")]);
    expect(groups.map((g) => [g.part, g.slots.length])).toEqual([["morning", 2], ["afternoon", 1], ["evening", 1]]);
    expect(groupSlots([slot("2:00 p.m.")]).map((g) => g.part)).toEqual(["afternoon"]);
  });
  it("keeps one plain list when a label cannot be read", () => {
    expect(groupSlots([slot("9:00 a.m."), slot("tarde")])).toEqual([{ part: null, slots: [slot("9:00 a.m."), slot("tarde")] }]);
    expect(groupSlots([])).toEqual([]);
  });
});
