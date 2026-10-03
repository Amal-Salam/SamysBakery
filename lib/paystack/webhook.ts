import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validates Paystack's `x-paystack-signature`: HMAC-SHA512 of the RAW request
 * body using the secret key, compared in constant time. Pure for unit tests.
 */
export function isValidPaystackSignature(rawBody: string, signature: string | null, secretKey: string): boolean {
  if (!signature || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody, "utf8").digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
