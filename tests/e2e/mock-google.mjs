// Local mock of Google's OAuth endpoints for automated tests ONLY.
// The app accepts it only when GOOGLE_OAUTH_BASE points at localhost (see
// lib/env.server.ts); production always uses accounts.google.com.
//
//   GET  /o/oauth2/v2/auth   → consent page (Continue / Cancel) that redirects back
//   POST /token              → checks client, code, redirect_uri and PKCE verifier
//   GET  /__state            → test hook: last authorize request + token exchanges
//
// The ID token it returns is NOT signed by Google, so Supabase rightly refuses
// it: the real end-to-end sign-in is checked manually against real Google.

import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_GOOGLE_PORT ?? 3997);
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "mock-client.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "mock-google-secret";

const codes = new Map(); // code → { redirectUri, challenge, nonce }
const state = { lastAuthorize: null, exchanges: [] };

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/health") return json(res, 200, { ok: true });
  if (url.pathname === "/__state") return json(res, 200, state);

  if (req.method === "GET" && url.pathname === "/o/oauth2/v2/auth") {
    const q = Object.fromEntries(url.searchParams);
    state.lastAuthorize = q;
    const code = randomBytes(16).toString("hex");
    codes.set(code, { redirectUri: q.redirect_uri, challenge: q.code_challenge, nonce: q.nonce });
    const ok = new URL(q.redirect_uri);
    ok.searchParams.set("code", code);
    ok.searchParams.set("state", q.state ?? "");
    const cancel = new URL(q.redirect_uri);
    cancel.searchParams.set("error", "access_denied");
    cancel.searchParams.set("state", q.state ?? "");
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(`<!doctype html><title>Mock Google</title><h1>Mock Google sign-in</h1>
      <p>Signing in to <strong id="host">${new URL(q.redirect_uri).host}</strong></p>
      <a href="${ok}">Continue</a> <a href="${cancel}">Cancel</a>`);
  }

  if (req.method === "POST" && url.pathname === "/token") {
    const body = Object.fromEntries(new URLSearchParams(await readBody(req)));
    const entry = codes.get(body.code);
    codes.delete(body.code); // codes are single-use, like Google's
    const verifierOk =
      !!entry && createHash("sha256").update(body.code_verifier ?? "").digest("base64url") === entry.challenge;
    const ok =
      !!entry &&
      body.client_id === CLIENT_ID &&
      body.client_secret === CLIENT_SECRET &&
      body.grant_type === "authorization_code" &&
      body.redirect_uri === entry.redirectUri &&
      verifierOk;
    state.exchanges.push({ ok, verifierOk, redirectUri: body.redirect_uri, clientSecretOk: body.client_secret === CLIENT_SECRET });
    if (!ok) return json(res, 400, { error: "invalid_grant" });
    const idToken = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
      iss: "https://accounts.google.com", aud: CLIENT_ID, sub: "mock-sub", email: "mock@example.com", nonce: entry.nonce,
      exp: Math.floor(Date.now() / 1000) + 600,
    })}.${randomBytes(32).toString("base64url")}`;
    return json(res, 200, { access_token: "mock-access", id_token: idToken, token_type: "Bearer", expires_in: 600 });
  }

  json(res, 404, { error: "not_found" });
}).listen(PORT, "127.0.0.1");
