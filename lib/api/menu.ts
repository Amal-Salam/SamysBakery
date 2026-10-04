import "server-only";

import type { StorefrontMenu, StorefrontProduct } from "@/features/weekly-menu/storefront";
import { productImageUrl } from "@/lib/supabase/storage";

// Mobile representation of storefront data: same fields the website renders,
// with absolute image URLs (the app has no Next.js image route).

export function toApiProduct(product: StorefrontProduct) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    ingredients: product.ingredients,
    price: product.price,
    image: product.image ? { url: productImageUrl(product.image.path), alt: product.image.alt } : null,
    category: product.category?.name ?? null,
    availableQuantity: product.availableQuantity,
    availabilityStatus: product.availabilityStatus,
  };
}

export function toApiMenu(menu: StorefrontMenu | null) {
  if (!menu) return null;
  return { weekStart: menu.weekStart, weekEnd: menu.weekEnd, products: menu.products.map(toApiProduct) };
}
