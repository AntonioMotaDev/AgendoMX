"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { scheduleIssueMessage } from "@/lib/validators/onboarding";
import { validateSchedule, type WeeklySchedule } from "@/server/services/schedule";
import { saveScheduleStepAction } from "@/server/actions/onboarding";
import { ScheduleEditor } from "./schedule-editor";

const c = copy.onboarding;

export function ScheduleStepForm({ initial }: { initial: WeeklySchedule }) {
  const router = useRouter();
  const [schedule, setSchedule] = useState<WeeklySchedule>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    const issues = validateSchedule(schedule);
    if (issues[0]) return setError(scheduleIssueMessage(issues[0]));

    setSaving(true);
    const result = await saveScheduleStepAction({
      days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, blocks: schedule[weekday] ?? [] })),
    });
    setSaving(false);
    if (!result.ok) return setError(result.error.message);
    router.push("/app/onboarding?paso=4");
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <ScheduleEditor
        value={schedule}
        onChange={(next) => {
          setError(null);
          setSchedule(next);
        }}
      />
      <Button onClick={submit} disabled={saving}>
        {saving ? c.shell.saving : c.shell.next}
      </Button>
    </div>
  );
}
