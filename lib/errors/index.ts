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

type DbErrorLike = { code?: string | null; message?: string | null } | null | undefined;

/**
 * Maps a PostgREST/Postgres error to an AppError with a safe message.
 * `messages` overrides the user-facing text per SQLSTATE or raised message key.
 */
export function fromDbError(
  error: DbErrorLike,
  messages: Partial<Record<string, string>> = {}
): AppError {
  const key = error?.message && messages[error.message] ? error.message : (error?.code ?? "");
  const message = messages[key];
  switch (error?.code) {
    case "42501":
      return new AppError("FORBIDDEN", message ?? "You do not have permission to do that.");
    case "23505":
      return new AppError("CONFLICT", message ?? "That conflicts with an existing record.");
    case "23503":
      return new AppError("CONFLICT", message ?? "That record is still in use.");
    case "23514":
    case "22001":
      return new AppError("VALIDATION_ERROR", message ?? "Some of the details are not valid.");
    case "P0002":
    case "PGRST116":
      return new AppError("NOT_FOUND", message ?? "That record could not be found.");
    case "P0001":
      return new AppError("CONFLICT", message ?? "That action is not allowed right now.");
    default:
      console.error("[db]", error?.code ?? "unknown");
      return new AppError("INTERNAL_ERROR", GENERIC_MESSAGE);
  }
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
