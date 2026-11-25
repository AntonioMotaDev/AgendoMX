import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Label content; may contain links. The whole row is the touch target. */
  label: ReactNode;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Labeled checkbox with a 44px+ touch target and an inline error. */
export function CheckboxField({ label, error, id, className, ref, ...props }: CheckboxFieldProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          ref={ref}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn("mt-1 h-6 w-6 shrink-0 accent-[var(--ink)]", className)}
          {...props}
        />
        <label htmlFor={inputId} className="min-h-11 flex-1 py-2 text-sm leading-snug text-ink">
          {label}
        </label>
      </div>
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
