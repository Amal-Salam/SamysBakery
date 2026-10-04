import { addToCart } from "@/features/cart/service";
import { readJson } from "@/lib/api/body";
import { currentApiCart } from "@/lib/api/cart";
import { apiRoute } from "@/lib/api/handler";
import { cartLineSchema } from "@/schemas/cart";

// POST /api/v1/cart/items { productId, quantity } — add (same product combines),
// with the same stock and menu checks as the website. Returns the updated cart.
export const POST = apiRoute({ auth: "required" }, async ({ request }) => {
  const { productId, quantity } = await readJson(request, cartLineSchema);
  await addToCart(productId, quantity);
  return currentApiCart();
});
