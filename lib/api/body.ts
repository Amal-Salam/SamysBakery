import "server-only";

import type { z } from "zod";

import { AppError } from "@/lib/errors";

const MAX_BODY_BYTES = 16 * 1024;

/** Reads a small JSON body and validates it; anything else is a VALIDATION_ERROR. */
export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) throw new AppError("VALIDATION_ERROR", "Request is too large.");
  let value: unknown;
  try {
    value = raw ? JSON.parse(raw) : {};
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be JSON.");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid request.");
  return parsed.data;
}
