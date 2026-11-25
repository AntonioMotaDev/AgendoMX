import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS } from "@/lib/reserved-slugs";
import manifest from "./manifest";

describe("web app manifest", () => {
  const m = manifest();

  it("is installable: name, standalone display, start URL inside scope, 192 and 512 icons", () => {
    expect(m.name).toBeTruthy();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/app");
    expect(m.scope).toBe("/");
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect((m.icons ?? []).some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("every icon it names exists in public/", () => {
    for (const icon of m.icons ?? []) expect(existsSync(join(process.cwd(), "public", icon.src)), icon.src).toBe(true);
  });

  it("the static files it relies on cannot be taken as business slugs", () => {
    for (const slug of ["offline", "icons", "sw.js", "manifest.webmanifest"]) expect(RESERVED_SLUGS.has(slug), slug).toBe(true);
  });
});
