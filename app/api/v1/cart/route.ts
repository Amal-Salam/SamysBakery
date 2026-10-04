import { clearCart } from "@/features/cart/service";
import { currentApiCart } from "@/lib/api/cart";
import { apiRoute } from "@/lib/api/handler";

// GET /api/v1/cart — the signed-in customer's cart, evaluated by the server.
export const GET = apiRoute({ auth: "required" }, async () => currentApiCart());

// DELETE /api/v1/cart — clear the cart.
export const DELETE = apiRoute({ auth: "required" }, async () => {
  await clearCart();
  return currentApiCart();
});
