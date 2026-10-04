import { z } from "zod";

import { uuidSchema } from "@/schemas/product";

// Admin stock increase (API contract §26 addInventory): positive only, with a reason.
export const addInventorySchema = z.object({
  weeklyMenuProductId: uuidSchema,
  quantity: z.coerce
    .number("Enter a quantity.")
    .int("Enter a whole number.")
    .min(1, "Enter a quantity of at least 1.")
    .max(10_000, "That's more than 10,000 — please check the quantity."),
  reason: z.string().trim().min(1, "Enter a reason for the stock increase.").max(500, "The reason is too long (500 characters at most)."),
});
