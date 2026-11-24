import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

export function createDb(connectionString: string) {
  // Hyperdrive pools connections; keep the per-request client tiny.
  // prepare: false is required behind Hyperdrive's transaction-mode pooling.
  // idle_timeout/max_lifetime make sure a client nobody closes cannot hold
  // connections forever (e.g. under `next dev` in plain Node).
  const client = postgres(connectionString, {
    max: 5,
    prepare: false,
    fetch_types: false,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
  });
  return drizzle(client, { schema });
}

/**
 * One client per request, shared by everything that runs in it (session check,
 * rate limiter, the page's queries). Keyed by the request's execution context,
 * so nothing is ever reused across requests: Workers forbid sharing I/O objects
 * between requests, and a module-level client would break that rule.
 * Before this, every call opened its own pool and nobody closed it.
 */
const clients = new WeakMap<object, Db>();

export async function getDb(): Promise<Db> {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const existing = clients.get(ctx);
  if (existing) return existing;
  const db = createDb(env.HYPERDRIVE.connectionString);
  clients.set(ctx, db);
  return db;
}
