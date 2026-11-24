import { cn } from "@/lib/utils";

/** Isotipo (docs/BRAND.md). Same geometry as public/brand/isotipo.svg. */
export function Isotipo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 640" aria-hidden="true" className={cn("h-8 w-8", className)} fill="currentColor">
      <g transform="translate(0 23)">
        <path d="M55 307 C55 154 169 34 315 34 C466 34 585 154 585 307 L585 560 H405 V307 C405 249 367 214 315 214 C263 214 235 253 235 307 Z" />
        <circle cx="145" cy="470" r="90" />
      </g>
    </svg>
  );
}

/** Horizontal logotype: isotipo + `agendo` (ink) `mx` (brand). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-ink", className)}>
      <Isotipo className="text-brand" />
      <span>
        agendo<span className="text-brand">mx</span>
      </span>
    </span>
  );
}
