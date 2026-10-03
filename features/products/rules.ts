// Pure Product Library rules (no I/O) — unit tested.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** URL-safe slug from a product/category name: "Pain au Chocolat!" → "pain-au-chocolat". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

/** First free slug: base, base-2, base-3, … given slugs already taken. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = base || "product";
  if (!taken.has(root)) return root;
  for (let n = 2; ; n++) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export type ImageType = { mime: "image/jpeg" | "image/png" | "image/webp" | "image/avif"; ext: string };

/**
 * Identifies an image by its file signature (magic bytes), not by the
 * client-supplied name or MIME type.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const startsWith = (sig: number[], offset = 0) =>
    sig.every((byte, i) => bytes[offset + i] === byte);
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));

  if (startsWith([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", ext: "png" };
  }
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (ascii(4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(8, 4))) {
    return { mime: "image/avif", ext: "avif" };
  }
  return null;
}

export type MenuUsage = { status: "DRAFT" | "PUBLISHED" | "EXPIRED" };

export type LibraryStatus = "ON_CURRENT_MENU" | "ON_DRAFT_MENU" | "USED_PREVIOUSLY" | "NEVER_USED";

/** Where a library product currently stands, for admin display and deletion rules. */
export function libraryStatus(usages: readonly MenuUsage[]): LibraryStatus {
  if (usages.some((usage) => usage.status === "PUBLISHED")) return "ON_CURRENT_MENU";
  if (usages.some((usage) => usage.status === "DRAFT")) return "ON_DRAFT_MENU";
  if (usages.length > 0) return "USED_PREVIOUSLY";
  return "NEVER_USED";
}

/** Archiving is blocked while the product is on the published or draft menu. */
export function canArchive(status: LibraryStatus): boolean {
  return status === "USED_PREVIOUSLY" || status === "NEVER_USED";
}
