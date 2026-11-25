/**
 * End-to-end test of scripts/backup: dump a database with real data, restore it into a
 * fresh one and verify it, and make sure the verification really fails when it should.
 * Runs only when DATABASE_URL_TEST points at a disposable Postgres (it DROPS the public
 * schema and creates/drops a scratch database next to it). Needs pg_dump/psql on PATH.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { generatePublicToken } from "@/lib/tokens";

const url = process.env.DATABASE_URL_TEST;
const scripts = join(process.cwd(), "scripts/backup");
const withDb = (u: string, name: string) => u.replace(/\/[^/?]+(\?|$)/, `/${name}$1`);

function run(script: string, args: string[], env: Record<string, string>) {
  return spawnSync("bash", [join(scripts, script), ...args], { env: { ...process.env, ...env }, encoding: "utf8" });
}

describe.skipIf(!url)("backup scripts (Postgres)", () => {
  const admin = postgres(url ?? "", { max: 1, onnotice: () => {} });
  const db = drizzle(admin, { schema });
  const maintenance = postgres(withDb(url ?? "", "postgres"), { max: 1, onnotice: () => {} });
  const scratch = "agendomx_restore_check";
  const out = mkdtempSync(join(tmpdir(), "agendomx-backup-"));
  let dump = "";

  const freshTarget = async () => {
    await maintenance.unsafe(`DROP DATABASE IF EXISTS ${scratch}`);
    await maintenance.unsafe(`CREATE DATABASE ${scratch}`);
    return withDb(url ?? "", scratch);
  };

  beforeAll(async () => {
    await admin.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(schema.user).values({ id: "u1", name: "Juan", email: "juan@example.com" });
    const [biz] = await db.insert(schema.businesses).values({ ownerUserId: "u1", slug: "barberia-juan", name: "Barbería Juan", category: "barbershop" }).returning();
    const [staff] = await db.insert(schema.staff).values({ businessId: biz!.id, name: "Juan" }).returning();
    const [svc] = await db.insert(schema.services).values({ businessId: biz!.id, name: "Corte", durationMin: 45 }).returning();
    const [client] = await db.insert(schema.clients).values({ businessId: biz!.id, name: "Ana", phone: "+525512340001" }).returning();
    for (let i = 0; i < 3; i++) {
      const startsAt = new Date(Date.UTC(2026, 11, 2 + i, 16));
      const endsAt = new Date(startsAt.getTime() + 45 * 60_000);
      await db.insert(schema.appointments).values({
        businessId: biz!.id, staffId: staff!.id, serviceId: svc!.id, clientId: client!.id, startsAt, endsAt, blockedUntil: endsAt,
        serviceNameSnapshot: "Corte", status: "confirmed", source: "public_link", publicToken: generatePublicToken(),
      });
    }
  });

  afterAll(async () => {
    await maintenance.unsafe(`DROP DATABASE IF EXISTS ${scratch}`);
    await maintenance.end();
    await admin.end();
    rmSync(out, { recursive: true, force: true });
  });

  it("backs up, restores into an empty database and verifies row counts", async () => {
    const made = run("backup.sh", ["test", out], { SOURCE_URL: url ?? "" });
    expect(made.status, made.stderr).toBe(0);
    dump = made.stdout.trim();
    expect(dump).toMatch(/agendomx-test-\d{8}T\d{6}Z\.dump$/);
    expect(readdirSync(out).sort()).toEqual([dump.split("/").pop()!.replace(".dump", ".dump"), dump.split("/").pop()!.replace(".dump", ".json")].sort());

    const manifest = JSON.parse(readFileSync(dump.replace(/\.dump$/, ".json"), "utf8"));
    expect(manifest.counts).toMatchObject({ user: 1, businesses: 1, appointments: 3, clients: 1 });
    expect(manifest.sha256).toMatch(/^[0-9a-f]{64}$/);

    const target = await freshTarget();
    const verified = run("verify-restore.sh", [dump], { TARGET_URL: target });
    expect(verified.status, verified.stderr).toBe(0);
    expect(verified.stderr).toContain("restore verified");

    // The restored copy enforces the rule that matters: no double bookings.
    const restored = postgres(target, { max: 1, onnotice: () => {} });
    try {
      const [{ n }] = await restored<{ n: number }[]>`select count(*)::int as n from appointments`;
      expect(n).toBe(3);
      const overlap = await restored
        .unsafe(`insert into appointments (business_id, staff_id, service_id, client_id, starts_at, ends_at, blocked_until, service_name_snapshot, status, source, public_token)
                 select business_id, staff_id, service_id, client_id, starts_at + interval '10 minutes', ends_at, blocked_until, 'x', 'confirmed', 'manual', '${"z".repeat(32)}' from appointments limit 1`)
        .then(() => null, (e: { code?: string }) => e.code);
      expect(overlap).toBe("23P01");
    } finally {
      await restored.end();
    }
  });

  it("refuses to restore into a database that already has tables", async () => {
    const target = await freshTarget();
    expect(run("verify-restore.sh", [dump], { TARGET_URL: target }).status).toBe(0);
    const again = run("verify-restore.sh", [dump], { TARGET_URL: target });
    expect(again.status).not.toBe(0);
    expect(again.stderr).toContain("refusing to restore");
  });

  it("detects a dump that changed after it was written", async () => {
    const copy = join(out, "tampered.dump");
    execFileSync("cp", [dump, copy]);
    execFileSync("cp", [dump.replace(/\.dump$/, ".json"), join(out, "tampered.json")]);
    writeFileSync(copy, "extra", { flag: "a" });
    const result = run("verify-restore.sh", [copy], { TARGET_URL: await freshTarget() });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("checksum mismatch");
  });

  it("fails when the restored data does not match what the manifest promised", async () => {
    const copy = join(out, "lying.dump");
    execFileSync("cp", [dump, copy]);
    const manifest = JSON.parse(readFileSync(dump.replace(/\.dump$/, ".json"), "utf8"));
    manifest.counts.appointments = 500; // pretend production had many more appointments
    writeFileSync(join(out, "lying.json"), JSON.stringify(manifest));
    const result = run("verify-restore.sh", [copy], { TARGET_URL: await freshTarget() });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("MISMATCH appointments");
  });

  it("refuses to run without a source URL or with an unreachable database", () => {
    expect(run("backup.sh", ["test", out], { SOURCE_URL: "" }).status).not.toBe(0);
    expect(run("backup.sh", ["test", out], { SOURCE_URL: "postgres://nobody:x@127.0.0.1:1/none" }).status).not.toBe(0);
    expect(run("backup.sh", ["Bad Label", out], { SOURCE_URL: url ?? "" }).status).not.toBe(0);
  });
});
