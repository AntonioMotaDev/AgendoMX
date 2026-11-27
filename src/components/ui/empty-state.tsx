import type { ReactNode } from "react";
import { Illustration, type IllustrationKind } from "@/components/illustrations/illustration";
import { cn } from "@/lib/utils";

/** Empty list: a small illustration, what happened, and what to do next (docs/BRAND.md §12.7). */
export function EmptyState({ kind, title, hint, children, className }: { kind: IllustrationKind; title: string; hint?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-stone px-6 pb-6 pt-4 text-center", className)}>
      <Illustration kind={kind} className="mb-3 max-w-xs [mask-image:linear-gradient(to_right,transparent,black_14%,black_86%,transparent)]" />
      <p className="text-base font-semibold text-ink">{title}</p>
      {hint ? <p className="mt-1 text-sm text-ink-muted">{hint}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
