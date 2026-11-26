"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { copy } from "@/lib/copy";
import { displayLocalDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const t = copy.public.booking;

const monthFormatter = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const monthOf = (date: string) => ({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) });

interface Props {
  /** Dates ("YYYY-MM-DD") that still have open times. Anything else is shown dimmed and cannot be chosen. */
  availableDates: string[];
  selected: string | null;
  onSelect: (date: string) => void;
  /** Id of the element that names the group ("Día"). */
  labelledBy: string;
}

/**
 * Month grid for picking the booking day. Only days with open times are radios
 * (the "Día" group), so keyboard and screen-reader users never land on a dead day.
 */
export function MonthCalendar({ availableDates, selected, onSelect, labelledBy }: Props) {
  const available = useMemo(() => new Set(availableDates), [availableDates]);
  const [view, setView] = useState(() => monthOf(selected ?? availableDates[0] ?? "2000-01-01"));

  const first = new Date(Date.UTC(view.y, view.m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
  const monthStart = keyOf(view.y, view.m, 1);
  const monthEnd = keyOf(view.y, view.m, daysInMonth);
  const hasPrev = availableDates.some((d) => d < monthStart);
  const hasNext = availableDates.some((d) => d > monthEnd);
  const raw = monthFormatter.format(first);
  const title = raw.charAt(0).toUpperCase() + raw.slice(1); // only the first letter: CSS `capitalize` would also turn "de" into "De"

  function move(delta: number) {
    const index = view.y * 12 + (view.m - 1) + delta;
    setView({ y: Math.floor(index / 12), m: (index % 12) + 1 });
  }

  const navButton = "flex h-10 w-10 items-center justify-center rounded-full border border-th-line bg-th-surface text-th-text hover:bg-th-soft disabled:opacity-35 disabled:hover:bg-th-surface";

  return (
    <div className="self-start rounded-[20px] border border-th-line bg-th-surface p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className={navButton} onClick={() => move(-1)} disabled={!hasPrev} aria-label={t.prevMonth}>
          <ChevronLeft aria-hidden="true" className="h-[18px] w-[18px]" />
        </button>
        <p aria-live="polite" className="text-base font-extrabold text-th-text">
          {title}
        </p>
        <button type="button" className={navButton} onClick={() => move(1)} disabled={!hasNext} aria-label={t.nextMonth}>
          <ChevronRight aria-hidden="true" className="h-[18px] w-[18px]" />
        </button>
      </div>
      <div aria-hidden="true" className="grid grid-cols-7 gap-[3px]">
        {WEEKDAY_INITIALS.map((w, i) => (
          <span key={i} className="py-1.5 text-center text-[11px] font-bold uppercase text-th-muted">
            {w}
          </span>
        ))}
      </div>
      <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-7 gap-[3px]">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = keyOf(view.y, view.m, day);
          if (!available.has(key)) {
            return (
              <span key={key} aria-hidden="true" className="flex aspect-square min-h-10 items-center justify-center text-sm font-bold tabular-nums text-th-muted opacity-40">
                {day}
              </span>
            );
          }
          const on = key === selected;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={displayLocalDate(key, true)}
              onClick={() => onSelect(key)}
              className={cn(
                "flex aspect-square min-h-10 items-center justify-center rounded-xl text-sm font-bold tabular-nums",
                on ? "bg-th-primary text-th-onp" : "text-th-text hover:bg-th-soft",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
