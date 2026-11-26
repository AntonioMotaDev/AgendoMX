import { THEME_IDS, type BusinessTheme } from "@/lib/themes";

/** Small deterministic generator, so each theme always draws the same pattern (server and client agree). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const W = 800;
const H = 224;

interface Bar {
  x: number;
  y: number;
  w: number;
  tone: "a" | "p" | "s";
  opacity: number;
}

function bars(theme: BusinessTheme): Bar[] {
  const r = rng(11 + THEME_IDS.indexOf(theme) * 13);
  const out: Bar[] = [];
  for (let row = 0; row < 8; row++) {
    let x = -40 + r() * 120;
    const y = 14 + row * 26;
    while (x < W) {
      const w = 50 + r() * 190;
      const k = r();
      out.push({ x: Math.round(x), y, w: Math.round(w), tone: k < 0.45 ? "a" : k < 0.75 ? "p" : "s", opacity: Number((0.2 + r() * 0.6).toFixed(2)) });
      x += w + 10 + r() * 40;
    }
  }
  return out;
}

const FILL = { a: "fill-th-accent", p: "fill-th-primary", s: "fill-th-soft" } as const;

/**
 * Default cover when a business has no photo: rows of "time blocks", the visual
 * language of the brand (docs/BRAND.md §8). Colors come from the active theme, so
 * it must render inside a `ThemeScope` (or any element with `data-theme-biz`).
 */
export function CoverArt({ theme, className }: { theme: BusinessTheme; className?: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className ?? "h-full w-full"}>
      <rect width={W} height={H} className="fill-th-cover" />
      {bars(theme).map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={16} rx={8} className={FILL[b.tone]} opacity={b.opacity} />
      ))}
    </svg>
  );
}
