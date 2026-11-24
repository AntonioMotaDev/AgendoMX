import { describe, expect, it } from "vitest";
import { BUSINESS_CATEGORIES } from "@/lib/categories";
import { businessStepSchema, parsePriceToCents, scheduleIssueMessage, serviceStepSchema, slugSchema } from "./onboarding";
import { businessCategory } from "@/db/schema/enums";

describe("categories", () => {
  it("match the database enum exactly", () => {
    expect([...BUSINESS_CATEGORIES].sort()).toEqual([...businessCategory.enumValues].sort());
  });
});

describe("slugSchema", () => {
  it("lowercases and trims valid slugs", () => {
    expect(slugSchema.parse("  Barberia-Juan ")).toBe("barberia-juan");
  });
  it("rejects reserved, malformed and double-hyphen slugs with friendly messages", () => {
    expect(slugSchema.safeParse("login").error?.issues[0]?.message).toMatch(/no se puede usar/);
    expect(slugSchema.safeParse("ab").error?.issues[0]?.message).toMatch(/3 a 40/);
    expect(slugSchema.safeParse("-juan").success).toBe(false);
    expect(slugSchema.safeParse("juan--barber").error?.issues[0]?.message).toMatch(/dos guiones/);
    expect(slugSchema.safeParse("").error?.issues[0]?.message).toMatch(/Elige el link/);
  });
});

describe("businessStepSchema", () => {
  const valid = { name: " Barbería Juan ", category: "barbershop", state: "San Luis Potosí", city: " SLP ", slug: "barberia-juan" };
  it("trims and accepts a valid step", () => {
    expect(businessStepSchema.parse(valid)).toMatchObject({ name: "Barbería Juan", city: "SLP" });
  });
  it("rejects unknown categories and states", () => {
    expect(businessStepSchema.safeParse({ ...valid, category: "hacker" }).success).toBe(false);
    expect(businessStepSchema.safeParse({ ...valid, state: "Narnia" }).success).toBe(false);
  });
});

describe("parsePriceToCents", () => {
  it("parses common ways of typing a price", () => {
    expect(parsePriceToCents("180")).toBe(18000);
    expect(parsePriceToCents("180.5")).toBe(18050);
    expect(parsePriceToCents("$1,200.00")).toBe(120000);
    expect(parsePriceToCents(" 0 ")).toBe(0);
  });
  it("treats empty as hidden and rejects junk", () => {
    expect(parsePriceToCents("")).toBeNull();
    expect(parsePriceToCents("   ")).toBeNull();
    for (const bad of ["-5", "12.345", "abc", "1e3", "12,5,5x"]) expect(parsePriceToCents(bad)).toBe("invalid");
  });
});

describe("serviceStepSchema", () => {
  it("converts the price to cents and keeps the duration", () => {
    expect(serviceStepSchema.parse({ name: "Corte", price: "180", durationMin: 45 })).toEqual({ name: "Corte", price: 18000, durationMin: 45 });
    expect(serviceStepSchema.parse({ name: "Corte", price: "", durationMin: 30 }).price).toBeNull();
  });
  it("rejects absurd prices and durations", () => {
    expect(serviceStepSchema.safeParse({ name: "Corte", price: "2000000", durationMin: 30 }).success).toBe(false);
    expect(serviceStepSchema.safeParse({ name: "Corte", price: "1", durationMin: 0 }).success).toBe(false);
    expect(serviceStepSchema.safeParse({ name: "Corte", price: "1", durationMin: 721 }).success).toBe(false);
    expect(serviceStepSchema.safeParse({ name: "", price: "1", durationMin: 30 }).success).toBe(false);
  });
});

describe("scheduleIssueMessage", () => {
  it("names the day when the issue belongs to one", () => {
    expect(scheduleIssueMessage({ code: "overlap", weekday: 3 })).toMatch(/^Miércoles:/);
    expect(scheduleIssueMessage({ code: "no_open_days" })).toMatch(/al menos un día/);
  });
});
