import { describe, expect, it } from "vitest";
import { normalizeSocial } from "./social";

const url = (platform: Parameters<typeof normalizeSocial>[0], input: string) => {
  const r = normalizeSocial(platform, input);
  return r.ok ? r.url : "INVALID";
};

describe("normalizeSocial", () => {
  it("turns handles into profile URLs", () => {
    expect(url("instagram", "@barberia_juan")).toBe("https://www.instagram.com/barberia_juan");
    expect(url("instagram", "barberia.juan")).toBe("https://www.instagram.com/barberia.juan");
    expect(url("tiktok", "@juan")).toBe("https://www.tiktok.com/@juan");
    expect(url("youtube", "juanbarber")).toBe("https://www.youtube.com/@juanbarber");
    expect(url("twitter", "@juan")).toBe("https://x.com/juan");
    expect(url("facebook", "BarberiaJuan")).toBe("https://www.facebook.com/BarberiaJuan");
  });

  it("accepts pasted URLs, upgrades to https and strips query/hash", () => {
    expect(url("instagram", "https://instagram.com/juan/?igsh=abc#x")).toBe("https://instagram.com/juan");
    expect(url("instagram", "instagram.com/juan")).toBe("https://instagram.com/juan");
    expect(url("facebook", "http://m.facebook.com/barberia/")).toBe("https://m.facebook.com/barberia");
    expect(url("linkedin", "https://www.linkedin.com/company/forma01")).toBe("https://www.linkedin.com/company/forma01");
    expect(url("twitter", "https://twitter.com/juan")).toBe("https://twitter.com/juan");
  });

  it("requires a URL for LinkedIn (person vs company is ambiguous)", () => {
    expect(url("linkedin", "forma01")).toBe("INVALID");
  });

  it("rejects other domains, look-alikes and dangerous schemes", () => {
    expect(url("instagram", "https://evil.com/juan")).toBe("INVALID");
    expect(url("instagram", "https://instagram.com.evil.com/juan")).toBe("INVALID");
    expect(url("instagram", "https://notinstagram.com/juan")).toBe("INVALID");
    expect(url("instagram", "javascript:alert(1)")).toBe("INVALID");
    expect(url("instagram", "ftp://instagram.com/juan")).toBe("INVALID");
    expect(url("instagram", "https://user:pass@instagram.com/juan")).toBe("INVALID");
    expect(url("instagram", "https://instagram.com/")).toBe("INVALID");
    expect(url("tiktok", "https://instagram.com/juan")).toBe("INVALID");
  });

  it("rejects malformed handles and over-long input", () => {
    expect(url("instagram", "@juan perez")).toBe("INVALID");
    expect(url("instagram", "@")).toBe("INVALID");
    expect(url("instagram", "a".repeat(250))).toBe("INVALID");
  });

  it("treats empty input as clearing the field", () => {
    expect(url("instagram", "   ")).toBeNull();
    expect(url("facebook", "")).toBeNull();
  });
});
