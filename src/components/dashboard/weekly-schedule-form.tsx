"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScheduleEditor } from "@/components/schedule/schedule-editor";
import { copy } from "@/lib/copy";
import { scheduleIssueMessage } from "@/lib/validators/onboarding";
import { saveWeeklyScheduleAction } from "@/server/actions/schedule";
import { validateSchedule, type WeeklySchedule } from "@/server/services/schedule";

const t = copy.panel.schedule;
const common = copy.panel.common;

export function WeeklyScheduleForm({ initial }: { initial: WeeklySchedule }) {
  const router = useRouter();
  const [schedule, setSchedule] = useState<WeeklySchedule>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    setSaved(false);
    const issues = validateSchedule(schedule);
    if (issues[0]) return setError(scheduleIssueMessage(issues[0]));

    setSaving(true);
    const result = await saveWeeklyScheduleAction({
      days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, blocks: schedule[weekday] ?? [] })),
    });
    setSaving(false);
    if (!result.ok) return setError(result.error.message);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="success">{t.weeklySaved}</Alert> : null}
      <ScheduleEditor
        value={schedule}
        onChange={(next) => {
          setError(null);
          setSaved(false);
          setSchedule(next);
        }}
      />
      <Button onClick={submit} disabled={saving}>
        {saving ? common.saving : common.save}
      </Button>
    </div>
  );
}
