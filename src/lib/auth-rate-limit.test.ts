import { describe, expect, it } from "vitest";
import { emailKey, extractEmail, ipKey, matchAuthRule } from "./auth-rate-limit";

describe("matchAuthRule", () => {
  it("only limits POSTs to credential/email endpoints", () => {
    expect(matchAuthRule("POST", "/api/auth/sign-in/email")?.endpoint).toBe("sign-in");
    expect(matchAuthRule("POST", "/api/auth/request-password-reset/")?.byEmail).toBe(true);
    expect(matchAuthRule("POST", "/api/auth/reset-password")?.byEmail).toBe(false);
    expect(matchAuthRule("GET", "/api/auth/sign-in/email")).toBeNull();
    expect(matchAuthRule("GET", "/api/auth/get-session")).toBeNull();
    expect(matchAuthRule("POST", "/api/auth/sign-out")).toBeNull();
  });
});

describe("extractEmail", () => {
  it("normalizes valid emails and rejects junk", () => {
    expect(extractEmail({ email: "  Juan@Example.com " })).toBe("juan@example.com");
    expect(extractEmail({ email: 42 })).toBeNull();
    expect(extractEmail({ email: "   " })).toBeNull();
    expect(extractEmail({ email: "a".repeat(300) })).toBeNull();
    expect(extractEmail(null)).toBeNull();
    expect(extractEmail("x")).toBeNull();
  });
});

describe("keys", () => {
  const rule = { endpoint: "sign-in", byEmail: true };
  it("never contain the raw email and are stable per address", async () => {
    const a = await emailKey(rule, "juan@example.com");
    expect(a).not.toContain("juan");
    expect(a).toBe(await emailKey(rule, "juan@example.com"));
    expect(a).not.toBe(await emailKey(rule, "ana@example.com"));
  });
  it("separate endpoints get separate buckets", async () => {
    expect(await ipKey(rule, "1.2.3.4")).not.toBe(await ipKey({ endpoint: "sign-up", byEmail: true }, "1.2.3.4"));
  });
});
