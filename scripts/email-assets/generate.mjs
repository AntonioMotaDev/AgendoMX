/**
 * Generates the PNG assets used by transactional emails (public/brand/email/).
 * Email clients (Gmail, Outlook) do not render SVG, so illustrations and the
 * isotipo ship as 2x–3x PNGs hosted at /brand/email/*.png.
 *
 * Run with: node scripts/email-assets/generate.mjs
 * Style: "time blocks" (docs/BRAND.md §8.1/§8.5): rounded agenda bars plus one focal card.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "brand", "email");

const light = { bg: "#F2EFE7", bar: "#E2DED2", barAlt: "#D5D1C5", card: "#FAF9F6", cardLine: "#E2DED2", ink: "#252724", soft: "#B7B3A8", brand: "#D76C52", onBrand: "#FFFFFF" };
const dark = { bg: "#1F211E", bar: "#2B2E2A", barAlt: "#343731", card: "#2D2F2B", cardLine: "#3C3F39", ink: "#F2EFE7", soft: "#6F6E66", brand: "#D76C52", onBrand: "#FFFFFF" };

// Fixed pattern (x, width) per row, so every banner shares the same background rhythm.
const ROWS = [
  [[-30, 120], [100, 70], [180, 150], [340, 170]],
  [[20, 90], [120, 170], [300, 60], [370, 130]],
  [[-20, 160], [150, 80], [240, 130], [380, 120]],
  [[40, 110], [160, 90], [260, 70], [340, 160]],
  [[-10, 70], [80, 140], [230, 100], [340, 150]],
];

function background(t) {
  let out = "";
  ROWS.forEach((row, i) => {
    row.forEach(([x, w], j) => {
      const fill = (i + j) % 3 === 0 ? t.barAlt : t.bar;
      out += `<rect x="${x}" y="${12 + i * 30}" width="${w}" height="16" rx="8" fill="${fill}"/>`;
    });
  });
  return out;
}

// Focal card, 248 x 84, centered at (240, 80).
function card(t, badge, tone) {
  const line1 = tone === "muted" ? t.soft : t.ink;
  return `
    <rect x="116" y="38" width="248" height="84" rx="18" fill="${t.card}" stroke="${t.cardLine}" stroke-width="1.5"/>
    ${badge}
    <rect x="212" y="62" width="120" height="11" rx="5.5" fill="${line1}"/>
    <rect x="212" y="84" width="84" height="9" rx="4.5" fill="${t.soft}"/>`;
}

const cx = 164, cy = 80;
const badges = {
  confirmed: (t) => `<circle cx="${cx}" cy="${cy}" r="27" fill="${t.brand}"/><path d="M151 81 l9 9 l17 -19" fill="none" stroke="${t.onBrand}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  pending: (t) => `<circle cx="${cx}" cy="${cy}" r="25" fill="none" stroke="${t.brand}" stroke-width="4" stroke-dasharray="7 7" stroke-linecap="round"/><path d="M164 66 v15 l10 6" fill="none" stroke="${t.ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  cancelled: (t) => `<circle cx="${cx}" cy="${cy}" r="27" fill="${t.soft}"/><path d="M153 69 l22 22 M175 69 l-22 22" fill="none" stroke="${t.card}" stroke-width="6" stroke-linecap="round"/>`,
  reminder: (t) => `<circle cx="${cx}" cy="${cy}" r="27" fill="${t.brand}"/><path d="M164 65 v15 l10 6" fill="none" stroke="${t.onBrand}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  verify: (t) => `<circle cx="${cx}" cy="${cy}" r="27" fill="${t.brand}"/><rect x="149" y="70" width="30" height="21" rx="4" fill="none" stroke="${t.onBrand}" stroke-width="4.5" stroke-linejoin="round"/><path d="M151 73 l13 10 l13 -10" fill="none" stroke="${t.onBrand}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  reset: (t) => `<circle cx="${cx}" cy="${cy}" r="27" fill="${t.brand}"/><rect x="151" y="77" width="26" height="17" rx="4" fill="${t.onBrand}"/><path d="M156 77 v-6 a8 8 0 0 1 16 0 v6" fill="none" stroke="${t.onBrand}" stroke-width="4.5" stroke-linecap="round"/>`,
};

function banner(t, kind) {
  const muted = kind === "cancelled" ? "muted" : "ink";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="160" viewBox="0 0 480 160"><rect width="480" height="160" fill="${t.bg}"/>${background(t)}${card(t, badges[kind](t), muted)}</svg>`;
}

const isotipo = (fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><g transform="translate(0 23)" fill="${fill}"><path d="M55 307 C55 154 169 34 315 34 C466 34 585 154 585 307 L585 560 H405 V307 C405 249 367 214 315 214 C263 214 235 253 235 307 Z"/><circle cx="145" cy="470" r="90"/></g></svg>`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const render = async (svg, w, h, scale, file) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    await page.setContent(`<body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg style="display:block;width:${w}px;height:${h}px" `)}</body>`);
    await page.screenshot({ path: path.join(OUT, file), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
    await page.close();
  };
  for (const kind of Object.keys(badges)) {
    await render(banner(light, kind), 480, 160, 2, `hero-${kind}.png`);
    await render(banner(dark, kind), 480, 160, 2, `hero-${kind}-dark.png`);
  }
  await render(isotipo("#D76C52"), 28, 28, 3, "isotipo.png");
  await render(isotipo("#B7B3A8"), 16, 16, 3, "isotipo-soft.png");
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
