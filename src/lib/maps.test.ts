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

import { extractCoords } from "./maps";

describe("extractCoords", () => {
  it("reads the place pin before the viewport", () => {
    expect(extractCoords("https://www.google.com/maps/place/X/@22.15,-100.97,17z/data=!3d22.1501!4d-100.9712")).toEqual({ lat: 22.1501, lng: -100.9712 });
  });
  it("reads @lat,lng, q=, ll=, and OSM mlat/mlon", () => {
    expect(extractCoords("https://www.google.com/maps/place/Barber%C3%ADa/@22.15,-100.97,17z")).toEqual({ lat: 22.15, lng: -100.97 });
    expect(extractCoords("https://maps.google.com/?q=22.15,-100.97")).toEqual({ lat: 22.15, lng: -100.97 });
    expect(extractCoords("https://maps.apple.com/?ll=19.43,-99.13")).toEqual({ lat: 19.43, lng: -99.13 });
    expect(extractCoords("https://www.openstreetmap.org/?mlat=22.15&mlon=-100.97")).toEqual({ lat: 22.15, lng: -100.97 });
  });
  it("ignores short links, text queries and pins outside Mexico", () => {
    expect(extractCoords("https://maps.app.goo.gl/AbCdEf123")).toBeNull();
    expect(extractCoords("https://maps.google.com/?q=barberia+centro")).toBeNull();
    expect(extractCoords("https://www.google.com/maps/@40.71,-74.0,12z")).toBeNull();
    expect(extractCoords("https://maps.google.com/?q=0,0")).toBeNull();
    expect(extractCoords("not a url")).toBeNull();
  });
});
