import { Ban, Check, CircleCheck, Hourglass, UserX, type LucideIcon } from "lucide-react";
import { copy } from "@/lib/copy";
import type { AppointmentStatus } from "@/server/services/appointment-status";
import { cn } from "@/lib/utils";

const t = copy.panel.agenda;

const STYLE: Record<AppointmentStatus, { Icon: LucideIcon; tone: string }> = {
  confirmed: { Icon: CircleCheck, tone: "bg-success/10 text-success" },
  pending: { Icon: Hourglass, tone: "bg-brand/15 text-brand-ink" },
  completed: { Icon: Check, tone: "bg-ink/5 text-ink-muted" },
  no_show: { Icon: UserX, tone: "bg-danger/10 text-danger" },
  cancelled: { Icon: Ban, tone: "bg-ink/5 text-ink-muted" },
  rejected: { Icon: Ban, tone: "bg-ink/5 text-ink-muted" },
  expired: { Icon: Hourglass, tone: "bg-ink/5 text-ink-muted" },
};

/** Appointment status as icon + text, so it never relies on color alone. */
export function StatusPill({ status, className }: { status: AppointmentStatus; className?: string }) {
  const { Icon, tone } = STYLE[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full py-[3px] pl-[7px] pr-2.5 text-xs font-bold", tone, className)}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {t.status[status as keyof typeof t.status] ?? status}
    </span>
  );
}
