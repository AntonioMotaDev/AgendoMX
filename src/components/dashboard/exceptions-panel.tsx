"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { BlockEditor, DEFAULT_BLOCK } from "@/components/schedule/schedule-editor";
import { displayLocalDate } from "@/lib/dates";
import { copy } from "@/lib/copy";
import { deleteExceptionAction, saveExceptionAction } from "@/server/actions/schedule";
import type { ExceptionDay, ExceptionKind } from "@/server/services/exceptions";
import type { TimeBlock } from "@/server/services/schedule";

const t = copy.panel.schedule;
const common = copy.panel.common;

const blocksText = (blocks: TimeBlock[]) => blocks.map((b) => `${b.start.replace(/^0/, "")}–${b.end.replace(/^0/, "")}`).join(" · ");

function ExceptionForm({ today, onDone }: { today: string; onDone: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<ExceptionKind>("closed");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [blocks, setBlocks] = useState<TimeBlock[]>([{ ...DEFAULT_BLOCK }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const result = await saveExceptionAction({ startDate, endDate, kind, blocks: kind === "custom_hours" ? blocks : [] });
    setSaving(false);
    if (!result.ok) return setError(result.error.message);
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-col gap-2">
        <span id="kind-label" className="text-sm font-medium text-ink">
          {t.kindLabel}
        </span>
        <div role="radiogroup" aria-labelledby="kind-label" className="flex flex-wrap gap-2">
          <Chip selected={kind === "closed"} onSelect={() => setKind("closed")}>
            {t.kindClosed}
          </Chip>
          <Chip selected={kind === "custom_hours"} onSelect={() => setKind("custom_hours")}>
            {t.kindCustom}
          </Chip>
        </div>
      </div>

      <Field label={t.startDate} type="date" min={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} name="startDate" />
      <Field
        label={t.endDate}
        hint={t.endDateHint}
        type="date"
        min={startDate || today}
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        name="endDate"
      />

      {kind === "custom_hours" ? <BlockEditor blocks={blocks} onChange={setBlocks} accessibleName="día especial" /> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={saving}>
          {saving ? common.saving : t.save}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={saving}>
          {common.cancel}
        </Button>
      </div>
    </form>
  );
}

export function ExceptionsPanel({ days, today }: { days: ExceptionDay[]; today: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function remove(date: string) {
    setError(null);
    setRemoving(date);
    const result = await deleteExceptionAction(date);
    setRemoving(null);
    if (!result.ok) return setError(result.error.message);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {days.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-center text-sm text-ink-muted">{t.emptyTitle}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {days.map((day) => {
            const label = displayLocalDate(day.date);
            return (
              <li key={day.date} className="flex items-center justify-between gap-2 py-1 pl-4 pr-1">
                <div className="flex flex-col py-1.5">
                  <span className="text-base font-medium text-ink">{label}</span>
                  <span className="text-sm text-ink-muted">{day.kind === "closed" ? t.closedDay : blocksText(day.blocks)}</span>
                </div>
                <button
                  type="button"
                  aria-label={t.deleteDay(label)}
                  disabled={removing === day.date}
                  onClick={() => remove(day.date)}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink hover:bg-ink/5 disabled:opacity-40"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <ExceptionForm today={today} onDone={() => setAdding(false)} />
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" className="h-5 w-5" />
          {t.add}
        </Button>
      )}
    </div>
  );
}
