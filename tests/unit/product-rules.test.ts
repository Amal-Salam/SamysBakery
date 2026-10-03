import { describe, expect, it } from "vitest";

import {
  canArchive,
  detectImageType,
  libraryStatus,
  slugify,
  uniqueSlug,
} from "@/features/products/rules";
import { productInputSchema } from "@/schemas/product";

describe("slugify", () => {
  it.each([
    ["Sourdough", "sourdough"],
    ["Pain au Chocolat!", "pain-au-chocolat"],
    ["  Crème brûlée  ", "creme-brulee"],
    ["Mac & Cheese Bread", "mac-and-cheese-bread"],
    ["Red--Velvet  Slice", "red-velvet-slice"],
    ["***", ""],
  ])("%s → %s", (name, expected) => {
    expect(slugify(name)).toBe(expected);
  });

  it("never exceeds 120 characters or ends with a hyphen", () => {
    const slug = slugify(`${"a".repeat(119)} b`);
    expect(slug.length).toBeLessThanOrEqual(120);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("returns the base when free", () => {
    expect(uniqueSlug("brioche", new Set())).toBe("brioche");
  });
  it("appends the next free number", () => {
    expect(uniqueSlug("brioche", new Set(["brioche", "brioche-2"]))).toBe("brioche-3");
  });
  it("falls back when the name produced no slug", () => {
    expect(uniqueSlug("", new Set())).toBe("product");
  });
});

describe("detectImageType", () => {
  const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);
  const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

  it("detects JPEG", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
  });
  it("detects PNG", () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime).toBe(
      "image/png"
    );
  });
  it("detects WebP", () => {
    expect(detectImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))?.mime).toBe(
      "image/webp"
    );
  });
  it("detects AVIF", () => {
    expect(detectImageType(bytes(0, 0, 0, 0x1c, ...ascii("ftypavif")))?.mime).toBe("image/avif");
  });
  it.each([
    ["SVG (scriptable)", ascii("<svg xmlns")],
    ["HTML", ascii("<!DOCTYPE html>")],
    ["GIF", ascii("GIF89a")],
    ["PDF", ascii("%PDF-1.7")],
    ["empty", []],
  ])("rejects %s", (_label, content) => {
    expect(detectImageType(new Uint8Array(content))).toBeNull();
  });
});

describe("libraryStatus / canArchive", () => {
  it("prefers the current menu over other usages", () => {
    expect(libraryStatus([{ status: "EXPIRED" }, { status: "PUBLISHED" }])).toBe("ON_CURRENT_MENU");
  });
  it("reports the draft menu", () => {
    expect(libraryStatus([{ status: "DRAFT" }, { status: "EXPIRED" }])).toBe("ON_DRAFT_MENU");
  });
  it("reports past usage", () => {
    expect(libraryStatus([{ status: "EXPIRED" }])).toBe("USED_PREVIOUSLY");
  });
  it("reports never used", () => {
    expect(libraryStatus([])).toBe("NEVER_USED");
  });
  it("blocks archiving while on the current or draft menu", () => {
    expect(canArchive("ON_CURRENT_MENU")).toBe(false);
    expect(canArchive("ON_DRAFT_MENU")).toBe(false);
    expect(canArchive("USED_PREVIOUSLY")).toBe(true);
    expect(canArchive("NEVER_USED")).toBe(true);
  });
});

describe("productInputSchema", () => {
  const valid = { name: " Brioche ", slug: "", categoryId: "", description: "", ingredients: "" };

  it("trims and maps an empty category to null", () => {
    const parsed = productInputSchema.parse(valid);
    expect(parsed.name).toBe("Brioche");
    expect(parsed.categoryId).toBeNull();
  });
  it("requires a name", () => {
    expect(productInputSchema.safeParse({ ...valid, name: " " }).success).toBe(false);
  });
  it("rejects malformed slugs", () => {
    expect(productInputSchema.safeParse({ ...valid, slug: "two--hyphens" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, slug: "-lead" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, slug: "ok-slug-2" }).success).toBe(true);
  });
  it("rejects a non-UUID category", () => {
    expect(productInputSchema.safeParse({ ...valid, categoryId: "cakes" }).success).toBe(false);
  });
  it("limits description and ingredients to 2000 characters", () => {
    expect(productInputSchema.safeParse({ ...valid, description: "x".repeat(2001) }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, ingredients: "x".repeat(2001) }).success).toBe(false);
  });
});
