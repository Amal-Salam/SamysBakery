import { z } from "zod";

import { MAX_LINE_QUANTITY } from "@/features/cart/rules";

export const cartLineSchema = z.object({
  productId: z.uuid("Invalid product."),
  quantity: z.coerce
    .number("Enter a quantity.")
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(MAX_LINE_QUANTITY, "That quantity is too large."),
});

export const cartProductSchema = z.object({ productId: z.uuid("Invalid product.") });
