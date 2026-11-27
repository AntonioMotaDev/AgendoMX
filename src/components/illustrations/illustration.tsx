import { cn } from "@/lib/utils";

/**
 * Illustration system ("time blocks", docs/BRAND.md §8.1 and §8.5): rounded agenda bars,
 * a focal card and one terracotta accent. Pure SVG with Tailwind fill classes so it
 * follows the panel tokens (never the business theme). Decorative: always aria-hidden.
 */
export type IllustrationKind = "hero" | "strip" | "emptyDay" | "emptyServices" | "emptyClients" | "emptyDays";
export type IllustrationTone = "light" | "dark";

const tones = {
  light: { bar: "fill-line", barAlt: "fill-stone/40", card: "fill-surface stroke-line", line: "fill-ink", lineSoft: "fill-stone", ghost: "stroke-stone", ghostFill: "fill-paper" },
  dark: { bar: "fill-white/[0.06]", barAlt: "fill-white/10", card: "fill-[#2d2f2b] stroke-white/10", line: "fill-paper", lineSoft: "fill-ink-muted", ghost: "stroke-white/30", ghostFill: "fill-white/[0.04]" },
} as const;
type Tone = (typeof tones)[IllustrationTone];

// Fixed (x, width) pairs per row, so every composition shares the same rhythm and SSR matches the client.
const ROWS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[-30, 120], [100, 70], [180, 150], [340, 170]],
  [[20, 90], [120, 170], [300, 60], [370, 130]],
  [[-20, 160], [150, 80], [240, 130], [380, 120]],
  [[40, 110], [160, 90], [260, 70], [340, 160]],
  [[-10, 70], [80, 140], [230, 100], [340, 150]],
];

function Bars({ t, rows = ROWS.length, y0 = 12, gap = 30, h = 16, scale = 1 }: { t: Tone; rows?: number; y0?: number; gap?: number; h?: number; scale?: number }) {
  return (
    <>
      {ROWS.slice(0, rows).flatMap((row, i) =>
        row.map(([x, w], j) => <rect key={`${i}-${j}`} x={x * scale} y={y0 + i * gap} width={w * scale} height={h} rx={h / 2} className={(i + j) % 3 === 0 ? t.barAlt : t.bar} />),
      )}
    </>
  );
}

function Check({ cx, cy, r = 27 }: { cx: number; cy: number; r?: number }) {
  const k = r / 27;
  return (
    <>
      <circle cx={cx} cy={cy} r={r} className="fill-brand" />
      <path d={`M${cx - 13 * k} ${cy + 1 * k} l${9 * k} ${9 * k} l${17 * k} ${-19 * k}`} fill="none" stroke="white" strokeWidth={6 * k} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function Card({ t, x, y, w = 248, h = 84, children }: { t: Tone; x: number; y: number; w?: number; h?: number; children: React.ReactNode }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={18} className={t.card} strokeWidth={1.5} />
      {children}
    </>
  );
}

function Lines({ t, x, y, a = 120, b = 84 }: { t: Tone; x: number; y: number; a?: number; b?: number }) {
  return (
    <>
      <rect x={x} y={y} width={a} height={11} rx={5.5} className={t.line} />
      <rect x={x} y={y + 22} width={b} height={9} rx={4.5} className={t.lineSoft} />
    </>
  );
}

/** A "free slot": dashed outline where an appointment will land. */
function Slot({ t, x, y, w, h = 28, plus = true }: { t: Tone; x: number; y: number; w: number; h?: number; plus?: boolean }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={h / 2} className={cn(t.ghost, t.ghostFill)} strokeWidth={2} strokeDasharray="6 6" />
      {plus ? <path d={`M${x + w / 2 - 6} ${y + h / 2} h12 M${x + w / 2} ${y + h / 2 - 6} v12`} fill="none" strokeWidth={3} strokeLinecap="round" className="stroke-brand" /> : null}
    </>
  );
}

function Scene({ kind, t }: { kind: IllustrationKind; t: Tone }) {
  switch (kind) {
    case "hero":
      return (
        <>
          <Bars t={t} rows={5} y0={14} gap={34} h={18} scale={1.1} />
          <Card t={t} x={70} y={60} w={330} h={104}>
            <Check cx={125} cy={112} r={30} />
            <Lines t={t} x={180} y={96} a={150} b={100} />
          </Card>
          <Card t={t} x={130} y={190} w={320} h={96}>
            <circle cx={184} cy={238} r={25} fill="none" strokeWidth={4} strokeDasharray="7 7" strokeLinecap="round" className="stroke-brand" />
            <path d="M184 225 v14 l10 6" fill="none" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" className={t === tones.dark ? "stroke-paper" : "stroke-ink"} />
            <Lines t={t} x={232} y={222} a={150} b={96} />
          </Card>
          <Slot t={t} x={70} y={316} w={250} h={36} />
        </>
      );
    case "strip":
      return (
        <>
          <Bars t={t} rows={3} y0={8} gap={30} h={16} />
          <Card t={t} x={116} y={14} w={248} h={68}>
            <Check cx={158} cy={48} r={22} />
            <Lines t={t} x={200} y={34} a={110} b={76} />
          </Card>
        </>
      );
    case "emptyDay":
      return (
        <>
          <Bars t={t} rows={4} y0={4} gap={28} h={14} />
          <Slot t={t} x={90} y={44} w={180} h={32} />
        </>
      );
    case "emptyServices":
      return (
        <>
          <Bars t={t} rows={2} y0={4} gap={28} h={14} />
          <Card t={t} x={70} y={26} w={220} h={52}>
            <circle cx={98} cy={52} r={13} className="fill-brand" />
            <Lines t={t} x={124} y={40} a={110} b={70} />
          </Card>
          <Slot t={t} x={70} y={90} w={220} h={24} plus={false} />
        </>
      );
    case "emptyClients":
      return (
        <>
          <Bars t={t} rows={2} y0={4} gap={28} h={14} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <circle cx={96 + i * 70} cy={60} r={22} className={i === 0 ? "fill-brand" : t.barAlt} />
              <rect x={74 + i * 70} y={92} width={44} height={9} rx={4.5} className={i === 0 ? t.line : t.lineSoft} />
            </g>
          ))}
        </>
      );
    case "emptyDays":
      return (
        <>
          <Bars t={t} rows={3} y0={4} gap={28} h={14} />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={50 + i * 48} y={28} width={36} height={36} rx={10} className={i === 2 ? "fill-brand" : t.card} strokeWidth={1.5} />
          ))}
          <path d="M157 39 l14 14 M171 39 l-14 14" stroke="white" strokeWidth={4} strokeLinecap="round" />
        </>
      );
  }
}

const sizes: Record<IllustrationKind, { w: number; h: number }> = {
  hero: { w: 520, h: 380 },
  strip: { w: 480, h: 96 },
  emptyDay: { w: 360, h: 120 },
  emptyServices: { w: 360, h: 120 },
  emptyClients: { w: 360, h: 120 },
  emptyDays: { w: 360, h: 100 },
};

export function Illustration({ kind, tone = "light", className }: { kind: IllustrationKind; tone?: IllustrationTone; className?: string }) {
  const { w, h } = sizes[kind];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice" className={cn("block h-auto w-full", className)}>
      <Scene kind={kind} t={tones[tone]} />
    </svg>
  );
}
