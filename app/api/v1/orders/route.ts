import { listMyOrders } from "@/features/orders/customer";
import { apiRoute } from "@/lib/api/handler";

// GET /api/v1/orders — the customer's own orders, newest first (RLS).
export const GET = apiRoute({ auth: "required" }, async () => listMyOrders(50));
