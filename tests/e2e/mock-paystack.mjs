// Local mock of the Paystack API for automated tests ONLY.
// The app accepts it only when PAYSTACK_API_BASE points at localhost (see
// lib/env.server.ts); production always talks to https://api.paystack.co.
//
//   POST /transaction/initialize       → authorization_url on this server
//   GET  /pay/:reference               → hosted checkout page (Pay / Fail / Cancel)
//   POST /pay/:reference/:outcome      → completes, sends a signed webhook, redirects back
//   GET  /transaction/verify/:ref      → transaction state
//   POST /refund                       → refund request
//   POST /__control                    → test hook: override verify data (tamper tests)
//   GET  /__state                      → test hook: inspect transactions/refunds

import { createHmac } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PAYSTACK_PORT ?? 3999);
const SECRET = process.env.PAYSTACK_SECRET_KEY ?? "sk_test_mock_e2e";
const WEBHOOK_URL = process.env.MOCK_PAYSTACK_WEBHOOK_URL ?? "";

const transactions = new Map();
const refunds = [];
// Unique across mock restarts (real Paystack ids are globally unique).
let nextId = Date.now();

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

const authorized = (req) => req.headers.authorization === `Bearer ${SECRET}`;

async function sendWebhook(tx) {
  if (!WEBHOOK_URL) return;
  const body = JSON.stringify({
    event: "charge.success",
    data: { reference: tx.reference, amount: tx.amount, currency: tx.currency, status: tx.status },
  });
  const signature = createHmac("sha512", SECRET).update(body).digest("hex");
  await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-paystack-signature": signature },
    body,
  }).catch(() => undefined);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true });

  // --- test hooks -----------------------------------------------------
  if (req.method === "POST" && url.pathname === "/__control") {
    const { reference, ...overrides } = JSON.parse((await readBody(req)) || "{}");
    const tx = transactions.get(reference);
    if (!tx) return json(res, 404, { ok: false });
    Object.assign(tx, overrides);
    return json(res, 200, { ok: true, tx });
  }
  if (req.method === "GET" && url.pathname === "/__state") {
    return json(res, 200, { transactions: [...transactions.values()], refunds });
  }

  // --- hosted checkout --------------------------------------------------
  if (req.method === "GET" && parts[0] === "pay" && parts.length === 2) {
    const tx = transactions.get(parts[1]);
    if (!tx) return json(res, 404, { status: false });
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(`<!doctype html><html><head><title>Mock Paystack Checkout</title></head><body>
      <h1>Mock Paystack Checkout</h1>
      <p>Pay NGN ${(tx.amount / 100).toFixed(2)} for ${tx.email}</p>
      <form method="post" action="/pay/${tx.reference}/success"><button>Pay now</button></form>
      <form method="post" action="/pay/${tx.reference}/failed"><button>Simulate failed payment</button></form>
      <form method="post" action="/pay/${tx.reference}/abandoned"><button>Cancel payment</button></form>
      </body></html>`);
  }
  if (req.method === "POST" && parts[0] === "pay" && parts.length === 3) {
    const tx = transactions.get(parts[1]);
    if (!tx) return json(res, 404, { status: false });
    tx.status = parts[2];
    if (tx.status === "success") {
      tx.paid_at = tx.paid_at_override ?? new Date().toISOString();
      if (!tx.skipWebhook) await sendWebhook(tx);
    }
    const back = new URL(tx.callback_url);
    back.searchParams.set("trxref", tx.reference);
    back.searchParams.set("reference", tx.reference);
    res.writeHead(302, { Location: back.toString() });
    return res.end();
  }

  // --- API (secret key required) -------------------------------------------
  if (!authorized(req)) return json(res, 401, { status: false, message: "Invalid key" });

  if (req.method === "POST" && url.pathname === "/transaction/initialize") {
    const body = JSON.parse((await readBody(req)) || "{}");
    if (!body.reference || !Number.isInteger(body.amount) || body.currency !== "NGN") {
      return json(res, 400, { status: false, message: "Invalid request" });
    }
    transactions.set(body.reference, {
      id: nextId++,
      reference: body.reference,
      amount: body.amount,
      currency: body.currency,
      email: body.email,
      callback_url: body.callback_url,
      status: "ongoing",
      paid_at: null,
    });
    return json(res, 200, {
      status: true,
      message: "Authorization URL created",
      data: {
        authorization_url: `http://127.0.0.1:${PORT}/pay/${body.reference}`,
        access_code: `ac_${body.reference}`,
        reference: body.reference,
      },
    });
  }

  if (req.method === "GET" && parts[0] === "transaction" && parts[1] === "verify") {
    const tx = transactions.get(decodeURIComponent(parts[2] ?? ""));
    if (!tx) return json(res, 400, { status: false, message: "Transaction reference not found" });
    return json(res, 200, {
      status: true,
      message: "Verification successful",
      data: {
        id: tx.id,
        status: tx.status,
        reference: tx.verify_reference ?? tx.reference,
        amount: tx.verify_amount ?? tx.amount,
        currency: tx.verify_currency ?? tx.currency,
        paid_at: tx.paid_at,
      },
    });
  }

  if (req.method === "POST" && url.pathname === "/refund") {
    const body = JSON.parse((await readBody(req)) || "{}");
    const refund = { id: nextId++, transaction: body.transaction, amount: body.amount, status: "pending" };
    refunds.push(refund);
    return json(res, 200, { status: true, message: "Refund has been queued for processing", data: refund });
  }

  return json(res, 404, { status: false, message: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock paystack listening on ${PORT}`);
});
