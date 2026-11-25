import { ChevronDown } from "lucide-react";
import type { Ref, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
}

/** Native select (best picker on phones) with a visible label and inline error. */
export function SelectField({ label, error, hint, placeholder, id, className, children, ref, ...props }: SelectFieldProps) {
  const selectId = id ?? props.name;
  const describedBy = [hint ? `${selectId}-hint` : null, error ? `${selectId}-error` : null].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            "min-h-12 w-full appearance-none rounded-md border bg-surface pl-3.5 pr-10 text-base text-ink",
            error ? "border-danger" : "border-stone",
            className,
          )}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {children}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
      </div>
      {hint && !error ? (
        <p id={`${selectId}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${selectId}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
