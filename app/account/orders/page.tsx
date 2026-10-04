import type { Metadata } from "next";
import Link from "next/link";

import { LoafDrawing } from "@/components/brand/ornaments";
import { OrderList } from "@/components/account/order-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { listMyOrders } from "@/features/orders/customer";

export const metadata: Metadata = { title: "Your orders" };

export default async function MyOrdersPage() {
  const orders = await listMyOrders();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-heading-1 text-primary">Your orders</h1>
      {orders.length === 0 ? (
        <EmptyState
          illustration={<LoafDrawing className="size-16" />}
          title="You haven't placed any orders yet."
          action={
            <Button asChild>
              <Link href="/menu">View This Week&apos;s Menu</Link>
            </Button>
          }
        />
      ) : (
        <OrderList orders={orders} />
      )}
    </div>
  );
}
