/**
 * Integration tests for logo/cover storage, with an in-memory bucket. Runs only
 * when DATABASE_URL_TEST points at a disposable database (it DROPS the schema).
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { keyFromMediaUrl, MAX_UPLOAD_BYTES } from "@/lib/images";
import { saveBusinessProfile } from "@/server/actions/business-writes";
import { removeBusinessImage, saveBusinessImage, UPLOADS_PER_HOUR, type ImageBucket } from "@/server/actions/media-writes";

const url = process.env.DATABASE_URL_TEST;

const bytes = (...parts: Array<number[] | string>) => new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const png = (w: number, h: number) => bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], be32(13), "IHDR", be32(w), be32(h), [8, 6, 0, 0, 0], new Array(8).fill(0));
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
const webp = (w: number, h: number) => bytes("RIFF", [30, 0, 0, 0], "WEBP", "VP8X", [10, 0, 0, 0], [0, 0, 0, 0], le24(w - 1), le24(h - 1));

class FakeBucket implements ImageBucket {
  objects = new Map<string, { size: number; contentType?: string }>();
  failDeletes = false;
  async put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
    this.objects.set(key, { size: value.length, contentType: options?.httpMetadata?.contentType });
  }
  async delete(key: string) {
    if (this.failDeletes) throw new Error("r2 down");
    this.objects.delete(key);
  }
}

describe.skipIf(!url)("business images (Postgres + fake R2)", () => {
  const client = postgres(url ?? "", { max: 10, onnotice: () => {} });
  const db = drizzle(client, { schema });
  let a = "";
  let b = "";
  let bucket = new FakeBucket();
  const row = async (id: string) => (await db.select().from(schema.businesses).where(eq(schema.businesses.id, id)))[0]!;

  beforeAll(async () => {
    await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  beforeEach(async () => {
    bucket = new FakeBucket();
    await db.delete(schema.businesses);
    await db.delete(schema.user);
    await db.delete(schema.rateLimits);
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

  it("stores a valid image under the business's own folder and publishes its /media URL", async () => {
    const result = await saveBusinessImage(db, bucket, a, "logo", webp(512, 512));
    expect(result.ok).toBe(true);
    const published = (await row(a)).logoUrl!;
    const key = keyFromMediaUrl(published)!;
    expect(key).toMatch(new RegExp(`^businesses/${a}/logo-[a-z0-9]{12}\\.webp$`));
    expect(bucket.objects.get(key)).toMatchObject({ contentType: "image/webp" });
    expect((await row(b)).logoUrl).toBeNull();
  });

  it("replacing an image removes the old object and changes the URL", async () => {
    await saveBusinessImage(db, bucket, a, "cover", png(1600, 900));
    const first = (await row(a)).coverUrl!;
    await saveBusinessImage(db, bucket, a, "cover", webp(1600, 900));
    const second = (await row(a)).coverUrl!;
    expect(second).not.toBe(first);
    expect([...bucket.objects.keys()]).toEqual([keyFromMediaUrl(second)]);
  });

  it("logo and cover are independent", async () => {
    await saveBusinessImage(db, bucket, a, "logo", webp(512, 512));
    await saveBusinessImage(db, bucket, a, "cover", webp(1600, 900));
    const r = await row(a);
    expect(r.logoUrl).toMatch(/logo-/);
    expect(r.coverUrl).toMatch(/cover-/);
    expect(bucket.objects.size).toBe(2);
  });

  it("rejects non-images, oversized files and odd dimensions without storing anything", async () => {
    const text = bytes("<svg onload=alert(1)>".padEnd(64, " "));
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(webp(512, 512));
    expect(await saveBusinessImage(db, bucket, a, "logo", text)).toEqual({ ok: false, error: "unsupported" });
    expect(await saveBusinessImage(db, bucket, a, "logo", big)).toEqual({ ok: false, error: "too_large" });
    expect(await saveBusinessImage(db, bucket, a, "logo", png(10, 10))).toEqual({ ok: false, error: "too_small" });
    expect(await saveBusinessImage(db, bucket, a, "logo", png(9000, 9000))).toEqual({ ok: false, error: "too_big_dimensions" });
    expect(bucket.objects.size).toBe(0);
    expect((await row(a)).logoUrl).toBeNull();
  });

  it("rate limits uploads per business, not globally", async () => {
    for (let i = 0; i < UPLOADS_PER_HOUR; i++) expect((await saveBusinessImage(db, bucket, a, "logo", webp(512, 512))).ok).toBe(true);
    expect(await saveBusinessImage(db, bucket, a, "logo", webp(512, 512))).toEqual({ ok: false, error: "rate_limited" });
    expect((await saveBusinessImage(db, bucket, b, "logo", webp(512, 512))).ok).toBe(true);
    expect(bucket.objects.size).toBe(2); // each business keeps only its current logo
  });

  it("removes an image: object deleted, column cleared, other business untouched", async () => {
    await saveBusinessImage(db, bucket, a, "logo", webp(512, 512));
    await saveBusinessImage(db, bucket, b, "logo", webp(512, 512));
    expect(await removeBusinessImage(db, bucket, a, "logo")).toEqual({ ok: true });
    expect((await row(a)).logoUrl).toBeNull();
    expect((await row(b)).logoUrl).not.toBeNull();
    expect(bucket.objects.size).toBe(1);
  });

  it("an unknown business stores nothing", async () => {
    const ghost = "00000000-0000-4000-8000-000000000000";
    expect(await saveBusinessImage(db, bucket, ghost, "logo", webp(512, 512))).toEqual({ ok: false, error: "not_found" });
    expect(bucket.objects.size).toBe(0);
  });

  it("a storage failure while cleaning up the old image does not fail the upload", async () => {
    await saveBusinessImage(db, bucket, a, "logo", webp(512, 512));
    bucket.failDeletes = true;
    expect((await saveBusinessImage(db, bucket, a, "logo", webp(512, 512))).ok).toBe(true);
  });

  it("the database only accepts /media paths, never external URLs", async () => {
    await expect(db.update(schema.businesses).set({ logoUrl: "https://evil.com/x.png" }).where(eq(schema.businesses.id, a))).rejects.toThrow();
    await expect(db.update(schema.businesses).set({ coverUrl: "javascript:alert(1)" }).where(eq(schema.businesses.id, a))).rejects.toThrow();
    await expect(db.update(schema.businesses).set({ logoUrl: "/media/businesses/x/logo-abcdefghij12.webp" }).where(eq(schema.businesses.id, a))).resolves.toBeDefined();
  });
});
