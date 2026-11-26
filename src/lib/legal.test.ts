import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { build } from "../../scripts/legal/sync.mjs";
import { DRAFT_MARKER, fillClientNotice, LEGAL_TEXTS, LEGAL_VERSION, missingControllerData, termsAcceptanceError } from "./legal-content";
import { parseMarkdown } from "./markdown";

const root = process.cwd();

describe("generated legal texts", () => {
  it("are in sync with docs/legal (run `pnpm legal:sync` after editing the markdown)", () => {
    const current = readFileSync(join(root, "src/content/legal/generated.ts"), "utf8");
    expect(current).toBe(build());
    expect(() => execFileSync("node", [join(root, "scripts/legal/sync.mjs"), "--check"])).not.toThrow();
  });

  it("expose a version and every text, and all of them parse", () => {
    expect(LEGAL_VERSION).toMatch(/^\S+$/);
    for (const [name, text] of Object.entries(LEGAL_TEXTS)) {
      expect(text.length, name).toBeGreaterThan(200);
      expect(parseMarkdown(text).length, name).toBeGreaterThanOrEqual(1);
    }
  });

  it("the short notice for the booking form names the controller placeholder and links to the notice", () => {
    expect(LEGAL_TEXTS.privacyClientsShort).toContain("{Nombre del negocio}");
    expect(LEGAL_TEXTS.privacyClientsShort).toContain("AgendoMX");
  });
});

