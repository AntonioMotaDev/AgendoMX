"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { copy } from "@/lib/copy";
import {
  applyPreset,
  DISPLAY_WEEKDAYS,
  formatTime,
  MAX_BLOCKS_PER_DAY,
  SCHEDULE_PRESETS,
  timeOptions,
  type TimeBlock,
  type WeeklySchedule,
} from "@/server/services/schedule";
import { parseTimeOfDay } from "@/lib/time";

const c = copy.onboarding.schedule;
const START_OPTIONS = timeOptions("start");
const END_OPTIONS = timeOptions("end");
const DEFAULT_BLOCK: TimeBlock = { start: "09:00", end: "18:00" };

/** A sensible second shift: one hour after the previous one ends, three hours long. */
function nextBlock(previous: TimeBlock | undefined): TimeBlock {
  if (!previous) return { ...DEFAULT_BLOCK };
  const start = Math.min(parseTimeOfDay(previous.end) + 60, 22 * 60);
  return { start: formatTime(start), end: formatTime(Math.min(start + 180, 24 * 60)) };
}

const selectClass = "min-h-11 w-full rounded-md border border-stone bg-surface px-2.5 text-base text-ink";

/** Weekly hours editor: presets plus per-day toggles with up to two shifts. */
export function ScheduleEditor({ value, onChange }: { value: WeeklySchedule; onChange: (next: WeeklySchedule) => void }) {
  const setDay = (weekday: number, blocks: TimeBlock[]) => onChange({ ...value, [weekday]: blocks });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">{c.presetsLabel}</span>
        <div className="flex flex-col gap-2">
          {SCHEDULE_PRESETS.map((preset) => (
            <Button key={preset.id} variant="secondary" className="justify-start" onClick={() => onChange(applyPreset(preset))}>
              {c.presets[preset.id]}
            </Button>
          ))}
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
        {DISPLAY_WEEKDAYS.map((weekday) => {
          const blocks = value[weekday] ?? [];
          const open = blocks.length > 0;
          const dayName = c.days[weekday]!;
          return (
            <li key={weekday} className="flex flex-col gap-3 px-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-ink">{dayName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-muted">{open ? c.open : c.closed}</span>
                  <Switch
                    label={c.dayToggle(dayName)}
                    checked={open}
                    onCheckedChange={(on) => setDay(weekday, on ? [{ ...DEFAULT_BLOCK }] : [])}
                  />
                </div>
              </div>

              {open ? (
                <div className="flex flex-col gap-2 pb-2">
                  {blocks.map((block, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        aria-label={`${c.from}, ${dayName.toLowerCase()}, turno ${index + 1}`}
                        className={selectClass}
                        value={block.start}
                        onChange={(e) => setDay(weekday, blocks.map((b, i) => (i === index ? { ...b, start: e.target.value } : b)))}
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
                        aria-label={`${c.to}, ${dayName.toLowerCase()}, turno ${index + 1}`}
                        className={selectClass}
                        value={block.end}
                        onChange={(e) => setDay(weekday, blocks.map((b, i) => (i === index ? { ...b, end: e.target.value } : b)))}
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
                          aria-label={`${c.removeBlock}, ${dayName.toLowerCase()}, turno ${index + 1}`}
                          onClick={() => setDay(weekday, blocks.filter((_, i) => i !== index))}
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
                      onClick={() => setDay(weekday, [...blocks, nextBlock(blocks.at(-1))])}
                      className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-brand-ink underline underline-offset-2"
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" />
                      {c.addBlock}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
