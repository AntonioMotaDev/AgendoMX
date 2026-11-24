import type { Ref, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function TextareaField({ label, hint, error, id, className, ref, ...props }: TextareaFieldProps) {
  const fieldId = id ?? props.name;
  const describedBy = [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={fieldId}
        ref={ref}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          "w-full rounded-md border bg-surface px-3.5 py-3 text-base text-ink placeholder:text-ink-muted",
          error ? "border-danger" : "border-stone",
          className,
        )}
        {...props}
      />
      {hint && !error ? (
        <p id={`${fieldId}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${fieldId}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
