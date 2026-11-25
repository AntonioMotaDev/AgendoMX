import { describe, expect, it, vi } from "vitest";
import { turnstileMode, verifyTurnstile, TURNSTILE_VERIFY_URL } from "./turnstile";

const keys = { siteKey: "site", secretKey: "secret", production: true };
const reply = (body: unknown, ok = true) => vi.fn().mockResolvedValue({ ok, json: async () => body });

describe("turnstileMode", () => {
  it("enforces whenever both keys exist", () => {
    expect(turnstileMode(keys)).toBe("enforce");
    expect(turnstileMode({ ...keys, production: false })).toBe("enforce");
  });
  it("fails closed in production and bypasses elsewhere when keys are missing", () => {
    expect(turnstileMode({ siteKey: undefined, secretKey: undefined, production: true })).toBe("unavailable");
    expect(turnstileMode({ siteKey: "site", secretKey: undefined, production: true })).toBe("unavailable");
    expect(turnstileMode({ siteKey: undefined, secretKey: undefined, production: false })).toBe("bypass");
  });
});

describe("verifyTurnstile", () => {
  it("bypass lets everything through without calling Cloudflare", async () => {
    const f = reply({ success: false });
    expect(await verifyTurnstile({ token: undefined, config: { siteKey: undefined, secretKey: undefined, production: false }, fetchImpl: f })).toEqual({ ok: true });
    expect(f).not.toHaveBeenCalled();
  });
  it("unavailable refuses without calling Cloudflare", async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile({ token: "t", config: { siteKey: undefined, secretKey: undefined, production: true }, fetchImpl: f })).toEqual({ ok: false, reason: "unavailable" });
    expect(f).not.toHaveBeenCalled();
  });
  it("rejects missing, empty and oversized tokens without a network call", async () => {
    const f = reply({ success: true });
    for (const token of [undefined, null, "", 5, "x".repeat(3000)]) {
      expect(await verifyTurnstile({ token, config: keys, fetchImpl: f })).toEqual({ ok: false, reason: "missing_token" });
    }
    expect(f).not.toHaveBeenCalled();
  });
  it("posts the secret, token and ip, and accepts success:true", async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile({ token: "tok", remoteIp: "203.0.113.9", config: keys, fetchImpl: f })).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    expect(init.body.get("secret")).toBe("secret");
    expect(init.body.get("response")).toBe("tok");
    expect(init.body.get("remoteip")).toBe("203.0.113.9");
  });
  it("omits the ip when unknown", async () => {
    const f = reply({ success: true });
    await verifyTurnstile({ token: "tok", remoteIp: "unknown", config: keys, fetchImpl: f });
    expect(f.mock.calls[0][1].body.has("remoteip")).toBe(false);
  });
  it("rejects success:false and anything not strictly true", async () => {
    for (const body of [{ success: false }, {}, { success: "true" }, null]) {
      expect(await verifyTurnstile({ token: "tok", config: keys, fetchImpl: reply(body) })).toEqual({ ok: false, reason: "rejected" });
    }
  });
  it("fails closed on HTTP errors, thrown errors and bad JSON", async () => {
    expect(await verifyTurnstile({ token: "tok", config: keys, fetchImpl: reply({}, false) })).toEqual({ ok: false, reason: "unavailable" });
    expect(await verifyTurnstile({ token: "tok", config: keys, fetchImpl: vi.fn().mockRejectedValue(new Error("down")) })).toEqual({ ok: false, reason: "unavailable" });
    const badJson = vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error("bad"); } });
    expect(await verifyTurnstile({ token: "tok", config: keys, fetchImpl: badJson })).toEqual({ ok: false, reason: "unavailable" });
  });
});
