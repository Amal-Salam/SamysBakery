import type { Metadata } from "next";
import Link from "next/link";

import { AutoRefresh } from "@/components/admin/dashboard/auto-refresh";
import { MenuStatusBadge } from "@/components/admin/menu/menu-status-badge";
import { TodayByStatus } from "@/components/admin/orders/today-by-status";
import { RevenueFigures } from "@/components/admin/revenue/revenue-figures";
import { Button } from "@/components/ui/button";
import { getAdminDashboard, type StockWarning } from "@/features/admin/dashboard";
import { formatNaira } from "@/features/weekly-menu/rules";
import { formatLongDate, formatWeekRange } from "@/lib/utils/dates";
import { isAdminViewer } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Dashboard" };

const QUICK_ACTIONS = [
  { href: "/admin/menu/new", label: "Create New Week" },
  { href: "/admin/menu", label: "Manage Current Menu" },
  { href: "/admin/orders", label: "View Orders" },
  { href: "/admin/products/new", label: "Add Product" },
];

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function StatTile({ label, value, href, note }: { label: string; value: number; href: string; note: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 hover:border-primary focus-visible:border-primary"
    >
      <span className="text-body-sm text-muted-foreground">{label}</span>
      <span className="font-heading text-heading-1 font-semibold text-primary">{value}</span>
      <span className="text-caption text-muted-foreground">{note}</span>
    </Link>
  );
}

function StockList({ id, title, items, empty, describe }: {
  id: string;
  title: string;
  items: StockWarning[];
  empty: string;
  describe: (item: StockWarning) => string;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <h3 id={id} className="text-heading-3 text-primary">
        {title} <span className="text-muted-foreground">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border text-body-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-2">
              <span className="font-medium">{item.name}</span>
              <span className="text-muted-foreground">{describe(item)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AdminDashboardPage() {
  if (!(await isAdminViewer())) return null;
  const dashboard = await getAdminDashboard();
  const activeToday = dashboard.todaysOrders.filter((order) => order.orderStatus !== "CANCELLED");
  const range = dashboard.revenueRange;

  return (
    <div className="flex flex-col gap-8">
      <AutoRefresh seconds={60} />
      <div className="flex flex-col gap-1">
        <h1 className="text-heading-1 text-primary">Dashboard</h1>
        <p className="text-body-sm text-muted-foreground">
          {formatLongDate(dashboard.today)} · updates every minute
        </p>
      </div>

      <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Button key={action.href} asChild variant="outline">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
      </nav>

      {dashboard.newOrders.length > 0 ? (
        <section
          aria-labelledby="new-orders-heading"
          className="flex flex-col gap-2 rounded-lg border-2 border-accent bg-accent/5 p-4"
        >
          <h2 id="new-orders-heading" className="text-heading-3 text-accent">
            {plural(dashboard.newOrderCount, "new paid order")} waiting to be received
          </h2>
          <p className="text-body-sm text-muted-foreground">Open an order and mark it Received to clear it from here.</p>
          <ul className="flex flex-wrap gap-2">
            {dashboard.newOrders.map((order) => (
              <li key={order.orderNumber}>
                <Link
                  href={`/admin/orders/${order.orderNumber}`}
                  className="inline-flex min-h-10 items-center rounded-md border border-border bg-surface px-3 text-body-sm font-medium text-accent underline underline-offset-4"
                >
                  {order.orderNumber} · {order.customerName} · {formatNaira(order.subtotal)}
                </Link>
              </li>
            ))}
          </ul>
          {dashboard.newOrderCount > dashboard.newOrders.length ? (
            <Link href="/admin/orders?status=PAID" className="text-body-sm text-accent underline underline-offset-4">
              See all {dashboard.newOrderCount} new orders
            </Link>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="operations-heading" className="flex flex-col gap-3">
        <h2 id="operations-heading" className="text-heading-2 text-primary">
          Operations
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Today's orders" value={activeToday.length} href="/admin/orders?view=today" note="For delivery today" />
          <StatTile label="Upcoming orders" value={dashboard.upcomingCount} href="/admin/orders?view=upcoming" note="For delivery after today" />
          <StatTile label="To prepare" value={dashboard.preparationCount} href="/admin/orders?view=preparing" note="Paid, received or baking" />
          <StatTile label="Ready for delivery" value={dashboard.readyCount} href="/admin/orders?view=ready" note="Waiting for the delivery partner" />
        </div>
      </section>

      <section aria-labelledby="business-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="business-heading" className="text-heading-2 text-primary">
            This week
          </h2>
          <p className="text-body-sm text-muted-foreground">
            Orders paid {range.from === range.to ? formatLongDate(range.to!) : formatWeekRange(range.from!, range.to!)} ·{" "}
            <Link href="/admin/revenue" className="text-accent underline underline-offset-4">
              Revenue details
            </Link>
          </p>
        </div>
        <RevenueFigures metrics={dashboard.revenue} />
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
            <span className="text-body-sm text-muted-foreground">Products sold</span>
            <span className="font-heading text-heading-1 font-semibold text-primary">{dashboard.revenue.productsSold}</span>
            <span className="text-caption text-muted-foreground">Units in paid orders, not cancelled</span>
          </div>
          <StockList
            id="low-stock-heading"
            title="Low stock"
            items={dashboard.lowStock}
            empty="No products are low on stock."
            describe={(item) => `${item.available} left (alert at ${item.threshold})`}
          />
          <StockList
            id="sold-out-heading"
            title="Sold out"
            items={dashboard.soldOut}
            empty="Nothing is sold out."
            describe={() => "0 left"}
          />
        </div>
      </section>

      <section aria-labelledby="menu-heading" className="flex flex-col gap-3">
        <h2 id="menu-heading" className="text-heading-2 text-primary">
          Current weekly menu
        </h2>
        {dashboard.menu ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-col gap-2">
              <p className="font-medium">{formatWeekRange(dashboard.menu.weekStart, dashboard.menu.weekEnd)}</p>
              <div className="flex items-center gap-2 text-body-sm text-muted-foreground">
                <MenuStatusBadge status={dashboard.menu.status} />
                {plural(dashboard.menu.productCount, "product")}
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/admin/menu">Manage menu</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
            <p className="text-body-sm text-muted-foreground">No current menu. Customers can&apos;t order until one is published.</p>
            <Button asChild>
              <Link href="/admin/menu/new">Create New Week</Link>
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="today-heading" className="flex flex-col gap-3">
        <h2 id="today-heading" className="text-heading-2 text-primary">
          Today&apos;s orders by status
        </h2>
        {dashboard.todaysOrders.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">No orders for delivery today.</p>
        ) : (
          <TodayByStatus orders={dashboard.todaysOrders} headingLevel="h3" />
        )}
      </section>
    </div>
  );
}
