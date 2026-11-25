import { describe, expect, it } from "vitest";
import {
  buildImageKey,
  checkUpload,
  contentTypeForKey,
  fitWithin,
  isImageKey,
  keyFromMediaUrl,
  mediaUrl,
  MAX_UPLOAD_BYTES,
  randomImageId,
  sniffImage,
  squareCrop,
} from "./images";

const bytes = (...parts: Array<number[] | string>) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = (n: number) => [(n >> 8) & 255, n & 255];
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
const le16 = (n: number) => [n & 255, (n >> 8) & 255];

const png = (w: number, h: number) =>
  bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], be32(13), "IHDR", be32(w), be32(h), [8, 6, 0, 0, 0], new Array(8).fill(0));

/** SOI + APP0 + (optional DQT) + SOF0 */
const jpeg = (w: number, h: number, sof = 0xc0) =>
  bytes([0xff, 0xd8], [0xff, 0xe0], be16(16), "JFIF\0", [1, 1, 0, 0, 1, 0, 1, 0, 0], [0xff, 0xdb], be16(5), [0, 1, 2], [0xff, sof], be16(11), [8], be16(h), be16(w), [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);

const webpX = (w: number, h: number) => bytes("RIFF", [30, 0, 0, 0], "WEBP", "VP8X", [10, 0, 0, 0], [0, 0, 0, 0], le24(w - 1), le24(h - 1));
const webpLossy = (w: number, h: number) => bytes("RIFF", [30, 0, 0, 0], "WEBP", "VP8 ", [10, 0, 0, 0], [0, 0, 0], [0x9d, 0x01, 0x2a], le16(w), le16(h), [0, 0]);
const webpLossless = (w: number, h: number) => {
  const packed = ((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14);
  return bytes("RIFF", [30, 0, 0, 0], "WEBP", "VP8L", [10, 0, 0, 0], [0x2f], [packed & 255, (packed >> 8) & 255, (packed >> 16) & 255, (packed >>> 24) & 255], [0, 0, 0, 0, 0]);
};

describe("sniffImage", () => {
  it("reads PNG dimensions from IHDR", () => {
    expect(sniffImage(png(512, 300))).toEqual({ type: "image/png", ext: "png", width: 512, height: 300 });
  });

  it("reads JPEG dimensions past other segments, for baseline and progressive frames", () => {
    expect(sniffImage(jpeg(1600, 900))).toEqual({ type: "image/jpeg", ext: "jpg", width: 1600, height: 900 });
    expect(sniffImage(jpeg(800, 600, 0xc2))).toMatchObject({ width: 800, height: 600 });
  });

  it("reads all three WebP flavours", () => {
    expect(sniffImage(webpX(1200, 630))).toEqual({ type: "image/webp", ext: "webp", width: 1200, height: 630 });
    expect(sniffImage(webpLossy(640, 480))).toMatchObject({ type: "image/webp", width: 640, height: 480 });
    expect(sniffImage(webpLossless(333, 777))).toMatchObject({ type: "image/webp", width: 333, height: 777 });
  });

  it("rejects everything that is not one of those, whatever it claims to be", () => {
    const html = bytes("<html><script>alert(1)</script></html>".padEnd(64, " "));
    const svg = bytes('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'.padEnd(64, " "));
    const gif = bytes("GIF89a", [1, 0, 1, 0], new Array(40).fill(0));
    const pdf = bytes("%PDF-1.7\n", new Array(40).fill(0x20));
    for (const bad of [html, svg, gif, pdf, new Uint8Array(0), new Uint8Array(5), bytes([0xff, 0xd8])]) expect(sniffImage(bad)).toBeNull();
  });

  it("is not fooled by truncated or lying headers", () => {
    expect(sniffImage(png(10, 10).slice(0, 20))).toBeNull();
    expect(sniffImage(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], new Array(30).fill(0)))).toBeNull(); // no IHDR
    expect(sniffImage(bytes("RIFF", [0, 0, 0, 0], "WAVE", new Array(30).fill(0)))).toBeNull(); // RIFF but not WebP
    expect(sniffImage(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 1], new Array(20).fill(0)))).toBeNull(); // bad segment length
  });
});

