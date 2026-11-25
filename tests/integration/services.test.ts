/**
 * Integration tests for service management. Runs only when DATABASE_URL_TEST
 * points at a disposable database (it DROPS and recreates the public schema).
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { createService, deleteService, moveService, updateService } from "@/server/actions/service-writes";
import { saveBusinessProfile } from "@/server/actions/business-writes";
import { getService, listServices } from "@/server/queries/services";
import { generatePublicToken } from "@/lib/tokens";
import type { ServiceFormData } from "@/lib/validators/services";

const url = process.env.DATABASE_URL_TEST;

const data = (name: string, over: Partial<ServiceFormData> = {}): ServiceFormData => ({
  name,
  description: null,
  price: 18000,
  priceIsFrom: false,
  durationMin: 45,
  bufferAfterMin: 0,
  isBookableOnline: true,
  isActive: true,
  ...over,
});

describe.skipIf(!url)("services (Postgres)", () => {
  const client = postgres(url ?? "", { max: 10, onnotice: () => {} });
  const db = drizzle(client, { schema });
  let a = "";
  let b = "";

  beforeAll(async () => {
    await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  beforeEach(async () => {
    await db.delete(schema.businesses);
    await db.delete(schema.user);
    await db.insert(schema.user).values([
      { id: "u-a", name: "Ana", email: "a@example.com" },
      { id: "u-b", name: "Beto", email: "b@example.com" },
    ]);
    const make = async (owner: { id: string; name: string }, slug: string) => {
      const r = await saveBusinessProfile(db, owner, { name: slug, category: "barbershop", categoryOther: null, state: "Jalisco", city: "GDL", slug });
      return r.ok ? r.data.id : "";
    };
    a = await make({ id: "u-a", name: "Ana" }, "negocio-a");
    b = await make({ id: "u-b", name: "Beto" }, "negocio-b");
  });

  afterAll(async () => {
    await client.end();
  });

  it("creates services in order and links them to the team", async () => {
    await createService(db, a, data("Corte"));
    await createService(db, a, data("Barba"));
    await createService(db, a, data("Corte + barba"));
    expect((await listServices(db, a)).map((s) => s.name)).toEqual(["Corte", "Barba", "Corte + barba"]);
    expect(await db.select().from(schema.staffServices)).toHaveLength(3);
  });

  it("moves a service up and down, renumbering without ties, and ignores the edges", async () => {
    const ids: string[] = [];
    for (const [i, name] of ["X", "Y", "Z"].entries()) {
      const r = await createService(db, a, data(name, { durationMin: 30 + i }));
      ids.push(r.ok ? r.data.id : "");
    }
    const [x, y, z] = ids;
    await moveService(db, a, z!, "up");
    expect((await listServices(db, a)).map((s) => s.name)).toEqual(["X", "Z", "Y"]);
    await moveService(db, a, x!, "up"); // already first
    await moveService(db, a, y!, "down"); // already last
    expect((await listServices(db, a)).map((s) => s.name)).toEqual(["X", "Z", "Y"]);
    expect((await listServices(db, a)).map((s) => s.sortOrder)).toEqual([0, 1, 2]);
  });

  it("simultaneous creations get distinct sort orders (the per-business lock serializes them)", async () => {
    await Promise.all(["A1", "A2", "A3", "A4", "A5", "A6"].map((n) => createService(db, a, data(n))));
    const orders = (await listServices(db, a)).map((s) => s.sortOrder);
    expect(new Set(orders).size).toBe(6);
    expect(orders).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("updates every field", async () => {
    const created = await createService(db, a, data("Corte"));
    const id = created.ok ? created.data.id : "";
    await updateService(db, a, id, data("Corte clásico", { price: null, priceIsFrom: false, bufferAfterMin: 15, description: "Con lavado", isBookableOnline: false }));
    expect(await getService(db, a, id)).toMatchObject({ name: "Corte clásico", priceCents: null, bufferAfterMin: 15, description: "Con lavado", isBookableOnline: false });
  });

  it("a business can never read, edit, move or delete another business's service", async () => {
    const created = await createService(db, b, data("De Beto"));
    const id = created.ok ? created.data.id : "";
    expect(await getService(db, a, id)).toBeNull();
    expect(await updateService(db, a, id, data("Hackeado"))).toMatchObject({ ok: false, error: "not_found" });
    expect(await moveService(db, a, id, "up")).toMatchObject({ ok: false, error: "not_found" });
    expect(await deleteService(db, a, id)).toMatchObject({ ok: false, error: "not_found" });
    expect((await getService(db, b, id))?.name).toBe("De Beto");
  });

  it("a malformed id is just 'not found' everywhere, never a database error", async () => {
    for (const bad of ["no-es-un-uuid", "", "1; DROP TABLE services"]) {
      expect(await getService(db, a, bad)).toBeNull();
      expect(await updateService(db, a, bad, data("X"))).toMatchObject({ ok: false, error: "not_found" });
      expect(await deleteService(db, a, bad)).toMatchObject({ ok: false, error: "not_found" });
      expect(await moveService(db, a, bad, "up")).toMatchObject({ ok: false, error: "not_found" });
    }
  });

  it("always keeps one active service: cannot hide or delete the last one", async () => {
    const first = await createService(db, a, data("Único"));
    const id = first.ok ? first.data.id : "";
    expect(await updateService(db, a, id, data("Único", { isActive: false }))).toMatchObject({ ok: false, error: "last_active" });
    expect(await deleteService(db, a, id)).toMatchObject({ ok: false, error: "last_active" });

    const second = await createService(db, a, data("Otro"));
    expect((await updateService(db, a, id, data("Único", { isActive: false }))).ok).toBe(true);
    // Now "Otro" is the only active one.
    expect(await deleteService(db, a, second.ok ? second.data.id : "")).toMatchObject({ ok: false, error: "last_active" });
    expect((await deleteService(db, a, id)).ok).toBe(true); // hidden one can go
  });

  it("two requests hiding the last two active services at once: one succeeds, one is refused", async () => {
    const one = await createService(db, a, data("Uno"));
    const two = await createService(db, a, data("Dos"));
    const results = await Promise.all([
      updateService(db, a, one.ok ? one.data.id : "", data("Uno", { isActive: false })),
      updateService(db, a, two.ok ? two.data.id : "", data("Dos", { isActive: false })),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
    expect((await listServices(db, a)).filter((s) => s.isActive)).toHaveLength(1);
  });

  it("refuses to delete a service that has appointments, but allows hiding it", async () => {
    const booked = await createService(db, a, data("Con citas"));
    await createService(db, a, data("Respaldo"));
    const serviceId = booked.ok ? booked.data.id : "";
    const [member] = await db.select().from(schema.staff).where(eq(schema.staff.businessId, a));
    const [client2] = await db.insert(schema.clients).values({ businessId: a, name: "Cliente", phone: "+525512345678" }).returning();
    const starts = new Date("2026-12-01T16:00:00Z");
    await db.insert(schema.appointments).values({
      businessId: a, staffId: member!.id, serviceId, clientId: client2!.id, startsAt: starts,
      endsAt: new Date(starts.getTime() + 45 * 60_000), blockedUntil: new Date(starts.getTime() + 45 * 60_000),
      serviceNameSnapshot: "Con citas", status: "confirmed", source: "manual", publicToken: generatePublicToken(),
    });
    expect(await deleteService(db, a, serviceId)).toMatchObject({ ok: false, error: "has_appointments" });
    expect((await updateService(db, a, serviceId, data("Con citas", { isActive: false }))).ok).toBe(true);
  });
});
