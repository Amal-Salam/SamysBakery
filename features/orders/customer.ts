import "server-only";

import { fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { OrderStatus, PaymentStatus } from "./rules";

// Customer order history (API contract §19). Runs as the customer; RLS returns
// only their own orders, so another customer's order number simply isn't found.

export type MyOrderSummary = {
  orderNumber: string;
  placedAt: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  deliveryDate: string;
  items: { name: string; quantity: number }[];
};

export async function listMyOrders(limit?: number): Promise<MyOrderSummary[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("orders")
    .select("order_number, created_at, order_status, payment_status, subtotal, delivery_date, order_items ( product_name, quantity )")
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw fromDbError(error);
  return data.map((order) => ({
    orderNumber: order.order_number,
    placedAt: order.created_at,
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    subtotal: Number(order.subtotal),
    deliveryDate: order.delivery_date,
    items: order.order_items.map((item) => ({ name: item.product_name, quantity: item.quantity })),
  }));
}

export type MyOrderDetail = Omit<MyOrderSummary, "items"> & {
  items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  recipientName: string;
  phone: string;
  address: string;
  additionalInfo: string | null;
  specialNotes: string | null;
};

export async function getMyOrder(orderNumber: string): Promise<MyOrderDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `order_number, created_at, order_status, payment_status, subtotal, delivery_date, recipient_name, phone,
       delivery_address, delivery_city, delivery_state, delivery_additional_info, special_notes,
       order_items ( product_name, quantity, unit_price, line_total, created_at )`
    )
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!order) return null;
  return {
    orderNumber: order.order_number,
    placedAt: order.created_at,
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    subtotal: Number(order.subtotal),
    deliveryDate: order.delivery_date,
    recipientName: order.recipient_name,
    phone: order.phone,
    address: [order.delivery_address, order.delivery_city, order.delivery_state].join(", "),
    additionalInfo: order.delivery_additional_info,
    specialNotes: order.special_notes,
    items: [...order.order_items]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((item) => ({
        name: item.product_name,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.line_total),
      })),
  };
}
