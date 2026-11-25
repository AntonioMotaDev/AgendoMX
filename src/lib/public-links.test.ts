import { describe, expect, it } from "vitest";
import { directionsLink, osmEmbedUrl, telLink, whatsappLink } from "./public-links";

describe("public links", () => {
  it("builds wa.me and tel links from E.164", () => {
    expect(whatsappLink("+525512345678")).toBe("https://wa.me/525512345678");
    expect(whatsappLink("+525512345678", "Hola, ¿qué tal?")).toBe("https://wa.me/525512345678?text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F");
    expect(telLink("+525512345678")).toBe("tel:+525512345678");
  });
  it("prefers the owner's maps link, falls back to an address search, else null", () => {
    expect(directionsLink({ mapsUrl: "https://maps.app.goo.gl/x", address: "Calle 1", city: "SLP", state: "San Luis Potosí" })).toBe("https://maps.app.goo.gl/x");
    expect(directionsLink({ mapsUrl: null, address: "Calle 1 #2", city: "SLP", state: null })).toBe("https://www.google.com/maps/search/?api=1&query=Calle%201%20%232%2C%20SLP");
    expect(directionsLink({ mapsUrl: null, address: null, city: null, state: null })).toBeNull();
  });
  it("centers the OSM embed on the pin", () => {
    const url = osmEmbedUrl(22.15, -100.97);
    expect(url).toContain("marker=22.150000,-100.970000");
    expect(url).toContain("bbox=-100.973000,22.147000,-100.967000,22.153000");
  });
});
