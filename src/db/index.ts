import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

export function createDb(connectionString: string) {
  // Hyperdrive pools connections; keep the per-request client tiny.
  // prepare: false is required behind Hyperdrive's transaction-mode pooling.
  const client = postgres(connectionString, { max: 5, prepare: false, fetch_types: false });
  return drizzle(client, { schema });
}

/**
 * Per-request DB client. Never cache it in module scope: Workers forbid
 * reusing I/O objects across requests.
 */
export async function getDb(): Promise<Db> {
  const { env } = await getCloudflareContext({ async: true });
  return createDb(env.HYPERDRIVE.connectionString);
}
