import { getMyOrder } from "@/features/orders/customer";
import { isCancellable } from "@/features/orders/rules";
import { cancelOrder } from "@/features/payments/refunds";
import { apiRoute } from "@/lib/api/handler";
import { orderNumberFrom } from "@/lib/api/orders";
import { AppError } from "@/lib/errors";

// POST /api/v1/orders/:orderNumber/cancel — cancel an eligible order (before
// READY). The database checks ownership and status, releases the reserved
// stock and audits it; no refund is made automatically.
export const POST = apiRoute({ auth: "required" }, async ({ params }) => {
  const orderNumber = orderNumberFrom(params);
  await cancelOrder(orderNumber, null);
  const order = await getMyOrder(orderNumber);
  if (!order) throw new AppError("NOT_FOUND", "That order could not be found.");
  return { ...order, canCancel: isCancellable(order.orderStatus) };
});
