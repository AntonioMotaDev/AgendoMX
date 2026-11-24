import { describe, expect, it } from "vitest";
import { normalizeMapsUrl } from "./maps";

const url = (input: string) => {
  const r = normalizeMapsUrl(input);
  return r.ok ? r.url : "INVALID";
};

describe("normalizeMapsUrl", () => {
  it("accepts links from the usual map apps and forces https", () => {
    expect(url("https://maps.app.goo.gl/AbCdEf123")).toBe("https://maps.app.goo.gl/AbCdEf123");
    expect(url("https://www.google.com/maps/place/Barber%C3%ADa/@22.15,-100.97,17z")).toMatch(/^https:\/\/www\.google\.com\/maps\/place\//);
    expect(url("http://maps.google.com/?q=22.15,-100.97")).toBe("https://maps.google.com/?q=22.15,-100.97");
    expect(url("https://maps.apple.com/?address=Centro")).toMatch(/^https:\/\/maps\.apple\.com/);
    expect(url("https://waze.com/ul?q=barberia")).toMatch(/^https:\/\/waze\.com/);
    expect(url("https://www.openstreetmap.org/?mlat=22.15&mlon=-100.97")).toMatch(/openstreetmap\.org/);
    expect(url("maps.app.goo.gl/AbCdEf123")).toBe("https://maps.app.goo.gl/AbCdEf123");
  });

  it("drops the fragment", () => {
    expect(url("https://www.google.com/maps/place/X#frag")).toBe("https://www.google.com/maps/place/X");
  });

  it("rejects other sites, look-alikes, redirectors and dangerous schemes", () => {
    expect(url("https://evil.com/maps")).toBe("INVALID");
    expect(url("https://google.com.evil.com/maps/x")).toBe("INVALID");
    expect(url("https://notgoogle.com/maps/x")).toBe("INVALID");
    expect(url("https://www.google.com/url?q=https://evil.com")).toBe("INVALID");
    expect(url("https://www.google.com/search?q=barberia")).toBe("INVALID");
    expect(url("javascript:alert(1)")).toBe("INVALID");
    expect(url("data:text/html,hi")).toBe("INVALID");
    expect(url("https://user:pw@maps.google.com/maps")).toBe("INVALID");
    expect(url("https://maps.google.com:8443/maps")).toBe("INVALID");
  });

  it("rejects bare hosts and over-long input; empty clears the field", () => {
    expect(url("https://maps.google.com")).toBe("INVALID");
    expect(url("https://goo.gl/")).toBe("INVALID");
    expect(url(`https://maps.app.goo.gl/${"a".repeat(600)}`)).toBe("INVALID");
    expect(url("   ")).toBeNull();
  });
});
