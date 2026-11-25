/**
 * Logo and cover images: byte-level validation and sizing math shared by the
 * browser (compression) and the server (upload checks). Pure, no I/O.
 *
 * The server never trusts the file name, the declared content type, or the
 * client's compression: it identifies the image from its own bytes.
 */

export const IMAGE_KINDS = ["logo", "cover"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export type ImageType = "image/jpeg" | "image/png" | "image/webp";
export type ImageExt = "jpg" | "png" | "webp";

const EXT_BY_TYPE: Record<ImageType, ImageExt> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const CONTENT_TYPE_BY_EXT: Record<ImageExt, ImageType> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** What the browser produces after compression stays well under this. */
export const MAX_UPLOAD_BYTES = 1_000_000;
export const MIN_DIMENSION = 32;
export const MAX_DIMENSION = 4096;

/** Output sizes for client-side compression. Logo is a centered square; cover keeps its aspect ratio. */
export const IMAGE_TARGETS = {
  logo: { maxWidth: 512, maxHeight: 512, square: true },
  cover: { maxWidth: 1600, maxHeight: 900, square: false },
} as const satisfies Record<ImageKind, { maxWidth: number; maxHeight: number; square: boolean }>;

export interface SniffedImage {
  type: ImageType;
  ext: ImageExt;
  width: number;
  height: number;
}

const u16be = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const u32be = (b: Uint8Array, i: number) => ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
const u24le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
const ascii = (b: Uint8Array, i: number, text: string) => text.length > 0 && b.length >= i + text.length && [...text].every((c, k) => b[i + k] === c.charCodeAt(0));

function sniffPng(b: Uint8Array): SniffedImage | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || !signature.every((v, i) => b[i] === v) || !ascii(b, 12, "IHDR")) return null;
  return { type: "image/png", ext: "png", width: u32be(b, 16), height: u32be(b, 20) };
}

function sniffJpeg(b: Uint8Array): SniffedImage | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    let marker = b[i + 1]!;
    while (marker === 0xff && i + 2 < b.length) {
      i++; // fill bytes
      marker = b[i + 1]!;
    }
    // Standalone markers carry no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2;
      continue;
    }
    const length = u16be(b, i + 2);
    if (length < 2) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (i + 9 > b.length) return null;
      return { type: "image/jpeg", ext: "jpg", height: u16be(b, i + 5), width: u16be(b, i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

function sniffWebp(b: Uint8Array): SniffedImage | null {
  if (b.length < 30 || !ascii(b, 0, "RIFF") || !ascii(b, 8, "WEBP")) return null;
  const make = (width: number, height: number): SniffedImage => ({ type: "image/webp", ext: "webp", width, height });
  if (ascii(b, 12, "VP8X")) return make(u24le(b, 24) + 1, u24le(b, 27) + 1);
  if (ascii(b, 12, "VP8L")) {
    if (b[20] !== 0x2f) return null;
    const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
    return make((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (ascii(b, 12, "VP8 ")) {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return make((b[26]! | (b[27]! << 8)) & 0x3fff, (b[28]! | (b[29]! << 8)) & 0x3fff);
  }
  return null;
}

/** Identifies PNG, JPEG or WebP from the first bytes and reads its dimensions. Anything else is null. */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  return sniffPng(bytes) ?? sniffJpeg(bytes) ?? sniffWebp(bytes);
}

export type ImageRejection = "too_large" | "unsupported" | "too_small" | "too_big_dimensions";

/** Server-side gate: byte size, real format and sane dimensions. */
export function checkUpload(bytes: Uint8Array): { ok: true; image: SniffedImage } | { ok: false; reason: ImageRejection } {
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  const image = sniffImage(bytes);
  if (!image) return { ok: false, reason: "unsupported" };
  if (image.width < MIN_DIMENSION || image.height < MIN_DIMENSION) return { ok: false, reason: "too_small" };
  if (image.width > MAX_DIMENSION || image.height > MAX_DIMENSION) return { ok: false, reason: "too_big_dimensions" };
  return { ok: true, image };
}

/** Largest size that fits the box keeping the aspect ratio. Never upscales. */
export function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Centered square crop of a width x height image. */
export function squareCrop(width: number, height: number): { sx: number; sy: number; size: number } {
  const size = Math.min(width, height);
  return { sx: Math.floor((width - size) / 2), sy: Math.floor((height - size) / 2), size };
}

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Unguessable per-upload id, so a new image never overwrites a cached old one. */
export function randomImageId(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY_RE = new RegExp(`^businesses/${UUID}/(logo|cover)-[a-z0-9]{12}\\.(jpg|png|webp)$`);

export function buildImageKey(businessId: string, kind: ImageKind, ext: ImageExt, id: string): string {
  return `businesses/${businessId}/${kind}-${id}.${ext}`;
}

/** Only keys we generate ourselves are ever read from or deleted in the bucket. */
export function isImageKey(key: string): boolean {
  return KEY_RE.test(key);
}

export const MEDIA_PREFIX = "/media/";

export function mediaUrl(key: string): string {
  return `${MEDIA_PREFIX}${key}`;
}

/** "/media/businesses/…/logo-abc.webp" → the bucket key, or null when it is not one of ours. */
export function keyFromMediaUrl(url: string | null): string | null {
  if (!url || !url.startsWith(MEDIA_PREFIX)) return null;
  const key = url.slice(MEDIA_PREFIX.length);
  return isImageKey(key) ? key : null;
}

export function contentTypeForKey(key: string): ImageType | null {
  const ext = key.split(".").pop() as ImageExt | undefined;
  return ext && ext in CONTENT_TYPE_BY_EXT ? CONTENT_TYPE_BY_EXT[ext] : null;
}

export function extForType(type: ImageType): ImageExt {
  return EXT_BY_TYPE[type];
}
