import { describe, expect, it } from "vitest";
import { confirmationMatches, normalizeConfirmation } from "./account";

describe("confirmationMatches", () => {
  it("accepts the exact name, ignoring case and extra spaces", () => {
    expect(confirmationMatches("Barbería Juan", "Barbería Juan")).toBe(true);
    expect(confirmationMatches("  barbería   JUAN ", "Barbería Juan")).toBe(true);
  });
  it("is not fooled by composed vs decomposed accents", () => {
    expect(confirmationMatches("Barbería Juan", "Barbería Juan")).toBe(true);
  });
  it("rejects anything else", () => {
    for (const input of ["", "Barberia Juan", "Barbería", "Barbería Juan 2", null, undefined, 5, {}]) expect(confirmationMatches(input, "Barbería Juan")).toBe(false);
  });
  it("never matches an empty expectation", () => {
    expect(confirmationMatches("", "")).toBe(false);
    expect(confirmationMatches("   ", "  ")).toBe(false);
  });
  it("normalizes consistently", () => {
    expect(normalizeConfirmation("  A   B ")).toBe("a b");
  });
});
