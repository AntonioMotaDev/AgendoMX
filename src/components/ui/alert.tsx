import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Status message. Text carries the meaning; color is only reinforcement. */
export function Alert({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3.5 py-3 text-sm",
        tone === "error" && "border-danger/40 bg-danger/5 text-danger",
        tone === "success" && "border-success/40 bg-success/5 text-success",
        tone === "info" && "border-line bg-surface text-ink",
      )}
    >
      {children}
    </div>
  );
}
