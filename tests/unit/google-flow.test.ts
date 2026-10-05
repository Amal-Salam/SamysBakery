import { describe, expect, it } from "vitest";

import {
  authorizeUrl,
  GOOGLE_FLOW_MAX_AGE_SECONDS,
  newFlow,
  parseFlow,
  pkceChallenge,
  serializeFlow,
  sha256Hex,
  stateMatches,
} from "@/lib/auth/google-flow";

describe("Google sign-in flow helpers", () => {
  it("creates unpredictable, distinct values", () => {
    const a = newFlow("/checkout");
    const b = newFlow("/checkout");
    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(a.state);
    expect(a.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.verifier.length).toBeGreaterThanOrEqual(43); // PKCE minimum
  });

  it("builds Google's URL with our redirect, S256 PKCE and a hashed nonce", () => {
    const flow = newFlow("/");
    const url = new URL(authorizeUrl("https://accounts.google.com/o/oauth2/v2/auth", {
      clientId: "client-123",
      redirectUri: "https://samys-bakery.vercel.app/auth/google/callback",
      flow,
    }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "client-123",
      response_type: "code",
      scope: "openid email profile",
      redirect_uri: "https://samys-bakery.vercel.app/auth/google/callback",
      state: flow.state,
      nonce: sha256Hex(flow.nonce),
      code_challenge: pkceChallenge(flow.verifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    expect(url.searchParams.get("nonce")).not.toBe(flow.nonce); // raw nonce never leaves the server
  });

  it("computes the S256 challenge exactly like an independent implementation (Web Crypto)", async () => {
    for (const verifier of [newFlow("/").verifier, "a".repeat(43), "x".repeat(128)]) {
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
      const expected = Buffer.from(digest).toString("base64url");
      expect(pkceChallenge(verifier)).toBe(expected);
      expect(pkceChallenge(verifier)).toMatch(/^[A-Za-z0-9_-]{43}$/); // base64url, no padding
    }
  });

  it("round-trips the cookie and rejects tampered, malformed or expired values", () => {
    const now = 1_000_000_000;
    const flow = newFlow("/account", now);
    expect(parseFlow(serializeFlow(flow), now + 1000)).toEqual(flow);
    expect(parseFlow(undefined)).toBeNull();
    expect(parseFlow("not-base64-json")).toBeNull();
    expect(parseFlow(Buffer.from(JSON.stringify({ state: "x" })).toString("base64url"))).toBeNull();
    expect(parseFlow(serializeFlow(flow), now + (GOOGLE_FLOW_MAX_AGE_SECONDS + 1) * 1000)).toBeNull();
    expect(parseFlow("x".repeat(3000))).toBeNull();
  });

  it("compares state exactly", () => {
    expect(stateMatches("abc123", "abc123")).toBe(true);
    expect(stateMatches("abc123", "abc124")).toBe(false);
    expect(stateMatches("abc123", "abc")).toBe(false);
    expect(stateMatches("abc123", undefined)).toBe(false);
    expect(stateMatches("abc123", ["abc123"])).toBe(false);
  });
});
