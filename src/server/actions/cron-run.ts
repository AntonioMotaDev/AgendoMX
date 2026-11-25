import type { Db } from "@/db";
import { pruneRateLimits } from "@/db/rate-limit";
import { claimDueReminders, expirePendingAppointments, pruneExpiredAuthRows, releaseReminders, type DueReminder } from "./cron-writes";

export interface CronSummary {
  expired: number;
  remindersSent: number;
  remindersFailed: number;
  sessionsPruned: number;
}

/**
 * One scheduled tick: expire stale requests, send due reminders, prune old
 * rate-limit counters. `send` is injected so the loop is testable without
 * email. Also prunes rate-limit counters and expired sessions/tokens. A failed send is released for the next tick; one bad recipient never
 * blocks the rest of the batch.
 */
export async function runCronTick(db: Db, now: Date, send: (reminder: DueReminder) => Promise<void>): Promise<CronSummary> {
  const expired = await expirePendingAppointments(db, now);

  const due = await claimDueReminders(db, now);
  const failed: string[] = [];
  for (const reminder of due) {
    try {
      await send(reminder);
    } catch (error) {
      // No recipient or link in the log: only the id and the provider's message.
      console.error("reminder email failed", reminder.id, error instanceof Error ? error.message : "unknown error");
      failed.push(reminder.id);
    }
  }
  await releaseReminders(db, failed);

  await pruneRateLimits(db);
  const { sessions } = await pruneExpiredAuthRows(db, now);
  return { expired, remindersSent: due.length - failed.length, remindersFailed: failed.length, sessionsPruned: sessions };
}
