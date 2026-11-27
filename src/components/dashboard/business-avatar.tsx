import { cn } from "@/lib/utils";

/** The business logo, or its initial on the panel accent color when there is none yet. */
export function BusinessAvatar({ name, logoUrl, className }: { name: string; logoUrl: string | null; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "•";
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- served by our own /media route, already compressed
    <img src={logoUrl} alt="" className={cn("h-14 w-14 shrink-0 rounded-full border border-line object-cover", className)} />
  ) : (
    <span aria-hidden="true" className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pa text-xl font-bold text-pa-on", className)}>
      {initial}
    </span>
  );
}
