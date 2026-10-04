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
