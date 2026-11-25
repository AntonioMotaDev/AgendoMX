import { describe, expect, it } from "vitest";
import { encodeToFit, type EncodeAttempt } from "./image-encode";

const blobOf = (type: string, size: number) => new Blob([new Uint8Array(size)], { type });

/** Fake canvas: sizes shrink as quality drops. */
const fake = (opts: { webp?: boolean; sizeAt: (quality: number) => number }): { encode: EncodeAttempt; calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    encode: async (type, quality, flatten) => {
      calls.push(`${type}@${quality}${flatten ? "+flat" : ""}`);
      if (type === "image/webp" && opts.webp === false) return blobOf("image/png", 5_000_000); // Safari: asked for webp, got png
      return blobOf(type, opts.sizeAt(quality));
    },
  };
};

describe("encodeToFit", () => {
  it("returns the first WebP that fits, at the best quality", async () => {
    const { encode, calls } = fake({ sizeAt: () => 200_000 });
    const out = await encodeToFit(encode);
    expect(out?.type).toBe("image/webp");
    expect(calls).toEqual(["image/webp@0.85"]);
  });

  it("lowers the quality until it fits", async () => {
    const { encode, calls } = fake({ sizeAt: (q) => (q >= 0.85 ? 1_500_000 : q >= 0.7 ? 1_100_000 : 800_000) });
    const out = await encodeToFit(encode);
    expect(out?.type).toBe("image/webp");
    expect(calls).toEqual(["image/webp@0.85", "image/webp@0.7", "image/webp@0.55"]);
  });

  it("falls back to JPEG on a flattened background when the browser cannot encode WebP", async () => {
    const { encode, calls } = fake({ webp: false, sizeAt: () => 300_000 });
    const out = await encodeToFit(encode);
    expect(out?.type).toBe("image/jpeg");
    expect(calls).toEqual(["image/webp@0.85", "image/jpeg@0.85+flat"]);
  });

  it("keeps lowering JPEG quality, then gives up with null", async () => {
    const shrinking = fake({ webp: false, sizeAt: (q) => (q > 0.5 ? 2_000_000 : 900_000) });
    expect((await encodeToFit(shrinking.encode))?.type).toBe("image/jpeg");
    expect(shrinking.calls.at(-1)).toBe("image/jpeg@0.4+flat");

    const hopeless = fake({ webp: false, sizeAt: () => 5_000_000 });
    expect(await encodeToFit(hopeless.encode)).toBeNull();
  });

  it("treats a null blob (canvas failure) as 'cannot encode'", async () => {
    expect(await encodeToFit(async () => null)).toBeNull();
  });

  it("respects a custom limit", async () => {
    const { encode } = fake({ sizeAt: () => 400_000 });
    expect(await encodeToFit(encode, 300_000)).toBeNull();
    expect((await encodeToFit(encode, 500_000))?.type).toBe("image/webp");
  });
});