describe("checkUpload", () => {
  it("accepts reasonable images", () => {
    expect(checkUpload(webpX(512, 512))).toMatchObject({ ok: true, image: { ext: "webp" } });
    expect(checkUpload(jpeg(1600, 900))).toMatchObject({ ok: true });
  });
  it("rejects oversized files, tiny and huge dimensions, and non-images", () => {
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(png(512, 512));
    expect(checkUpload(big)).toEqual({ ok: false, reason: "too_large" });
    expect(checkUpload(png(16, 16))).toEqual({ ok: false, reason: "too_small" });
    expect(checkUpload(png(5000, 100))).toEqual({ ok: false, reason: "too_big_dimensions" });
    expect(checkUpload(png(5000, 4000))).toEqual({ ok: false, reason: "too_big_dimensions" });
    expect(checkUpload(bytes("not an image at all, just text".padEnd(64, " ")))).toEqual({ ok: false, reason: "unsupported" });
  });
});

describe("sizing", () => {
  it("fits inside the box keeping the aspect ratio and never upscales", () => {
    expect(fitWithin(4000, 3000, 1600, 900)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(3000, 4000, 512, 512)).toEqual({ width: 384, height: 512 });
    expect(fitWithin(300, 200, 1600, 900)).toEqual({ width: 300, height: 200 });
    expect(fitWithin(10000, 1, 1600, 900)).toEqual({ width: 1600, height: 1 });
  });
  it("crops the largest centered square", () => {
    expect(squareCrop(1000, 600)).toEqual({ sx: 200, sy: 0, size: 600 });
    expect(squareCrop(600, 1000)).toEqual({ sx: 0, sy: 200, size: 600 });
    expect(squareCrop(500, 500)).toEqual({ sx: 0, sy: 0, size: 500 });
  });
});

describe("object keys", () => {
  const id = "3f2b8c1e-5a4d-4b7e-9c1a-2d3e4f5a6b7c";
  it("round-trips between key and public URL", () => {
    const key = buildImageKey(id, "logo", "webp", "abcdefghij12");
    expect(key).toBe(`businesses/${id}/logo-abcdefghij12.webp`);
    expect(isImageKey(key)).toBe(true);
    expect(mediaUrl(key)).toBe(`/media/${key}`);
    expect(keyFromMediaUrl(mediaUrl(key))).toBe(key);
    expect(contentTypeForKey(key)).toBe("image/webp");
    expect(contentTypeForKey(`businesses/${id}/cover-abcdefghij12.jpg`)).toBe("image/jpeg");
  });
  it("refuses anything that is not exactly one of our keys (traversal, other prefixes, other kinds, case)", () => {
    for (const bad of [
      `../businesses/${id}/logo-abcdefghij12.webp`,
      `businesses/${id}/../logo-abcdefghij12.webp`,
      `businesses/${id}/logo-abcdefghij12.svg`,
      `businesses/${id}/avatar-abcdefghij12.webp`,
      `businesses/${id}/logo-short.webp`,
      `businesses/${id}/logo-ABCDEFGHIJ12.webp`,
      `other/${id}/logo-abcdefghij12.webp`,
      `businesses/not-a-uuid/logo-abcdefghij12.webp`,
      `businesses/${id}/logo-abcdefghij12.webp/extra`,
      "",
    ]) expect(isImageKey(bad)).toBe(false);
    expect(keyFromMediaUrl("https://evil.com/media/x")).toBeNull();
    expect(keyFromMediaUrl(null)).toBeNull();
    expect(keyFromMediaUrl("/media/../../etc/passwd")).toBeNull();
  });
  it("random ids are 12 url-safe chars and differ", () => {
    const a = randomImageId();
    expect(a).toMatch(/^[a-z0-9]{12}$/);
    expect(randomImageId()).not.toBe(a);
  });
});
