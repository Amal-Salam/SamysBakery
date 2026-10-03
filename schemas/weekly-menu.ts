import { z } from "zod";

import { parseNaira } from "@/features/weekly-menu/rules";
import { uuidSchema } from "@/schemas/product";

const MAX_PRICE = 10_000_000;
const MAX_QUANTITY = 10_000;

const priceField = z
  .string()
  .trim()
  .min(1, "Enter a price.")
  .transform((value, ctx) => {
    const amount = parseNaira(value);
    if (amount === null) {
      ctx.addIssue({ code: "custom", message: "Enter a price in naira, e.g. 6500." });
      return z.NEVER;
    }
    return amount;
  })
  .pipe(
    z
      .number()
      .positive("Price must be more than ₦0.")
      .max(MAX_PRICE, "Price is too high.")
  );

const quantityField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}.`)
    .regex(/^\d+$/, `Enter the ${label} as a whole number.`)
    .transform(Number)
    .pipe(z.number().int().min(0).max(MAX_QUANTITY, `The ${label} is too high.`));

export const addMenuProductSchema = z.object({
  menuId: uuidSchema,
  productId: z.uuid("Choose a product."),
  price: priceField,
  weeklyQuantity: quantityField("weekly quantity"),
  lowStockThreshold: quantityField("low-stock threshold"),
});

export const updateMenuProductSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1, "Enter a name.").max(120, "Name is too long."),
  price: priceField,
  weeklyQuantity: quantityField("weekly quantity"),
  lowStockThreshold: quantityField("low-stock threshold"),
  description: z.string().trim().max(2000, "Description is too long.").default(""),
  ingredients: z.string().trim().max(2000, "Ingredients are too long.").default(""),
  // "" = no photo; otherwise must be one of the product's library photos (checked server-side).
  imageSnapshot: z.string().trim().max(500).default(""),
});

export type AddMenuProductInput = z.infer<typeof addMenuProductSchema>;
export type UpdateMenuProductInput = z.infer<typeof updateMenuProductSchema>;
