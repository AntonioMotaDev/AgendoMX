import { describe, expect, it } from "vitest";
import { cronToken, isValidCronRequest } from "./cron-auth";

describe("cron auth", () => {
  it("accepts the token derived from the same secret", async () => {
    const token = await cronToken("s3cret");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(await isValidCronRequest(`Bearer ${token}`, "s3cret")).toBe(true);
  });
  it("is stable per secret and different between secrets", async () => {
    expect(await cronToken("a")).toBe(await cronToken("a"));
    expect(await cronToken("a")).not.toBe(await cronToken("b"));
  });
  it("rejects wrong, missing, malformed and secret-less requests", async () => {
    const token = await cronToken("s3cret");
    expect(await isValidCronRequest(`Bearer ${token}`, "other")).toBe(false);
    expect(await isValidCronRequest(null, "s3cret")).toBe(false);
    expect(await isValidCronRequest(token, "s3cret")).toBe(false);
    expect(await isValidCronRequest("Bearer ", "s3cret")).toBe(false);
    expect(await isValidCronRequest("Bearer s3cret", "s3cret")).toBe(false);
    expect(await isValidCronRequest(`Bearer ${token}`, undefined)).toBe(false);
    expect(await isValidCronRequest(`Bearer ${token}`, "")).toBe(false);
  });
});