describe("version across documents", () => {
  const read = (name: string) => readFileSync(join(root, "docs/legal", name), "utf8");

  it("the three documents declare the same version (what a person accepts is recorded against it)", () => {
    for (const name of ["terminos-duenos.md", "aviso-privacidad-duenos.md", "aviso-privacidad-clientes.md"]) {
      expect(/Versión:\s*`([^`]+)`/.exec(read(name))?.[1], name).toBe(LEGAL_VERSION);
    }
  });
});

describe("health consent text", () => {
  it("is a distinct, non-empty text that names the business, the data and the notice", () => {
    const text = LEGAL_TEXTS.privacyClientsHealthConsent;
    expect(text).toContain("{Nombre del negocio}");
    expect(text).toContain("{slug}/privacidad");
    expect(text.toLowerCase()).toContain("expresamente");
    expect(text).not.toBe(LEGAL_TEXTS.privacyClientsShort);
  });

  it("is filled for the business like the other client texts", () => {
    const business = { slug: "psico-ana", name: "Psicología Ana", address: "Juárez 1", city: "Puebla", state: "Puebla", phone: null, whatsapp: "+525512345678" };
    const filled = fillClientNotice(LEGAL_TEXTS.privacyClientsHealthConsent, business);
    expect(filled).toContain("Psicología Ana");
    expect(filled).toContain("(/psico-ana/privacidad)");
    expect(filled).not.toMatch(/\{[^}]+\}/);
  });
});

describe("missingControllerData", () => {
  const complete = { address: "Juárez 123", city: "Guadalajara", state: "Jalisco", phone: "+525512345678", whatsapp: null };

  it("is empty when the address and one contact are registered", () => {
    expect(missingControllerData(complete)).toEqual([]);
    expect(missingControllerData({ ...complete, phone: null, whatsapp: "+525587654321" })).toEqual([]);
  });

  it("asks for the address when street, city or state is blank", () => {
    expect(missingControllerData({ ...complete, address: null })).toEqual(["address"]);
    expect(missingControllerData({ ...complete, address: "   " })).toEqual(["address"]);
    expect(missingControllerData({ ...complete, city: null })).toEqual(["address"]);
    expect(missingControllerData({ ...complete, state: "" })).toEqual(["address"]);
  });

  it("asks for a contact when there is neither phone nor WhatsApp", () => {
    expect(missingControllerData({ ...complete, phone: null, whatsapp: null })).toEqual(["contact"]);
    expect(missingControllerData({ ...complete, phone: " ", whatsapp: "" })).toEqual(["contact"]);
  });

  it("reports both at once", () => {
    expect(missingControllerData({ address: null, city: null, state: null, phone: null, whatsapp: null })).toEqual(["address", "contact"]);
  });
});

describe("fillClientNotice", () => {
  const business = { slug: "barberia-juan", name: "Barbería Juan", address: "Juárez 123", city: "Guadalajara", state: "Jalisco", phone: "+525512345678", whatsapp: "+525587654321" };

  it("replaces every business placeholder, leaving no braces behind", () => {
    const filled = fillClientNotice(LEGAL_TEXTS.privacyClientsFull, business);
    expect(filled).toContain("Barbería Juan");
    expect(filled).toContain("Juárez 123, Guadalajara, Jalisco");
    expect(filled).toContain("WhatsApp 55 8765 4321");
    expect(filled).not.toMatch(/\{[^}]+\}/);
  });

  it("falls back to generic wording when the business has no address or contact", () => {
    const filled = fillClientNotice(LEGAL_TEXTS.privacyClientsFull, { ...business, address: null, city: null, state: null, phone: null, whatsapp: null });
    expect(filled).not.toMatch(/\{[^}]+\}/);
    expect(filled).toContain("perfil público");
  });

  it("fills the short notice too, linking to that business's own notice", () => {
    const short = fillClientNotice(LEGAL_TEXTS.privacyClientsShort, business);
    expect(short).toContain("Barbería Juan");
    expect(short).toContain("(/barberia-juan/privacidad)");
    expect(short).not.toMatch(/\{[^}]+\}/);
  });
});

describe("publication guard", () => {
  /** wrangler.jsonc has comments; strip whole-line ones before parsing. */
  const wrangler = JSON.parse(readFileSync(join(root, "wrangler.jsonc"), "utf8").replace(/^\s*\/\/.*$/gm, "")) as {
    vars?: Record<string, string>;
    env?: Record<string, { vars?: Record<string, string> }>;
  };

  it("production never publishes legal texts that still contain draft markers", () => {
    const published = wrangler.vars?.LEGAL_PUBLISHED === "true";
    if (!published) return; // dark in production: nothing to check yet
    const healthOn = wrangler.vars?.HEALTH_CATEGORIES_ENABLED === "true";
    for (const [name, text] of Object.entries(LEGAL_TEXTS)) {
      // The health consent text is only live when health businesses are admitted; until then it may stay a draft.
      if (name === "privacyClientsHealthConsent" && !healthOn) continue;
      expect(DRAFT_MARKER.test(text), `${name} still has draft markers`).toBe(false);
    }
  });

  it("health businesses are not admitted in production while their consent text is a draft", () => {
    if (wrangler.vars?.HEALTH_CATEGORIES_ENABLED !== "true") return;
    expect(DRAFT_MARKER.test(LEGAL_TEXTS.privacyClientsHealthConsent), "health consent text still has draft markers").toBe(false);
  });

  it("the draft texts do contain markers today (so the guard above has teeth)", () => {
    expect(Object.values(LEGAL_TEXTS).some((text) => DRAFT_MARKER.test(text))).toBe(true);
  });

  it("only staging turns the flag on while the texts are drafts", () => {
    expect(wrangler.vars?.LEGAL_PUBLISHED).not.toBe("true");
  });
});

describe("termsAcceptanceError", () => {
  it("does not interfere while the legal texts are not published", () => {
    expect(termsAcceptanceError({}, false)).toBeNull();
    expect(termsAcceptanceError(undefined, false)).toBeNull();
  });
  it("requires the exact current version once published", () => {
    expect(termsAcceptanceError({ termsVersion: LEGAL_VERSION }, true)).toBeNull();
    for (const body of [{}, undefined, null, "x", { termsVersion: "0.0" }, { termsVersion: true }, { termsVersion: "" }, { termsVersion: `${LEGAL_VERSION} ` }]) {
      expect(termsAcceptanceError(body, true)).toBe("TERMS_NOT_ACCEPTED");
    }
  });
});
