import { z } from "zod";

// Customers may change only their name and (optional) phone (API contract §9).
export const profileInputSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120, "Name is too long."),
  phone: z
    .string()
    .trim()
    .max(30, "Phone number is too long.")
    .refine((value) => value === "" || /^\+?[0-9][0-9\s-]{6,}$/.test(value), "Enter a valid phone number, e.g. 0803 123 4567.")
    .transform((value) => value || null),
});

export const DELETE_CONFIRMATION_PHRASE = "DELETE";
