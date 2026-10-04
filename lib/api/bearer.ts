// Pure Authorization-header parsing for the mobile API. Unit tested.

/** A Supabase access token is a JWT: three base64url segments. */
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export type BearerParse = { ok: true; token: string | null } | { ok: false };

/**
 * Parses the Authorization header. No header → anonymous (token null).
 * A header that is present but malformed is rejected outright rather than
 * silently treated as anonymous.
 */
export function parseBearer(header: string | null): BearerParse {
  if (header === null || header.trim() === "") return { ok: true, token: null };
  const match = header.match(/^Bearer ([^\s]+)$/);
  if (!match || match[1].length > 4096 || !JWT_SHAPE.test(match[1])) return { ok: false };
  return { ok: true, token: match[1] };
}
