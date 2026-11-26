"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tab = "services" | "info";

/**
 * "Servicios" and "Información" tabs. Both panels are rendered by the server and
 * stay in the HTML (search engines read them); only the active one is shown.
 */
export function ProfileTabs({ services, info, labels }: { services: ReactNode; info: ReactNode; labels: { group: string; services: string; info: string } }) {
  const id = useId();
  const [tab, setTab] = useState<Tab>("services");
  const order: Tab[] = ["services", "info"];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = order[(order.indexOf(tab) + 1) % order.length]!;
    setTab(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={labels.group} onKeyDown={onKeyDown} className="flex border-b border-th-line">
        {order.map((key) => (
          <button
            key={key}
            id={`${id}-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls={`${id}-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            className={cn(
              "-mb-px min-h-12 flex-1 border-b-2 text-[15px] font-bold",
              tab === key ? "border-th-primary text-th-text" : "border-transparent text-th-muted hover:text-th-text",
            )}
          >
            {key === "services" ? labels.services : labels.info}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel-services`} aria-labelledby={`${id}-tab-services`} hidden={tab !== "services"}>
        {services}
      </div>
      <div role="tabpanel" id={`${id}-panel-info`} aria-labelledby={`${id}-tab-info`} hidden={tab !== "info"}>
        {info}
      </div>
    </div>
  );
}
