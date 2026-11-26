import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { businessTheme } from "@/db/schema";
import { copy } from "@/lib/copy";
import { themeSchema } from "@/lib/validators/profile";
import { DEFAULT_THEME, isBusinessTheme, THEME_IDS, THEME_SWATCH, themeOrDefault } from "./themes";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("business themes", () => {
  it("keeps the database enum, the id list and the default in sync", () => {
    expect([...businessTheme.enumValues]).toEqual([...THEME_IDS]);
    expect(THEME_IDS).toContain(DEFAULT_THEME);
  });

  it("defines CSS tokens for every non-default theme (the default lives on :root)", () => {
    for (const id of THEME_IDS) {
      if (id === DEFAULT_THEME) continue;
      expect(css, `missing [data-theme-biz="${id}"] block`).toContain(`[data-theme-biz="${id}"]`);
    }
  });

  it("has a swatch and copy for every theme", () => {
    for (const id of THEME_IDS) {
      expect(THEME_SWATCH[id].primary).toMatch(/^#[0-9a-f]{6}$/);
      expect(copy.panel.profile.appearance.themes[id].name.length).toBeGreaterThan(0);
    }
  });

  it("falls back to the default for unknown values", () => {
    expect(themeOrDefault("noir")).toBe("noir");
    expect(themeOrDefault("neon")).toBe(DEFAULT_THEME);
    expect(themeOrDefault(null)).toBe(DEFAULT_THEME);
    expect(isBusinessTheme(42)).toBe(false);
  });

  it("only accepts known themes in the form schema", () => {
    expect(themeSchema.safeParse({ theme: "bloom" }).success).toBe(true);
    const bad = themeSchema.safeParse({ theme: "neon" });
    expect(bad.success).toBe(false);
    expect(themeSchema.safeParse({}).success).toBe(false);
  });
});

/** WCAG contrast of the two color pairs that carry text: body text on the page, and button label on the primary color. */
function luminance(hex: string) {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }; 
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

function tokens(id: string): Record<string, string> {
  const block = id === DEFAULT_THEME ? css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root"))) : css.slice(css.indexOf(`[data-theme-biz="${id}"]`), css.indexOf("}", css.indexOf(`[data-theme-biz="${id}"]`)));
  return Object.fromEntries([...block.matchAll(/--t-([a-z]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1]!, m[2]!]));
}

describe("theme contrast (AA)", () => {
  it.each(THEME_IDS)("%s: text, muted text and button label meet 4.5:1", (id) => {
    const t = tokens(id);
    expect(ratio(t.text!, t.bg!), "text on bg").toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.muted!, t.bg!), "muted on bg").toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.muted!, t.surface!), "muted on surface").toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.onp!, t.primary!), "button label").toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.danger!, t.bg!), "error text").toBeGreaterThanOrEqual(4.5);
  });
});
