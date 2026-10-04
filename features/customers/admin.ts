import "server-only";

import type { AdminOrderSummary } from "@/features/orders/admin";
import { fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Admin customer lookup (API contract §28). Deliberately minimal — not a CRM.
// Email comes from Supabase Auth via admin-only database functions.

export type CustomerSummary = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  joinedAt: string;
  orderCount: number;
  lastOrderNumber: string | null;
  lastOrderAt: string | null;
};

export async function listCustomers(search: string | null): Promise<CustomerSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_list_customers", {
    search: search as string,
    max_rows: 100,
  });
  if (error) throw fromDbError(error);
  return data.map((row) => ({
    id: row.id,
    name: row.full_name,
    email: row.email,
    phone: row.phone,
    joinedAt: row.created_at,
    orderCount: row.order_count,
    lastOrderNumber: row.last_order_number,
    lastOrderAt: row.last_order_at,
  }));
}

export type CustomerDetail = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  joinedAt: string;
  orders: AdminOrderSummary[];
};

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_get_customer", { target_user_id: id });
  if (error) throw fromDbError(error);
  const customer = data[0];
  if (!customer) return null;

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("order_number, recipient_name, delivery_date, subtotal, payment_status, order_status, created_at")
    .eq("user_id", id)
    .order("created_at", { ascending: false });
  if (ordersError) throw fromDbError(ordersError);

  return {
    id: customer.id,
    name: customer.full_name,
    email: customer.email,
    phone: customer.phone,
    joinedAt: customer.created_at,
    orders: orders.map((row) => ({
      orderNumber: row.order_number,
      customerName: row.recipient_name,
      deliveryDate: row.delivery_date,
      subtotal: Number(row.subtotal),
      paymentStatus: row.payment_status,
      orderStatus: row.order_status,
      createdAt: row.created_at,
    })),
  };
}
