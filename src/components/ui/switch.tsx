import { cn } from "@/lib/utils";

/** Accessible on/off toggle. The 44px hit area is the whole button, not just the track. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className="flex min-h-11 min-w-11 items-center justify-center disabled:opacity-60"
    >
      <span className={cn("relative h-7 w-12 rounded-full transition-colors duration-150", checked ? "bg-ink" : "bg-stone")}>
        <span
          className={cn(
            "absolute left-0 top-0.5 h-6 w-6 rounded-full bg-surface shadow-sm transition-transform duration-150",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
