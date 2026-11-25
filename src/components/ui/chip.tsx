import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Single-choice pill. Use inside a role="radiogroup" with a visible label. */
export function Chip({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "min-h-11 rounded-md border px-4 text-base font-medium transition-colors duration-150",
        selected ? "border-ink bg-ink text-surface" : "border-stone bg-surface text-ink hover:bg-paper",
      )}
    >
      {children}
    </button>
  );
}

/** On/off pill for multi-select options. Pair with a visible group label. */
export function ToggleChip({ pressed, onToggle, children }: { pressed: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        "min-h-11 rounded-md border px-3 text-sm font-medium transition-colors duration-150",
        pressed ? "border-ink bg-ink text-surface" : "border-stone bg-surface text-ink hover:bg-paper",
      )}
    >
      {children}
    </button>
  );
}
