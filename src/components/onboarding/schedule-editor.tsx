"use client";

import { ChevronDown, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import { copy } from "@/lib/copy";
import { parseTimeOfDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  applyPreset,
  formatTime,
  hasShift,
  MAX_BLOCKS_PER_DAY,
  SCHEDULE_PRESETS,
  setWeekdays,
  SHIFT_SUGGESTIONS,
  timeOptions,
  toggleShift,
  WORKWEEK,
  workweekIsUniform,
  type TimeBlock,
  type WeeklySchedule,
} from "@/server/services/schedule";

const c = copy.onboarding.schedule;
const START_OPTIONS = timeOptions("start");
const END_OPTIONS = timeOptions("end");
const DEFAULT_BLOCK: TimeBlock = { start: "09:00", end: "18:00" };
const selectClass = "min-h-11 w-full rounded-md border border-stone bg-surface px-2.5 text-base text-ink";

/** "09:00" → "9:00", the way people say it. */
const shortTime = (time: string) => time.replace(/^0/, "");

/** A sensible second shift: one hour after the previous one ends, three hours long. */
function nextBlock(previous: TimeBlock | undefined): TimeBlock {
  if (!previous) return { ...DEFAULT_BLOCK };
  const start = Math.min(parseTimeOfDay(previous.end) + 60, 22 * 60);
  return { start: formatTime(start), end: formatTime(Math.min(start + 180, 24 * 60)) };
}

/** One row: an open/closed switch, up to two shifts, and one-tap suggested shifts. */
function DayRow({
  label,
  accessibleName,
  toggleLabel,
  blocks,
  onChange,
}: {
  label: string;
  /** Lowercase name used in control labels, e.g. "lunes a viernes". */
  accessibleName: string;
  toggleLabel: string;
  blocks: TimeBlock[];
  onChange: (blocks: TimeBlock[]) => void;
}) {
  const open = blocks.length > 0;
  const update = (index: number, patch: Partial<TimeBlock>) => onChange(blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)));

  return (
    <li className="flex flex-col gap-3 px-4 py-2">
      <div className="flex items-center justify-between">
        <span className="text-base font-medium text-ink">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-muted">{open ? c.open : c.closed}</span>
          <Switch label={toggleLabel} checked={open} onCheckedChange={(on) => onChange(on ? [{ ...DEFAULT_BLOCK }] : [])} />
        </div>
      </div>

      {open ? (
        <div className="flex flex-col gap-3 pb-2">
          {blocks.map((block, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                aria-label={`${c.from}, ${accessibleName}, turno ${index + 1}`}
                className={selectClass}
                value={block.start}
                onChange={(e) => update(index, { start: e.target.value })}
              >
                {!START_OPTIONS.includes(block.start) ? <option value={block.start}>{block.start}</option> : null}
                {START_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
              <span className="text-sm text-ink-muted">{c.to.toLowerCase()}</span>
              <select
                aria-label={`${c.to}, ${accessibleName}, turno ${index + 1}`}
                className={selectClass}
                value={block.end}
                onChange={(e) => update(index, { end: e.target.value })}
              >
                {!END_OPTIONS.includes(block.end) ? <option value={block.end}>{block.end}</option> : null}
                {END_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
              {blocks.length > 1 ? (
                <button
                  type="button"
                  aria-label={`${c.removeBlock}, ${accessibleName}, turno ${index + 1}`}
                  onClick={() => onChange(blocks.filter((_, i) => i !== index))}
                  className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink hover:bg-ink/5"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          ))}

          {blocks.length < MAX_BLOCKS_PER_DAY ? (
            <button
              type="button"
              onClick={() => onChange([...blocks, nextBlock(blocks.at(-1))])}
              className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-brand-ink underline underline-offset-2"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              {c.addBlock}
            </button>
          ) : null}

          <div role="group" aria-label={`${c.shiftsLabel}, ${accessibleName}`} className="flex flex-col gap-2">
            <span className="text-sm text-ink-muted">{c.shiftsLabel}</span>
            <div className="flex flex-wrap gap-2">
              {SHIFT_SUGGESTIONS.map((shift) => (
                <ToggleChip key={shift.id} pressed={hasShift(blocks, shift.block)} onToggle={() => onChange(toggleShift(blocks, shift.block))}>
                  {c.shifts[shift.id]} {shortTime(shift.block.start)}–{shortTime(shift.block.end)}
                </ToggleChip>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Weekly hours editor. Monday to Friday can be set once (default when they match),
 * suggested full-week schedules live behind a button, and each row offers
 * one-tap suggested shifts (morning + afternoon = split shift).
 */
export function ScheduleEditor({ value, onChange }: { value: WeeklySchedule; onChange: (next: WeeklySchedule) => void }) {
  const [grouped, setGrouped] = useState(() => workweekIsUniform(value));
  const [presetsOpen, setPresetsOpen] = useState(false);

  const setDay = (weekday: number, blocks: TimeBlock[]) => onChange({ ...value, [weekday]: blocks });

  function toggleGrouped(on: boolean) {
    setGrouped(on);
    // Joining the days copies Monday's hours onto Tuesday to Friday.
    if (on) onChange(setWeekdays(value, WORKWEEK, value[WORKWEEK[0]] ?? []));
  }

  function choosePreset(index: number) {
    onChange(applyPreset(SCHEDULE_PRESETS[index]!));
    // Every preset runs Monday to Friday on one schedule.
    setGrouped(true);
    setPresetsOpen(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          className="justify-between"
          aria-expanded={presetsOpen}
          aria-controls="schedule-presets"
          onClick={() => setPresetsOpen((open) => !open)}
        >
          {c.suggestedButton}
          <ChevronDown aria-hidden="true" className={cn("h-5 w-5 transition-transform duration-150", presetsOpen && "rotate-180")} />
        </Button>
        {presetsOpen ? (
          <div id="schedule-presets" className="flex flex-col gap-2">
            <p className="text-sm text-ink-muted">{c.suggestedHint}</p>
            {SCHEDULE_PRESETS.map((preset, index) => (
              <Button key={preset.id} variant="secondary" className="justify-start" onClick={() => choosePreset(index)}>
                {c.presets[preset.id]}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2">
        <div className="flex flex-col py-1.5">
          <span className="text-base font-medium text-ink">
            {c.sameWeekdays}
          </span>
          <span className="text-sm text-ink-muted">{grouped ? c.sameWeekdaysOn : c.sameWeekdaysOff}</span>
        </div>
        <Switch label={c.sameWeekdays} checked={grouped} onCheckedChange={toggleGrouped} />
      </div>

      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
        {grouped ? (
          <DayRow
            label={c.weekdaysLabel}
            accessibleName={c.weekdaysLabel.toLowerCase()}
            toggleLabel={c.weekdaysToggle}
            blocks={value[WORKWEEK[0]] ?? []}
            onChange={(blocks) => onChange(setWeekdays(value, WORKWEEK, blocks))}
          />
        ) : (
          WORKWEEK.map((weekday) => (
            <DayRow
              key={weekday}
              label={c.days[weekday]!}
              accessibleName={c.days[weekday]!.toLowerCase()}
              toggleLabel={c.dayToggle(c.days[weekday]!)}
              blocks={value[weekday] ?? []}
              onChange={(blocks) => setDay(weekday, blocks)}
            />
          ))
        )}
        {[6, 0].map((weekday) => (
          <DayRow
            key={weekday}
            label={c.days[weekday]!}
            accessibleName={c.days[weekday]!.toLowerCase()}
            toggleLabel={c.dayToggle(c.days[weekday]!)}
            blocks={value[weekday] ?? []}
            onChange={(blocks) => setDay(weekday, blocks)}
          />
        ))}
      </ul>
    </div>
  );
}
