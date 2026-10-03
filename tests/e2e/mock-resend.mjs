// Local mock of the Resend API for automated tests ONLY (localhost; see
// lib/env.server.ts).
//   POST /emails              → records the email (requires the test key)
//   POST /__control           → { failFor: "<recipient>" | null }: simulate an outage per recipient
//   GET  /__emails?to=<email> → emails received

import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_RESEND_PORT ?? 3998);
const KEY = process.env.RESEND_API_KEY ?? "re_test_mock_e2e";
const emails = [];
const failing = new Set();

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

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true });
  if (req.method === "GET" && url.pathname === "/__emails") {
    const to = url.searchParams.get("to");
    return json(res, 200, emails.filter((email) => !to || email.to.includes(to)));
  }
  if (req.method === "POST" && url.pathname === "/__control") {
    const { failFor, recover } = JSON.parse((await readBody(req)) || "{}");
    if (failFor) failing.add(failFor);
    if (recover) failing.delete(recover);
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/emails") {
    if (req.headers.authorization !== `Bearer ${KEY}`) return json(res, 401, { message: "Invalid API key" });
    const body = JSON.parse((await readBody(req)) || "{}");
    if (body.to?.some((to) => failing.has(to))) return json(res, 500, { message: "Simulated outage" });
    const id = `email_${emails.length + 1}`;
    emails.push({ id, idempotencyKey: req.headers["idempotency-key"], ...body });
    return json(res, 200, { id });
  }
  return json(res, 404, { message: "Not found" });
}).listen(PORT, "127.0.0.1", () => console.log(`mock resend listening on ${PORT}`));
