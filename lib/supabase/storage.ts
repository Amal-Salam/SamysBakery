import { publicEnv } from "@/lib/env";

/** Public bucket for product photography (owner decision: public read, admin write). */
export const PRODUCT_IMAGES_BUCKET = "product-images";

/** Public URL for a stored product image path. Safe for client and server. */
export function productImageUrl(storagePath: string): string {
  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${encoded}`;
}
