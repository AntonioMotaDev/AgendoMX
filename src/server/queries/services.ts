import { and, asc, eq } from "drizzle-orm";
import type { Reader } from "./business";
import { services } from "@/db/schema";
import { isUuid } from "@/lib/ids";

/** All of a business's services in display order. Always scoped by businessId. */
export async function listServices(db: Reader, businessId: string) {
  return db.select().from(services).where(eq(services.businessId, businessId)).orderBy(asc(services.sortOrder), asc(services.name), asc(services.id));
}

/** One service, only if it belongs to the business (a foreign id returns null, never the row). */
export async function getService(db: Reader, businessId: string, serviceId: string) {
  if (!isUuid(serviceId)) return null;
  const [row] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.businessId, businessId)))
    .limit(1);
  return row ?? null;
}

/** Services the owner can book by hand: active ones, including those hidden from the public. */
export async function listActiveServices(db: Reader, businessId: string) {
  return db
    .select()
    .from(services)
    .where(and(eq(services.businessId, businessId), eq(services.isActive, true)))
    .orderBy(asc(services.sortOrder), asc(services.name), asc(services.id));
}
