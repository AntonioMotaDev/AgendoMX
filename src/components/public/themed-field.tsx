import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

export interface ThemedFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  /** Fixed text shown inside the field, before the value (e.g. the country code). */
  leading?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/** Labeled input for themed public pages. Same contract as the panel's `Field`: visible label, hint and inline error. */
export function ThemedField({ label, hint, error, leading, id, className, ref, ...props }: ThemedFieldProps) {
  const inputId = id ?? props.name;
  const describedBy = [hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-bold text-th-text">
        {label}
      </label>
      <div className={cn("flex min-h-[52px] items-center overflow-hidden rounded-xl border-[1.5px] bg-th-surface focus-within:border-th-primary", error ? "border-th-danger" : "border-th-line")}>
        {leading ? <span aria-hidden="true" className="pl-3.5 text-base font-bold text-th-muted">{leading}</span> : null}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          // 16px: smaller text makes iOS zoom the page when the field is focused.
          className={cn("h-[50px] min-w-0 flex-1 bg-transparent px-3.5 text-base text-th-text outline-none placeholder:text-th-muted/70", className)}
          {...props}
        />
      </div>
      {hint && !error ? (
        <p id={`${inputId}-hint`} className="text-xs text-th-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-[13px] font-semibold text-th-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
