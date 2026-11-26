/**
 * Business themes (docs/BRAND.md §6). A theme only changes the public profile, the
 * booking flow and the client's appointment page; the owner panel is always neutral.
 *
 * The actual colors live in `globals.css` as `--t-*` tokens under `[data-theme-biz="<id>"]`.
 * This file holds the ids (shared with the database enum and Zod) and the swatches
 * used by the picker preview. Keep both in sync: a test checks every id has CSS.
 */

export const THEME_IDS = ["studio", "noir", "bloom", "earth", "coast", "signal"] as const;
export type BusinessTheme = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: BusinessTheme = "studio";

export function isBusinessTheme(value: unknown): value is BusinessTheme {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/** Falls back to the default for anything unknown, so a bad value can never break a public page. */
export function themeOrDefault(value: unknown): BusinessTheme {
  return isBusinessTheme(value) ? value : DEFAULT_THEME;
}

/** Primary and background colors, only to draw the small swatch in the picker. */
export const THEME_SWATCH: Record<BusinessTheme, { primary: string; bg: string }> = {
  studio: { primary: "#2b2a27", bg: "#efece6" },
  noir: { primary: "#c9a26a", bg: "#151513" },
  bloom: { primary: "#a94868", bg: "#f8ebea" },
  earth: { primary: "#4d5f3b", bg: "#eceadd" },
  coast: { primary: "#1f5f6e", bg: "#e7eef0" },
  signal: { primary: "#14213d", bg: "#fbf3e6" },
};
