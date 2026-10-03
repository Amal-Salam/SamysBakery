import type { z } from "zod";

import type { ActionError, ActionResult, ErrorCode } from "@/types/api";

/** An expected failure whose message is safe to show to the user. */
export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail(
  code: ErrorCode,
  message: string,
  fieldErrors?: ActionError["fieldErrors"]
): ActionResult<never> {
  return {
    success: false,
    error: fieldErrors ? { code, message, fieldErrors } : { code, message },
  };
}

export function validationFailure(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail("VALIDATION_ERROR", "Please check the highlighted fields.", fieldErrors);
}

/**
 * Converts any thrown value into a safe result. Unexpected errors are logged
 * server-side and never expose internals (SQL, stack traces, provider data).
 */
export function toFailure(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return fail(error.code, error.message);
  }
  console.error("[unexpected]", error instanceof Error ? error.name : typeof error);
  return fail("INTERNAL_ERROR", GENERIC_MESSAGE);
}
