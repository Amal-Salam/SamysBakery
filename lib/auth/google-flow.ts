import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Pure pieces of "Sign in with Google" on our own domain (unit tested).
// Protections: `state` (CSRF), PKCE S256 (code interception), `nonce` (token
// replay). Google receives the SHA-256 hex of the nonce; Supabase receives the
// raw nonce and checks it against the ID token (Supabase's documented contract).

export const GOOGLE_FLOW_COOKIE = "samys_google_oauth";
export const GOOGLE_FLOW_MAX_AGE_SECONDS = 600;
export const GOOGLE_CALLBACK_PATH = "/auth/google/callback";

export type GoogleFlow = { state: string; nonce: string; verifier: string; next: string; createdAt: number };

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function newFlow(next: string, now = Date.now()): GoogleFlow {
  return { state: randomToken(), nonce: randomToken(), verifier: randomToken(48), next, createdAt: now };
}

export function authorizeUrl(base: string, input: { clientId: string; redirectUri: string; flow: GoogleFlow }): string {
  const url = new URL(base);
  url.search = new URLSearchParams({
    client_id: input.clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: input.redirectUri,
    state: input.flow.state,
    nonce: sha256Hex(input.flow.nonce),
    code_challenge: pkceChallenge(input.flow.verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

export function serializeFlow(flow: GoogleFlow): string {
  return Buffer.from(JSON.stringify(flow)).toString("base64url");
}

/** Parses the flow cookie; null if missing, malformed or expired. */
export function parseFlow(raw: string | undefined, now = Date.now()): GoogleFlow | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const flow = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<GoogleFlow>;
    if (
      typeof flow.state !== "string" ||
      typeof flow.nonce !== "string" ||
      typeof flow.verifier !== "string" ||
      typeof flow.next !== "string" ||
      typeof flow.createdAt !== "number"
    ) {
      return null;
    }
    if (now - flow.createdAt > GOOGLE_FLOW_MAX_AGE_SECONDS * 1000 || flow.createdAt > now + 60_000) return null;
    return flow as GoogleFlow;
  } catch {
    return null;
  }
}

/** Constant-time comparison of the returned state with the one we issued. */
export function stateMatches(expected: string, received: unknown): boolean {
  if (typeof received !== "string" || received.length === 0 || received.length > 256) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
