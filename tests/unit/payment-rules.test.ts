import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { classifyVerification, isOurReference, toKobo } from "@/features/payments/rules";
import { isValidPaystackSignature } from "@/lib/paystack/webhook";

const SECRET = "sk_test_unit_secret";
const sign = (body: string, secret = SECRET) => createHmac("sha512", secret).update(body).digest("hex");

describe("isValidPaystackSignature (HMAC-SHA512 of the raw body)", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "SAMY-1" } });

  it("accepts Paystack's signature", () => {
    expect(isValidPaystackSignature(body, sign(body), SECRET)).toBe(true);
  });
  it("accepts an upper-case hex signature", () => {
    expect(isValidPaystackSignature(body, sign(body).toUpperCase(), SECRET)).toBe(true);
  });
  it("rejects a signature made with another secret", () => {
    expect(isValidPaystackSignature(body, sign(body, "sk_test_other"), SECRET)).toBe(false);
  });
  it("rejects when the body was altered (even by whitespace)", () => {
    expect(isValidPaystackSignature(`${body} `, sign(body), SECRET)).toBe(false);
  });
  it.each([null, "", "abc", "z".repeat(128), sign(body).slice(0, 64)])("rejects malformed signature %s", (signature) => {
    expect(isValidPaystackSignature(body, signature, SECRET)).toBe(false);
  });
});

describe("classifyVerification", () => {
  it("success only for status success and the expected reference", () => {
    expect(classifyVerification({ status: "success", reference: "R" }, "R")).toBe("SUCCESS");
    expect(classifyVerification({ status: "success", reference: "OTHER" }, "R")).toBe("REFERENCE_MISMATCH");
  });
  it.each(["failed", "abandoned", "reversed"])("%s is unsuccessful", (status) => {
    expect(classifyVerification({ status, reference: "R" }, "R")).toBe("UNSUCCESSFUL");
  });
  it.each(["pending", "ongoing", "processing", "queued", "something-new"])("%s is not final yet", (status) => {
    expect(classifyVerification({ status, reference: "R" }, "R")).toBe("PENDING");
  });
});

describe("toKobo", () => {
  it.each([
    [6500, 650000],
    [0.1, 10],
    [1234.56, 123456],
    [19.99, 1999],
  ])("₦%d → %d kobo", (naira, kobo) => {
    expect(toKobo(naira)).toBe(kobo);
  });
});

describe("isOurReference", () => {
  it("accepts references we issue", () => {
    expect(isOurReference(`SAMY-${"A1".repeat(16)}`)).toBe(true);
  });
  it.each(["", "SAMY-", "samy-" + "a".repeat(32), "T123456", null, 42, `SAMY-${"A".repeat(31)}`])(
    "rejects %s",
    (value) => {
      expect(isOurReference(value)).toBe(false);
    }
  );
});
