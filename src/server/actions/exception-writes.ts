import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { availabilityExceptions } from "@/db/schema";
import type { LocalDate } from "@/lib/time";
import { getPrimaryStaff } from "@/server/queries/business";
import { expandDates, validateException, type ExceptionInput, type ExceptionIssue } from "@/server/services/exceptions";

export type ExceptionWriteResult =
  | { ok: true; data: { dates: number } }
  | { ok: false; error: "invalid"; issues: ExceptionIssue[] }
  | { ok: false; error: "no_staff" };

/**
 * Sets the exception for every date in the range, replacing whatever was there:
 * re-saving a date edits it, and closing a day that had special hours swaps them.
 */
export async function saveExceptions(db: Db, businessId: string, input: ExceptionInput, today: LocalDate): Promise<ExceptionWriteResult> {
  const issues = validateException(input, today);
  if (issues.length > 0) return { ok: false, error: "invalid", issues };

  return db.transaction(async (tx) => {
    const staff = await getPrimaryStaff(tx, businessId);
    if (!staff) return { ok: false, error: "no_staff" } as const;

    const dates = expandDates(input.startDate, input.endDate);
    await tx.delete(availabilityExceptions).where(and(eq(availabilityExceptions.staffId, staff.id), inArray(availabilityExceptions.date, dates)));

    const rows: Array<typeof availabilityExceptions.$inferInsert> = [];
    for (const date of dates) {
      if (input.kind === "closed") rows.push({ staffId: staff.id, date, type: "closed", startTime: null, endTime: null });
      else for (const block of input.blocks) rows.push({ staffId: staff.id, date, type: "custom_hours", startTime: block.start, endTime: block.end });
    }
    await tx.insert(availabilityExceptions).values(rows);
    return { ok: true, data: { dates: dates.length } } as const;
  });
}

/** Removes the exception on one date, returning that day to the weekly schedule. */
export async function deleteExceptionDate(db: Db, businessId: string, date: LocalDate): Promise<{ ok: true } | { ok: false; error: "no_staff" }> {
  const staff = await getPrimaryStaff(db, businessId);
  if (!staff) return { ok: false, error: "no_staff" };
  await db.delete(availabilityExceptions).where(and(eq(availabilityExceptions.staffId, staff.id), eq(availabilityExceptions.date, date)));
  return { ok: true };
}
