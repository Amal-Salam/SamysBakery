// Field checks mirroring the website's schemas (schemas/profile.ts,
// schemas/address.ts) so errors show next to each field. The server
// re-validates everything; these are for a friendly form only. Unit tested.

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const PHONE = /^\+?[0-9][0-9\s-]{6,}$/;

export type ProfileInput = { fullName: string; phone: string };

export function validateProfile(input: ProfileInput): FieldErrors<keyof ProfileInput> {
  const errors: FieldErrors<keyof ProfileInput> = {};
  const name = input.fullName.trim();
  const phone = input.phone.trim();
  if (!name) errors.fullName = "Enter your name.";
  else if (name.length > 120) errors.fullName = "Name is too long.";
  if (phone.length > 30) errors.phone = "Phone number is too long.";
  else if (phone && !PHONE.test(phone)) errors.phone = "Enter a valid phone number, e.g. 0803 123 4567.";
  return errors;
}

export type AddressInput = {
  label: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  additionalInfo: string;
};

const required = (value: string, label: string, max: number) => {
  const v = value.trim();
  if (!v) return `Enter the ${label}.`;
  if (v.length > max) return `The ${label} is too long.`;
  return undefined;
};

export function validateAddress(input: AddressInput): FieldErrors<keyof AddressInput> {
  const errors: FieldErrors<keyof AddressInput> = {};
  if (input.label.trim().length > 50) errors.label = "Label is too long.";
  const recipient = required(input.recipientName, "recipient's name", 120);
  if (recipient) errors.recipientName = recipient;
  const phone = input.phone.trim();
  if (!phone) errors.phone = "Enter a phone number for delivery.";
  else if (phone.length > 30) errors.phone = "Phone number is too long.";
  else if (!PHONE.test(phone)) errors.phone = "Enter a valid phone number, e.g. 0803 123 4567.";
  const line = required(input.addressLine, "street address", 300);
  if (line) errors.addressLine = line;
  const city = required(input.city, "city", 100);
  if (city) errors.city = city;
  const state = required(input.state, "state", 100);
  if (state) errors.state = state;
  if (input.additionalInfo.trim().length > 500) errors.additionalInfo = "Additional details are too long.";
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some(Boolean);
}

// ---- Sign-up, verification and password reset (mirrors schemas/auth.ts) ----

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return "Enter your email address.";
  if (value.length > 254) return "Email address is too long.";
  if (!EMAIL.test(value)) return "Enter a valid email address.";
  return undefined;
}

/** Supabase/bcrypt only use the first 72 bytes of a password. */
export function validateNewPassword(password: string): string | undefined {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 72) return "Use at most 72 characters.";
  return undefined;
}

export type RegistrationInput = { fullName: string; email: string; password: string };

export function validateRegistration(input: RegistrationInput): FieldErrors<keyof RegistrationInput> {
  const errors: FieldErrors<keyof RegistrationInput> = {};
  const name = input.fullName.trim();
  if (!name) errors.fullName = "Enter your name.";
  else if (name.length > 120) errors.fullName = "Name is too long.";
  const email = validateEmail(input.email);
  if (email) errors.email = email;
  const password = validateNewPassword(input.password);
  if (password) errors.password = password;
  return errors;
}

export type NewPasswordInput = { code: string; password: string; confirmPassword: string };

export function validateCode(code: string): string | undefined {
  return /^\d{6}$/.test(code.trim()) ? undefined : "Enter the 6-digit code from the email.";
}

export function validateResetPassword(input: NewPasswordInput): FieldErrors<keyof NewPasswordInput> {
  const errors: FieldErrors<keyof NewPasswordInput> = {};
  const code = validateCode(input.code);
  if (code) errors.code = code;
  const password = validateNewPassword(input.password);
  if (password) errors.password = password;
  else if (input.password !== input.confirmPassword) errors.confirmPassword = "Passwords do not match.";
  return errors;
}
