import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Static checks: the service-role client and server secrets must never be
// reachable from browser code. Runs offline with the unit tests.

const ROOT = path.resolve(import.meta.dirname, "../..");
const SOURCE_DIRS = ["app", "components", "features", "lib", "actions", "schemas", "types"];
const SERVER_ONLY_MODULES = [
  "lib/supabase/admin.ts",
  "lib/supabase/server.ts",
  "lib/env.server.ts",
  "lib/security/auth.ts",
];
const SERVER_ONLY_IMPORTS = ["@/lib/supabase/admin", "@/lib/env.server"];

function sourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
    }
  };
  for (const dir of SOURCE_DIRS) walk(path.join(ROOT, dir));
  return files;
}

const files = sourceFiles().map((file) => ({
  rel: path.relative(ROOT, file),
  text: readFileSync(file, "utf8"),
}));

const isClientModule = (text: string) => /^\s*["']use client["'];?/m.test(text.slice(0, 200));

describe("service-role isolation", () => {
  it.each(SERVER_ONLY_MODULES)("%s is marked server-only", (rel) => {
    const text = readFileSync(path.join(ROOT, rel), "utf8");
    expect(text).toMatch(/^import "server-only";/m);
  });

  it("no client component imports the service-role client or server env", () => {
    const offenders = files.filter(
      (file) =>
        isClientModule(file.text) &&
        SERVER_ONLY_IMPORTS.some((specifier) => file.text.includes(specifier))
    );
    expect(offenders.map((file) => file.rel)).toEqual([]);
  });

  it("the service-role key is read from process.env only in lib/env.server.ts", () => {
    const readers = files
      .filter((file) => file.text.includes("process.env.SUPABASE_SERVICE_ROLE_KEY"))
      .map((file) => file.rel);
    expect(readers).toEqual(["lib/env.server.ts"]);
  });

  it("the service-role key is referenced only by server-only modules", () => {
    const referencers = files
      .filter((file) => file.text.includes("SUPABASE_SERVICE_ROLE_KEY"))
      .map((file) => file.rel)
      .sort();
    expect(referencers).toEqual(["lib/env.server.ts", "lib/supabase/admin.ts"]);
  });

  it("the Paystack secret key is read only in lib/env.server.ts", () => {
    const readers = files
      .filter((file) => file.text.includes("process.env.PAYSTACK_SECRET_KEY"))
      .map((file) => file.rel);
    expect(readers).toEqual(["lib/env.server.ts"]);
  });

  it("Paystack API calls only happen in the server-only integration module", () => {
    const callers = files.filter((file) => file.text.includes("api.paystack.co")).map((file) => file.rel);
    expect(callers).toEqual(["lib/env.server.ts"]);
    expect(readFileSync(path.join(ROOT, "lib/paystack/client.ts"), "utf8")).toMatch(/^import "server-only";/m);
  });

  it("the service-role client is used only from server-side modules", () => {
    const importers = files.filter((file) => file.text.includes("@/lib/supabase/admin"));
    for (const file of importers) {
      expect(isClientModule(file.text), `${file.rel} must not be a client module`).toBe(false);
    }
  });

  it("no secret is exposed through a NEXT_PUBLIC_ variable", () => {
    const publicVars = new Set<string>();
    for (const file of files) {
      for (const match of file.text.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) publicVars.add(match[0]);
    }
    const envExample = readFileSync(path.join(ROOT, ".env.example"), "utf8");
    for (const match of envExample.matchAll(/^(NEXT_PUBLIC_[A-Z0-9_]+)=/gm)) publicVars.add(match[1]);

    const suspicious = [...publicVars].filter(
      (name) =>
        /SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN/.test(name) ||
        (/_KEY$/.test(name) && !/PUBLISHABLE_KEY$|PUBLIC_KEY$/.test(name))
    );
    expect(suspicious).toEqual([]);
  });
});
