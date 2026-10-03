import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { mapAuthError } from "@/features/auth/errors";
import { AppError, toFailure, validationFailure } from "@/lib/errors";
import { ERROR_CODES } from "@/types/api";

describe("mapAuthError", () => {
  it.each([
    ["invalid_credentials", "UNAUTHENTICATED"],
    ["email_not_confirmed", "UNAUTHENTICATED"],
    ["weak_password", "VALIDATION_ERROR"],
    ["user_banned", "FORBIDDEN"],
    ["over_request_rate_limit", "INTERNAL_ERROR"],
    ["something_new", "INTERNAL_ERROR"],
  ])("maps %s → %s", (code, expected) => {
    expect(mapAuthError({ code }).code).toBe(expected);
  });

  it("only ever returns approved error codes", () => {
    for (const code of ["invalid_credentials", "weak_password", "x", undefined]) {
      expect(ERROR_CODES).toContain(mapAuthError({ code }).code);
    }
  });

  it("does not distinguish unknown users from wrong passwords", () => {
    expect(mapAuthError({ code: "invalid_credentials" }).message).toBe(
      "Incorrect email or password."
    );
  });
});

describe("toFailure", () => {
  it("passes through AppError code and message", () => {
    expect(toFailure(new AppError("FORBIDDEN", "No."))).toEqual({
      success: false,
      error: { code: "FORBIDDEN", message: "No." },
    });
  });

  it("hides unexpected error details", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = toFailure(new Error('relation "profiles" does not exist'));
    spy.mockRestore();

    expect(result).toEqual({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
    });
  });
});

describe("validationFailure", () => {
  it("groups issues by field", () => {
    const parsed = z.object({ email: z.email() }).safeParse({ email: "x" });
    if (parsed.success) throw new Error("expected failure");

    const result = validationFailure(parsed.error);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.fieldErrors?.email?.length).toBe(1);
    }
  });
});
