import { describe, expect, it } from "vitest";

import {
  passwordResetRequestSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/schemas/auth";

describe("signUpSchema", () => {
  const valid = { fullName: "Ada Obi", email: "Ada@Example.com ", password: "correct-horse" };

  it("accepts valid input and normalises email", () => {
    const result = signUpSchema.parse(valid);
    expect(result.email).toBe("ada@example.com");
  });

  it("rejects a missing name", () => {
    expect(signUpSchema.safeParse({ ...valid, fullName: "  " }).success).toBe(false);
  });

  it("rejects an overlong name", () => {
    expect(signUpSchema.safeParse({ ...valid, fullName: "a".repeat(121) }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(signUpSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("enforces password length 8–72", () => {
    expect(signUpSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, password: "a".repeat(73) }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, password: "a".repeat(72) }).success).toBe(true);
  });
});

describe("signInSchema", () => {
  it("requires email and password", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});

describe("passwordResetRequestSchema", () => {
  it("requires a valid email", () => {
    expect(passwordResetRequestSchema.safeParse({ email: "x" }).success).toBe(false);
    expect(passwordResetRequestSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
  });
});

describe("updatePasswordSchema", () => {
  it("requires matching passwords", () => {
    const result = updatePasswordSchema.safeParse({
      password: "new-password-1",
      confirmPassword: "new-password-2",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("accepts matching passwords", () => {
    expect(
      updatePasswordSchema.safeParse({ password: "new-password-1", confirmPassword: "new-password-1" })
        .success
    ).toBe(true);
  });
});
