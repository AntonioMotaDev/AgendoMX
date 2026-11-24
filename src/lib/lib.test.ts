import { describe, expect, it } from "vitest";
import { normalizeMxPhone, toWhatsAppNumber } from "./phone";
import { checkSlug, slugify } from "./reserved-slugs";
import { addDays, parseTimeOfDay, toLocalDate, weekdayOf, zonedToUtc } from "./time";
import { generatePublicToken } from "./tokens";

describe("phone", () => {
  it.each([
    ["5512345678", "+525512345678"],
    ["55 1234 5678", "+525512345678"],
    ["(55) 1234-5678", "+525512345678"],
    ["+52 55 1234 5678", "+525512345678"],
    ["+52 1 55 1234 5678", "+525512345678"],
    ["3312345678", "+523312345678"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeMxPhone(input)).toBe(expected);
  });

  it.each(["", "123", "55123456", "+14155552671", "abc"])("rejects %s", (input) => {
    expect(normalizeMxPhone(input)).toBeNull();
  });

  it("builds wa.me numbers", () => {
    expect(toWhatsAppNumber("+525512345678")).toBe("525512345678");
  });
});

describe("slugs", () => {
  it("slugifies Spanish names", () => {
    expect(slugify("Barbería Don Juan")).toBe("barberia-don-juan");
    expect(slugify("  Uñas & Más  ")).toBe("unas-y-mas");
  });

  it("accepts valid slugs", () => {
    expect(checkSlug("barberia-juan")).toEqual({ ok: true });
  });

  it.each(["ab", "-abc", "abc-", "ABC", "a_b", "á-b", "a".repeat(41)])("rejects bad format %s", (s) => {
    expect(checkSlug(s)).toEqual({ ok: false, reason: "format" });
  });

  it("rejects double hyphens", () => {
    expect(checkSlug("a--b")).toEqual({ ok: false, reason: "double_hyphen" });
  });

  it.each(["app", "api", "cita", "explorar", "login", "precios", "privacidad"])("rejects reserved %s", (s) => {
    expect(checkSlug(s)).toEqual({ ok: false, reason: "reserved" });
  });
});

describe("time", () => {
  it("parses times of day", () => {
    expect(parseTimeOfDay("09:30")).toBe(570);
    expect(parseTimeOfDay("09:30:00")).toBe(570);
    expect(parseTimeOfDay("24:00")).toBe(1440);
    expect(() => parseTimeOfDay("24:01")).toThrow();
    expect(() => parseTimeOfDay("09:60")).toThrow();
  });

  it("does calendar arithmetic across months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(() => addDays("2026-02-30", 1)).toThrow();
  });

  it("computes weekdays", () => {
    expect(weekdayOf("2026-11-24")).toBe(2); // Tuesday
  });

  it("converts between local and UTC", () => {
    expect(zonedToUtc("2026-11-24", 9 * 60, "America/Mexico_City").toISOString()).toBe("2026-11-24T15:00:00.000Z");
    expect(toLocalDate(new Date("2026-11-25T03:00:00Z"), "America/Mexico_City")).toBe("2026-11-24");
  });
});

describe("tokens", () => {
  it("generates 32-char URL-safe unique tokens", () => {
    const tokens = new Set(Array.from({ length: 1000 }, generatePublicToken));
    expect(tokens.size).toBe(1000);
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
});
