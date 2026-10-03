import { z } from "zod";

// Deliberately simple Nigerian address (Database.md §3). No delivery-area
// restriction (owner decision): city and state are free text.

const text = (label: string, max: number) =>
  z.string().trim().min(1, `Enter the ${label}.`).max(max, `The ${label} is too long.`);

export const addressInputSchema = z.object({
  label: z.string().trim().max(50, "Label is too long.").transform((value) => value || "Home"),
  recipientName: text("recipient's name", 120),
  phone: z
    .string()
    .trim()
    .min(1, "Enter a phone number for delivery.")
    .max(30, "Phone number is too long.")
    .regex(/^\+?[0-9][0-9\s-]{6,}$/, "Enter a valid phone number, e.g. 0803 123 4567."),
  addressLine: text("street address", 300),
  city: text("city", 100),
  state: text("state", 100),
  additionalInfo: z
    .string()
    .trim()
    .max(500, "Additional details are too long.")
    .transform((value) => value || null),
});

export type AddressInput = z.infer<typeof addressInputSchema>;
