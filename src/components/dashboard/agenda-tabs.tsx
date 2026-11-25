import Link from "next/link";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const t = copy.panel.agenda;

export type AgendaView = "today" | "tomorrow" | "week";

const ITEMS: Array<{ key: AgendaView; href: string; label: string }> = [
  { key: "today", href: "/app", label: t.tabs.today },
  { key: "tomorrow", href: "/app/manana", label: t.tabs.tomorrow },
  { key: "week", href: "/app/semana", label: t.tabs.week },
];

export function AgendaTabs({ current }: { current: AgendaView }) {
  return (
    <nav aria-label={t.tabsLabel} className="flex gap-1 rounded-lg bg-ink/5 p-1">
      {ITEMS.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={i.key === current ? "page" : undefined}
          className={cn(
            "flex min-h-11 flex-1 items-center justify-center rounded-md text-base font-semibold",
            i.key === current ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
