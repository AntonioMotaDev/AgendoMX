/**
 * Which appointments get the 24 h email reminder. Pure.
 *
 * Eligible: confirmed, client left an email, not reminded yet, starting within
 * the next 24 h but not in the next 2 h (too late to be useful), and booked MORE
 * than 24 h in advance. Someone who booked this morning for tomorrow just got
 * their confirmation; a second email would be noise.
 * The long window means a missed cron tick never loses a reminder.
 */
export const REMINDER_LEAD_HOURS = 24;
export const REMINDER_MIN_HOURS = 2;
export const REMINDER_BATCH = 50;

const HOUR_MS = 3_600_000;

export function reminderWindow(now: Date): { startsAfter: Date; startsUntil: Date } {
  return {
    startsAfter: new Date(now.getTime() + REMINDER_MIN_HOURS * HOUR_MS),
    startsUntil: new Date(now.getTime() + REMINDER_LEAD_HOURS * HOUR_MS),
  };
}

/** Booked early enough that a reminder adds something. */
export function bookedInAdvance(createdAt: Date, startsAt: Date): boolean {
  return startsAt.getTime() - createdAt.getTime() > REMINDER_LEAD_HOURS * HOUR_MS;
}
