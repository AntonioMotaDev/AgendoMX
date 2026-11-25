import { describe, expect, it } from "vitest";
import { centsToInput, formatMxn, formatMxnShort } from "./money";
import { parsePriceToCents } from "./validators/onboarding";

describe("money", () => {
  it("formats pesos in es-MX", () => {
    expect(formatMxn(18000)).toBe("$180.00");
    expect(formatMxn(120050)).toBe("$1,200.50");
    expect(formatMxnShort(18000)).toBe("$180");
    expect(formatMxnShort(18050)).toBe("$180.50");
    expect(formatMxnShort(0)).toBe("$0");
  });

  it("centsToInput round-trips with parsePriceToCents", () => {
    for (const cents of [0, 5, 50, 18000, 18050, 99999999]) expect(parsePriceToCents(centsToInput(cents))).toBe(cents);
    expect(centsToInput(null)).toBe("");
  });
});
