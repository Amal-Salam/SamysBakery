import { describe, expect, it } from "vitest";

import { hasErrors, validateAddress, validateProfile } from "./validation";

describe("validateProfile (mirrors the website)", () => {
  it("accepts a name with an optional phone", () => {
    expect(validateProfile({ fullName: "Ada Obi", phone: "" })).toEqual({});
    expect(validateProfile({ fullName: "Ada Obi", phone: "+234 803 123 4567" })).toEqual({});
  });
  it("rejects a missing name, long name or bad phone", () => {
    expect(validateProfile({ fullName: "  ", phone: "" }).fullName).toBe("Enter your name.");
    expect(validateProfile({ fullName: "x".repeat(121), phone: "" }).fullName).toBe("Name is too long.");
    expect(validateProfile({ fullName: "Ada", phone: "call me" }).phone).toBe("Enter a valid phone number, e.g. 0803 123 4567.");
  });
});

describe("validateAddress (mirrors the website)", () => {
  const good = { label: "", recipientName: "Ada Obi", phone: "0803 123 4567", addressLine: "12 Aminu Kano Crescent", city: "Abuja", state: "FCT", additionalInfo: "" };

  it("accepts a complete address (label optional)", () => {
    expect(hasErrors(validateAddress(good))).toBe(false);
  });

  it("names every missing or invalid field", () => {
    const errors = validateAddress({ ...good, recipientName: "", phone: "", addressLine: " ", city: "", state: "" });
    expect(errors).toEqual({
      recipientName: "Enter the recipient's name.",
      phone: "Enter a phone number for delivery.",
      addressLine: "Enter the street address.",
      city: "Enter the city.",
      state: "Enter the state.",
    });
    expect(validateAddress({ ...good, phone: "abc" }).phone).toBe("Enter a valid phone number, e.g. 0803 123 4567.");
    expect(validateAddress({ ...good, label: "x".repeat(51) }).label).toBe("Label is too long.");
    expect(validateAddress({ ...good, additionalInfo: "x".repeat(501) }).additionalInfo).toBe("Additional details are too long.");
  });
});

describe("sign-up and reset checks (mirror the website)", () => {
  it("validates registration fields", async () => {
    const { validateRegistration } = await import("./validation");
    expect(validateRegistration({ fullName: "Ada", email: "ada@example.com", password: "long-enough" })).toEqual({});
    expect(validateRegistration({ fullName: " ", email: "nope", password: "short" })).toEqual({
      fullName: "Enter your name.",
      email: "Enter a valid email address.",
      password: "Use at least 8 characters.",
    });
    expect(validateRegistration({ fullName: "Ada", email: "", password: "x".repeat(73) })).toEqual({
      email: "Enter your email address.",
      password: "Use at most 72 characters.",
    });
  });

  it("validates codes and new passwords", async () => {
    const { validateCode, validateResetPassword } = await import("./validation");
    expect(validateCode("123456")).toBeUndefined();
    expect(validateCode(" 123456 ")).toBeUndefined();
    for (const bad of ["12345", "1234567", "abcdef", ""]) expect(validateCode(bad)).toBe("Enter the 6-digit code from the email.");
    expect(validateResetPassword({ code: "123456", password: "new-password", confirmPassword: "new-password" })).toEqual({});
    expect(validateResetPassword({ code: "1", password: "new-password", confirmPassword: "different" })).toEqual({
      code: "Enter the 6-digit code from the email.",
      confirmPassword: "Passwords do not match.",
    });
  });
});
