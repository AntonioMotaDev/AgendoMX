import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-5 text-base font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto",
  {
    variants: {
      variant: {
        primary: "bg-ink text-surface hover:bg-ink/90",
        secondary: "border border-line bg-surface text-ink hover:bg-paper",
        ghost: "text-ink hover:bg-ink/5",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant }), className)} {...props} />;
}
