import { z } from "zod";

import { addressInputSchema } from "@/schemas/address";

export const SPECIAL_NOTES_MAX = 500;

/** prepareCheckout input (API contract §10): deliveryDate, addressId | newAddress, specialNotes?. */
export const prepareCheckoutSchema = z
  .object({
    deliveryDate: z.iso.date("Choose a delivery date."),
    addressId: z.uuid().optional(),
    newAddress: addressInputSchema.optional(),
    specialNotes: z
      .string()
      .trim()
      .max(SPECIAL_NOTES_MAX, `Special notes can be at most ${SPECIAL_NOTES_MAX} characters.`)
      .transform((value) => value || null),
  })
  .refine((input) => Boolean(input.addressId) !== Boolean(input.newAddress), {
    message: "Choose a saved address or enter a new one.",
    path: ["address"],
  });

export type PrepareCheckoutInput = z.infer<typeof prepareCheckoutSchema>;
