import { getMenuProduct } from "@/features/weekly-menu/storefront";
import { toApiProduct } from "@/lib/api/menu";
import { apiRoute } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// GET /api/v1/menu/:slug — one product on this week's published menu.
export const GET = apiRoute({ auth: "optional" }, async ({ params }) => {
  const slug = typeof params.slug === "string" ? params.slug : "";
  if (!SLUG.test(slug) || slug.length > 140) throw new AppError("VALIDATION_ERROR", "Invalid product.");
  const product = await getMenuProduct(slug);
  if (!product) throw new AppError("NOT_FOUND", "This product isn't on this week's menu.");
  return toApiProduct(product);
});
