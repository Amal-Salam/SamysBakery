import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrdersTable } from "@/components/admin/orders/orders-table";
import { EmptyState } from "@/components/ui/states";
import { getCustomer } from "@/features/customers/admin";

export const metadata: Metadata = { title: "Customer" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "long", year: "numeric" });

export default async function AdminCustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/admin/customers" className="text-body-sm text-accent underline underline-offset-4">
          ← Customers
        </Link>
        <h1 className="text-heading-1 text-primary">{customer.name || "(no name)"}</h1>
      </div>

      <dl className="grid max-w-xl gap-2 rounded-lg border border-border bg-surface p-4 text-body-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="break-all">{customer.email}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>{customer.phone ?? "Not given"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Customer since</dt>
          <dd>{dateFormat.format(new Date(customer.joinedAt))}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Orders</dt>
          <dd>{customer.orders.length}</dd>
        </div>
      </dl>

      <section aria-labelledby="orders-heading" className="flex flex-col gap-3">
        <h2 id="orders-heading" className="text-heading-2 text-primary">
          Order history
        </h2>
        {customer.orders.length === 0 ? (
          <EmptyState title="No orders yet." />
        ) : (
          <OrdersTable orders={customer.orders} caption={`Orders by ${customer.name}`} />
        )}
      </section>
    </div>
  );
}
