import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Illustration system ("time blocks", docs/BRAND.md §8.1 and §8.5): rounded agenda bars,
 * a focal card and one accent. Pure SVG with Tailwind classes, so colors follow the active
 * tokens: `light`/`dark` use the AgendoMX panel palette, `theme` uses the business theme
 * (`th-*`, only inside a `ThemeScope`). Decorative: always aria-hidden.
 *
 * `animated` adds slow, subtle motion (see `.ill-*` in globals.css). Everything stops
 * under `prefers-reduced-motion`.
 */
export type IllustrationKind =
  | "hero"
  | "strip"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "done"
  | "notFound"
  | "offline"
  | "emptyDay"
  | "emptyServices"
  | "emptyClients"
  | "emptyDays";
export type IllustrationTone = "light" | "dark" | "theme";

const tones = {
  light: { bar: "fill-line", barAlt: "fill-stone/40", card: "fill-surface stroke-line", line: "fill-ink", lineSoft: "fill-stone", ghost: "stroke-stone", accent: "fill-brand", accentStroke: "stroke-brand", onAccent: "stroke-white", hand: "stroke-ink", cross: "stroke-surface" },
  dark: { bar: "fill-white/[0.06]", barAlt: "fill-white/10", card: "fill-[#2d2f2b] stroke-white/10", line: "fill-paper", lineSoft: "fill-ink-muted", ghost: "stroke-white/30", accent: "fill-brand", accentStroke: "stroke-brand", onAccent: "stroke-white", hand: "stroke-paper", cross: "stroke-[#2d2f2b]" },
  theme: { bar: "fill-th-soft", barAlt: "fill-th-line", card: "fill-th-surface stroke-th-line", line: "fill-th-text", lineSoft: "fill-th-muted", ghost: "stroke-th-muted", accent: "fill-th-primary", accentStroke: "stroke-th-primary", onAccent: "stroke-th-onp", hand: "stroke-th-text", cross: "stroke-th-surface" },
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

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

function Bars({ t, rows = ROWS.length, y0 = 12, gap = 30, h = 16, scale = 1 }: { t: Tone; rows?: number; y0?: number; gap?: number; h?: number; scale?: number }) {
  return (
    <>
      {ROWS.slice(0, rows).map((row, i) => (
        <g key={i} className={i % 2 === 0 ? "ill-drift-a" : "ill-drift-b"} style={delay(-i * 2.3)}>
          {row.map(([x, w], j) => (
            <rect key={j} x={x * scale} y={y0 + i * gap} width={w * scale} height={h} rx={h / 2} className={(i + j) % 3 === 0 ? t.barAlt : t.bar} />
          ))}
        </g>
      ))}
    </>
  );
}

function Check({ t, cx, cy, r = 27 }: { t: Tone; cx: number; cy: number; r?: number }) {
  const k = r / 27;
  return (
    <>
      <circle cx={cx} cy={cy} r={r} className={t.accent} />
      <path d={`M${cx - 13 * k} ${cy + 1 * k} l${9 * k} ${9 * k} l${17 * k} ${-19 * k}`} fill="none" strokeWidth={6 * k} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={40 * k} className={cn(t.onAccent, "ill-draw")} />
    </>
  );
}

function Clock({ t, cx, cy, r = 25, dashed = true }: { t: Tone; cx: number; cy: number; r?: number; dashed?: boolean }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={4} strokeDasharray={dashed ? "7 7" : undefined} strokeLinecap="round" className={cn(t.accentStroke, dashed && "ill-dash")} />
      <path d={`M${cx} ${cy - 14} v14 l10 6`} fill="none" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" className={t.hand} />
    </>
  );
}

function Card({ t, x, y, w = 248, h = 84, className, style, children }: { t: Tone; x: number; y: number; w?: number; h?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <g className={className} style={style}>
      <rect x={x} y={y} width={w} height={h} rx={18} className={t.card} strokeWidth={1.5} />
      {children}
    </g>
  );
}

function Lines({ t, x, y, a = 120, b = 84, soft = false }: { t: Tone; x: number; y: number; a?: number; b?: number; soft?: boolean }) {
  return (
    <>
      <rect x={x} y={y} width={a} height={11} rx={5.5} className={soft ? t.lineSoft : t.line} />
      <rect x={x} y={y + 22} width={b} height={9} rx={4.5} className={t.lineSoft} />
    </>
  );
}

/** A "free slot": dashed outline where an appointment will land. */
function Slot({ t, x, y, w, h = 28, plus = true }: { t: Tone; x: number; y: number; w: number; h?: number; plus?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="none" className={t.ghost} strokeWidth={2} strokeDasharray="6 6" />
      {plus ? <path className={cn(t.accentStroke, "ill-pulse")} d={`M${x + w / 2 - 6} ${y + h / 2} h12 M${x + w / 2} ${y + h / 2 - 6} v12`} fill="none" strokeWidth={3} strokeLinecap="round" /> : null}
    </g>
  );
}

