/**
 * Integration tests for profile writes. Runs only when DATABASE_URL_TEST
 * points at a disposable database (it DROPS and recreates the public schema).
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { saveBusinessProfile } from "@/server/actions/business-writes";
import { changeSlug, updateBookingSettings, updateProfileInfo, updateSocialLinks, updateTheme } from "@/server/actions/profile-writes";
import { bookingSettingsSchema, profileInfoSchema, socialLinksSchema, themeSchema } from "@/lib/validators/profile";

const url = process.env.DATABASE_URL_TEST;

describe.skipIf(!url)("profile writes (Postgres)", () => {
  const client = postgres(url ?? "", { max: 10, onnotice: () => {} });
  const db = drizzle(client, { schema });
  let a = "";
  let b = "";
  const row = async (id: string) => (await db.select().from(schema.businesses).where(eq(schema.businesses.id, id)))[0]!;

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

  it("saves info and contact, then clears optional fields when emptied", async () => {
    const full = profileInfoSchema.parse({
      name: "Barbería A", category: "other", categoryOther: "Estudio de pilates", state: "Jalisco", city: "Zapopan",
      description: "Hola", address: "Calle 1", mapsUrl: "https://maps.app.goo.gl/x1", phone: "55 1234 5678", whatsapp: "55 8765 4321", email: "a@x.com",
    });
    await updateProfileInfo(db, a, full);
    expect(await row(a)).toMatchObject({
      name: "Barbería A", category: "other", categoryOther: "Estudio de pilates", city: "Zapopan", description: "Hola",
      address: "Calle 1", mapsUrl: "https://maps.app.goo.gl/x1", phone: "+525512345678", whatsapp: "+525587654321", email: "a@x.com",
    });

    const empty = profileInfoSchema.parse({ name: "Barbería A", category: "barbershop", state: "Jalisco", city: "Zapopan", description: "", address: "", mapsUrl: "", phone: "", whatsapp: "", email: "" });
    await updateProfileInfo(db, a, empty);
    expect(await row(a)).toMatchObject({ category: "barbershop", categoryOther: null, description: null, address: null, mapsUrl: null, phone: null, whatsapp: null, email: null });
  });

  it("saves the six social links and removes them when blank", async () => {
    await updateSocialLinks(db, a, socialLinksSchema.parse({
      instagram: "@juan", facebook: "juan.barber", tiktok: "@juan", youtube: "@juan", twitter: "@juan", linkedin: "https://linkedin.com/in/juan",
    }));
    expect(await row(a)).toMatchObject({
      instagramUrl: "https://www.instagram.com/juan", facebookUrl: "https://www.facebook.com/juan.barber", tiktokUrl: "https://www.tiktok.com/@juan",
      youtubeUrl: "https://www.youtube.com/@juan", twitterUrl: "https://x.com/juan", linkedinUrl: "https://linkedin.com/in/juan",
    });
    await updateSocialLinks(db, a, socialLinksSchema.parse({ instagram: "", facebook: "", tiktok: "", youtube: "", twitter: "", linkedin: "" }));
    expect(await row(a)).toMatchObject({ instagramUrl: null, facebookUrl: null, tiktokUrl: null, youtubeUrl: null, twitterUrl: null, linkedinUrl: null });
  });

  it("changes the slug, refuses one that is taken, and never touches another business", async () => {
    expect(await changeSlug(db, a, "nuevo-nombre")).toEqual({ ok: true, data: { slug: "nuevo-nombre" } });
    expect(await changeSlug(db, a, "negocio-b")).toEqual({ ok: false, error: "slug_taken" });
    expect((await row(a)).slug).toBe("nuevo-nombre");
    expect((await row(b)).slug).toBe("negocio-b");
    expect(await changeSlug(db, a, "nuevo-nombre")).toEqual({ ok: true, data: { slug: "nuevo-nombre" } }); // keeping your own is fine
  });

  it("two owners racing for the same new slug: exactly one wins", async () => {
    const results = await Promise.all([changeSlug(db, a, "el-elegido"), changeSlug(db, b, "el-elegido")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
  });

  it("starts every business on the Studio theme, changes only its own, and the database refuses unknown themes", async () => {
    expect((await row(a)).theme).toBe("studio");
    expect((await row(b)).theme).toBe("studio");

    await updateTheme(db, a, themeSchema.parse({ theme: "noir" }));
    expect((await row(a)).theme).toBe("noir");
    expect((await row(b)).theme).toBe("studio");

    await expect(client`UPDATE businesses SET theme = 'neon' WHERE id = ${a}`).rejects.toThrow();
    expect((await row(a)).theme).toBe("noir");
  });

  it("saves booking settings for its own business only", async () => {
    await updateBookingSettings(db, a, bookingSettingsSchema.parse({
      confirmationMode: "manual", pendingExpiryHours: 48, bookingLeadTimeMin: 240, bookingWindowDays: 60, cancellationMinHours: 24, cancellationPolicyText: "Avisa con tiempo",
    }));
    expect(await row(a)).toMatchObject({ confirmationMode: "manual", pendingExpiryHours: 48, bookingLeadTimeMin: 240, bookingWindowDays: 60, cancellationMinHours: 24, cancellationPolicyText: "Avisa con tiempo" });
    expect(await row(b)).toMatchObject({ confirmationMode: "auto", pendingExpiryHours: 24, bookingWindowDays: 30 });
  });

  it("the database itself refuses out-of-range booking settings", async () => {
    await expect(db.update(schema.businesses).set({ bookingWindowDays: 0 }).where(eq(schema.businesses.id, a))).rejects.toThrow();
    await expect(db.update(schema.businesses).set({ pendingExpiryHours: 500 }).where(eq(schema.businesses.id, a))).rejects.toThrow();
  });
});
