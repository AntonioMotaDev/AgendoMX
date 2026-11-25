import { describe, expect, it } from "vitest";
import { bookingRequestSchema } from "./booking";

const base = { slug: "barberia-juan", serviceId: "x", start: "2026-12-02T16:00:00.000Z", name: " Ana López ", phone: "55 1234 5678", email: "" };

describe("bookingRequestSchema", () => {
  it("normalizes phone to E.164, trims the name and turns an empty email into null", () => {
    const r = bookingRequestSchema.parse(base);
    expect(r.phone).toBe("+525512345678");
    expect(r.name).toBe("Ana López");
    expect(r.email).toBeNull();
  });
  it("lowercases a valid email and rejects a malformed one", () => {
    expect(bookingRequestSchema.parse({ ...base, email: " Ana@Example.COM " }).email).toBe("ana@example.com");
    expect(bookingRequestSchema.safeParse({ ...base, email: "ana@" }).success).toBe(false);
  });
  it("rejects non-Mexican, short and empty phones and missing names", () => {
    for (const phone of ["", "123", "+1 415 555 2671", "abc"]) expect(bookingRequestSchema.safeParse({ ...base, phone }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...base, name: "x".repeat(81) }).success).toBe(false);
  });
  it("accepts the honeypot and token fields without validating them as content", () => {
    expect(bookingRequestSchema.parse({ ...base, website: "http://spam", turnstileToken: "t" }).website).toBe("http://spam");
  });
});
