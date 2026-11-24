import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

/** Liveness + DB reachability through Hyperdrive. Exposes no data. */
export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: "up" });
  } catch (error) {
    console.error("health check failed", error);
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
