import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Status message for themed pages. Text carries the meaning; color only reinforces it. */
export function Notice({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[14px] border px-4 py-3 text-sm",
        tone === "error" && "border-th-danger/50 bg-th-danger/10 text-th-danger",
        tone === "success" && "border-th-primary/40 bg-th-soft text-th-text",
        tone === "info" && "border-th-line bg-th-surface text-th-text",
      )}
    >
      {children}
    </div>
  );
}
