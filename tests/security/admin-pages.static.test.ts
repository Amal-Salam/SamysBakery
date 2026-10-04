import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Every admin page returns early unless the viewer is an admin, so no admin
// query runs for customers (defence in depth behind the admin layout).

const ADMIN_DIR = path.resolve(import.meta.dirname, "../../app/admin/(protected)");

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return pages(full);
    return entry === "page.tsx" ? [full] : [];
  });
}

describe("admin pages", () => {
  const files = pages(ADMIN_DIR);

  it("there are admin pages to check", () => {
    expect(files.length).toBeGreaterThanOrEqual(14);
  });

  it.each(files.map((file) => [path.relative(ADMIN_DIR, file)]))("%s guards with isAdminViewer()", (rel) => {
    const text = readFileSync(path.join(ADMIN_DIR, rel), "utf8");
    expect(text).toMatch(/export default async function \w+\([^)]*\)[^{]*\{\s*if \(!\(await isAdminViewer\(\)\)\) return null;/);
  });
});