function Scene({ kind, t }: { kind: IllustrationKind; t: Tone }) {
  switch (kind) {
    case "hero":
      return (
        <>
          <Bars t={t} rows={5} y0={14} gap={34} h={18} scale={1.1} />
          <Card t={t} x={70} y={60} w={330} h={104} className="ill-float">
            <Check t={t} cx={125} cy={112} r={30} />
            <Lines t={t} x={180} y={96} a={150} b={100} />
          </Card>
          <Card t={t} x={130} y={190} w={320} h={96} className="ill-float" style={delay(-3)}>
            <Clock t={t} cx={184} cy={238} />
            <Lines t={t} x={232} y={222} a={150} b={96} />
          </Card>
          <Slot t={t} x={70} y={316} w={250} h={36} />
        </>
      );
    case "strip":
      return (
        <>
          <Bars t={t} rows={3} y0={8} gap={30} h={16} />
          <Card t={t} x={116} y={14} w={248} h={68} className="ill-float">
            <Check t={t} cx={158} cy={48} r={22} />
            <Lines t={t} x={200} y={34} a={110} b={76} />
          </Card>
        </>
      );
    case "confirmed":
    case "pending":
    case "cancelled":
      return (
        <>
          <Bars t={t} rows={5} />
          <Card t={t} x={116} y={38} className="ill-float">
            {kind === "confirmed" ? <Check t={t} cx={164} cy={80} /> : kind === "pending" ? <Clock t={t} cx={164} cy={80} /> : (
              <>
                <circle cx={164} cy={80} r={27} className={t.lineSoft} />
                <path d="M153 69 l22 22 M175 69 l-22 22" fill="none" strokeWidth={6} strokeLinecap="round" className={t.cross} />
              </>
            )}
            <Lines t={t} x={212} y={62} a={120} b={84} soft={kind === "cancelled"} />
          </Card>
        </>
      );
    case "done":
      return (
        <>
          <Bars t={t} rows={5} y0={10} gap={34} h={18} />
          <Card t={t} x={96} y={34} w={288} h={92} className="ill-pop" style={delay(0)}>
            <Lines t={t} x={190} y={58} a={150} b={100} />
            <circle cx={142} cy={80} r={26} className={t.barAlt} />
          </Card>
          <Card t={t} x={56} y={96} w={288} h={92} className="ill-pop" style={delay(0.15)}>
            <Lines t={t} x={150} y={120} a={130} b={90} />
            <circle cx={102} cy={142} r={26} className={t.barAlt} />
          </Card>
          <Card t={t} x={136} y={158} w={288} h={92} className="ill-pop" style={delay(0.3)}>
            <Check t={t} cx={190} cy={204} r={28} />
            <Lines t={t} x={238} y={188} a={140} b={96} />
          </Card>
        </>
      );
    case "notFound":
      return (
        <>
          <Bars t={t} rows={4} y0={6} gap={30} h={14} />
          <rect x={110} y={26} width={140} height={86} rx={20} fill="none" strokeWidth={2.5} strokeDasharray="7 7" className={cn(t.ghost, "ill-dash")} />
          <path d="M162 62 q0 -16 18 -16 q18 0 18 14 q0 10 -12 16 q-6 3 -6 10 M180 94 v0.5" fill="none" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" className={t.accentStroke} />
        </>
      );
    case "offline":
      return (
        <>
          <Bars t={t} rows={4} y0={6} gap={30} h={14} />
          <Card t={t} x={86} y={22} w={188} h={90} className="ill-float">
            <path d="M132 64 a24 24 0 0 1 34 0 M121 53 a40 40 0 0 1 56 0 M149 82 v0.5" fill="none" strokeWidth={5.5} strokeLinecap="round" className={t.accentStroke} />
            <path d="M118 96 L182 38" fill="none" strokeWidth={5.5} strokeLinecap="round" className={t.hand} />
            <Lines t={t} x={196} y={52} a={56} b={44} soft />
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
            <circle cx={98} cy={52} r={13} className={t.accent} />
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
              <circle cx={96 + i * 70} cy={60} r={22} className={i === 0 ? t.accent : t.barAlt} />
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
            <rect key={i} x={50 + i * 48} y={28} width={36} height={36} rx={10} className={i === 2 ? t.accent : t.card} strokeWidth={1.5} />
          ))}
          <path d="M157 39 l14 14 M171 39 l-14 14" strokeWidth={4} strokeLinecap="round" className={t.onAccent} />
        </>
      );
  }
}

const sizes: Record<IllustrationKind, { w: number; h: number }> = {
  hero: { w: 520, h: 380 },
  strip: { w: 480, h: 96 },
  confirmed: { w: 480, h: 160 },
  pending: { w: 480, h: 160 },
  cancelled: { w: 480, h: 160 },
  done: { w: 480, h: 260 },
  notFound: { w: 360, h: 128 },
  offline: { w: 360, h: 128 },
  emptyDay: { w: 360, h: 120 },
  emptyServices: { w: 360, h: 120 },
  emptyClients: { w: 360, h: 120 },
  emptyDays: { w: 360, h: 100 },
};

export function Illustration({ kind, tone = "light", animated = false, className }: { kind: IllustrationKind; tone?: IllustrationTone; animated?: boolean; className?: string }) {
  const { w, h } = sizes[kind];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice" className={cn("block h-auto w-full", animated && "ill-anim", className)}>
      <Scene kind={kind} t={tones[tone]} />
    </svg>
  );
}
