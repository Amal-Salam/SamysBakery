import { describe, expect, it } from "vitest";

import { validateConfig } from "./config-rules";

const good = {
  apiUrl: "https://samys-bakery.vercel.app/",
  supabaseUrl: "https://abc.supabase.co",
  supabaseKey: "sb_publishable_abc123",
};

describe("validateConfig", () => {
  it("accepts https URLs and a publishable key, trimming trailing slashes", () => {
    expect(validateConfig(good, false)).toEqual({ ...good, apiUrl: "https://samys-bakery.vercel.app" });
  });

  it("allows plain http only in development", () => {
    const local = { ...good, apiUrl: "http://192.168.1.20:3000", supabaseUrl: "http://192.168.1.20:54321" };
    expect(validateConfig(local, true).apiUrl).toBe("http://192.168.1.20:3000");
    expect(() => validateConfig(local, false)).toThrow(/must use https/);
  });

  it("refuses a secret key", () => {
    expect(() => validateConfig({ ...good, supabaseKey: "sb_secret_xyz" }, false)).toThrow(/never a secret key/);
    const serviceJwt = `x.${btoa(JSON.stringify({ role: "service_role" }))}.y`;
    expect(() => validateConfig({ ...good, supabaseKey: serviceJwt }, false)).toThrow(/never a secret key/);
  });

  it("reports missing or invalid values", () => {
    expect(() => validateConfig({ apiUrl: undefined, supabaseUrl: "nope", supabaseKey: "" }, true)).toThrow(
      /EXPO_PUBLIC_API_URL is missing; EXPO_PUBLIC_SUPABASE_URL is not a valid URL; EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing/
    );
  });
});
