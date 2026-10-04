import { getMyOrder } from "@/features/orders/customer";
import { isCancellable } from "@/features/orders/rules";
import { apiRoute } from "@/lib/api/handler";
import { orderNumberFrom } from "@/lib/api/orders";
import { AppError } from "@/lib/errors";

// GET /api/v1/orders/:orderNumber — one of the customer's own orders. Another
// customer's order number is simply not found (RLS).
export const GET = apiRoute({ auth: "required" }, async ({ params }) => {
  const order = await getMyOrder(orderNumberFrom(params));
  if (!order) throw new AppError("NOT_FOUND", "That order could not be found.");
  return { ...order, canCancel: isCancellable(order.orderStatus) };
});
