import { and, asc, eq, gte } from "drizzle-orm";
import { availabilityExceptions } from "@/db/schema";
import { getPrimaryStaff, type Reader } from "./business";
import { groupExceptionRows, type ExceptionDay } from "@/server/services/exceptions";

/** Upcoming exceptions (today onward) of the business's staff, one entry per date. */
export async function listUpcomingExceptions(db: Reader, businessId: string, fromDate: string): Promise<ExceptionDay[]> {
  const staff = await getPrimaryStaff(db, businessId);
  if (!staff) return [];
  const rows = await db
    .select({
      date: availabilityExceptions.date,
      type: availabilityExceptions.type,
      startTime: availabilityExceptions.startTime,
      endTime: availabilityExceptions.endTime,
    })
    .from(availabilityExceptions)
    .where(and(eq(availabilityExceptions.staffId, staff.id), gte(availabilityExceptions.date, fromDate)))
    .orderBy(asc(availabilityExceptions.date), asc(availabilityExceptions.startTime));
  return groupExceptionRows(rows);
}
