import { z } from "zod";

import { removeCartItem, updateCartItem } from "@/features/cart/service";
import { readJson } from "@/lib/api/body";
import { currentApiCart } from "@/lib/api/cart";
import { apiRoute } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { cartLineSchema } from "@/schemas/cart";

const productIdSchema = z.uuid();
const quantitySchema = cartLineSchema.pick({ quantity: true });

function productIdFrom(params: Record<string, string | string[] | undefined>) {
  const parsed = productIdSchema.safeParse(params.productId);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid product.");
  return parsed.data;
}

// PATCH /api/v1/cart/items/:productId { quantity } — set the quantity.
export const PATCH = apiRoute({ auth: "required" }, async ({ request, params }) => {
  const productId = productIdFrom(params);
  const { quantity } = await readJson(request, quantitySchema);
  await updateCartItem(productId, quantity);
  return currentApiCart();
});

// DELETE /api/v1/cart/items/:productId — remove the line.
export const DELETE = apiRoute({ auth: "required" }, async ({ params }) => {
  await removeCartItem(productIdFrom(params));
  return currentApiCart();
});
