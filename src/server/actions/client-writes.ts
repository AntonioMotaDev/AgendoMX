import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { appointments, clients } from "@/db/schema";
import { isUuid } from "@/lib/ids";
import { generatePublicToken } from "@/lib/tokens";
import { countUpcomingForClient } from "@/server/queries/clients";

export const ANONYMIZED_NAME = "Cliente eliminado";

export type AnonymizeResult = { ok: true; data: { appointments: number } } | { ok: false; error: "not_found" | "has_upcoming" | "already_erased"; upcoming?: number };

/** +99 is not an assigned country code: the placeholder can never be dialed or collide with a real number, and still satisfies the E.164 CHECK. */
function placeholderPhone(): string {
  const digits = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => String(b % 10)).join("");
  return `+99${digits}`;
}

/**
 * Erases a customer's personal data at the business's request (ARCO "cancelación"): name, phone,
 * email and short notes are replaced with placeholders. The appointments stay in the agenda without
 * personal data, and their private links are rotated so any link already sent stops working.
 * Refused while the customer still has pending or confirmed appointments ahead.
 */
export async function anonymizeClient(db: Db, businessId: string, clientId: unknown, now: Date): Promise<AnonymizeResult> {
  if (!isUuid(clientId)) return { ok: false, error: "not_found" };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.transaction(async (tx): Promise<AnonymizeResult> => {
        const [client] = await tx
          .select({ id: clients.id, anonymizedAt: clients.anonymizedAt })
          .from(clients)
          .where(and(eq(clients.id, clientId), eq(clients.businessId, businessId)))
          .for("update")
          .limit(1);
        if (!client) return { ok: false, error: "not_found" };
        if (client.anonymizedAt) return { ok: false, error: "already_erased" };

        const upcoming = await countUpcomingForClient(tx, businessId, client.id, now);
        if (upcoming > 0) return { ok: false, error: "has_upcoming", upcoming };

        await tx.update(clients).set({ name: ANONYMIZED_NAME, phone: placeholderPhone(), email: null, notesShort: null, anonymizedAt: now }).where(eq(clients.id, client.id));

        const own = await tx.select({ id: appointments.id }).from(appointments).where(eq(appointments.clientId, client.id));
        for (const row of own) await tx.update(appointments).set({ publicToken: generatePublicToken() }).where(eq(appointments.id, row.id));
        return { ok: true, data: { appointments: own.length } };
      });
    } catch (error) {
      // A random placeholder collided with another one (astronomically rare): try a new one.
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error("could not allocate a placeholder phone");
}
