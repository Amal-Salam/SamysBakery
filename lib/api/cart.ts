import "server-only";

import { getCart } from "@/features/cart/service";
import type { EvaluatedCart } from "@/features/cart/rules";
import { productImageUrl } from "@/lib/supabase/storage";

// Mobile representation of the server-evaluated cart: prices, availability
// issues and the subtotal always come from the server, never from the app.

export function toApiCart(cart: EvaluatedCart) {
  return {
    items: cart.items.map((item) => ({
      productId: item.productId,
      slug: item.slug,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      available: item.available,
      issue: item.issue,
      image: item.image ? { url: productImageUrl(item.image.path), alt: item.image.alt } : null,
    })),
    subtotal: cart.subtotal,
    itemCount: cart.itemCount,
    canCheckout: cart.canCheckout,
  };
}

export async function currentApiCart() {
  return toApiCart(await getCart());
}
