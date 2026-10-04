import type { Metadata } from "next";
import Link from "next/link";

import { AddStockForm } from "@/components/admin/inventory/add-stock-form";
import { MenuStatusBadge } from "@/components/admin/menu/menu-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMenuInventory, listInventoryAdjustments } from "@/features/inventory/admin";
import type { AvailabilityStatus } from "@/features/inventory/rules";
import { getCurrentAdminMenu } from "@/features/weekly-menu/queries";
import { formatWeekRange } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import { isAdminViewer } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Inventory" };

const STATUS_LABELS: Record<AvailabilityStatus, string> = {
  AVAILABLE: "Available",
  LOW_STOCK: "Low stock",
  SOLD_OUT: "Sold out",
};
const STATUS_STYLES: Record<AvailabilityStatus, string> = {
  AVAILABLE: "bg-success/10 text-success",
  LOW_STOCK: "bg-warning/10 text-warning",
  SOLD_OUT: "bg-primary text-primary-foreground",
};

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminInventoryPage() {
  if (!(await isAdminViewer())) return null;
  const menu = await getCurrentAdminMenu();
  if (!menu) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-heading-1 text-primary">Inventory</h1>
        <EmptyState
          title="No current menu."
          description="Inventory is tracked per weekly menu. Create a new week to get started."
          action={
            <Button asChild>
              <Link href="/admin/menu/new">Create New Week</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const [rows, adjustments] = await Promise.all([getMenuInventory(menu.id), listInventoryAdjustments(menu.id)]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-heading-1 text-primary">Inventory</h1>
        <div className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
          <span>{formatWeekRange(menu.weekStart, menu.weekEnd)}</span>
          <MenuStatusBadge status={menu.status} />
        </div>
        {menu.status === "DRAFT" ? (
          <p className="text-body-sm text-muted-foreground">This menu isn&apos;t published yet, so nothing is on sale.</p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="This menu has no products yet."
          action={
            <Button asChild variant="outline">
              <Link href="/admin/menu">Manage menu</Link>
            </Button>
          }
        />
      ) : (
        <>
          <section aria-labelledby="stock-heading" className="flex flex-col gap-3">
            <h2 id="stock-heading" className="text-heading-2 text-primary">
              Stock
            </h2>
            <p className="text-body-sm text-muted-foreground">
              Available = weekly capacity + added stock − units held for payment − units in confirmed orders.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Weekly capacity</TableHead>
                    <TableHead className="text-right">Added</TableHead>
                    <TableHead className="text-right">Held for payment</TableHead>
                    <TableHead className="text-right">In orders</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Low-stock alert</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{row.weeklyQuantity}</TableCell>
                      <TableCell className="text-right">{row.added}</TableCell>
                      <TableCell className="text-right">{row.reservedPending}</TableCell>
                      <TableCell className="text-right">{row.reservedConfirmed}</TableCell>
                      <TableCell className="text-right font-semibold">{row.available}</TableCell>
                      <TableCell className="text-right">{row.lowStockThreshold}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-caption font-semibold",
                            STATUS_STYLES[row.status]
                          )}
                        >
                          {STATUS_LABELS[row.status]}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section
            aria-labelledby="add-stock-heading"
            className="flex max-w-xl flex-col gap-3 rounded-lg border border-border bg-surface p-4"
          >
            <h2 id="add-stock-heading" className="text-heading-3 text-primary">
              Add stock
            </h2>
            <AddStockForm products={rows.map((row) => ({ id: row.id, name: row.name, available: row.available }))} />
          </section>
        </>
      )}

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="text-heading-2 text-primary">
          Stock history
        </h2>
        {adjustments.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">No stock has been added this week.</p>
        ) : (
          <ol className="flex flex-col gap-2 text-body-sm">
            {adjustments.map((entry) => (
              <li key={entry.id} className="rounded-md border border-border bg-surface px-3 py-2">
                <span className="text-muted-foreground">{timeFormat.format(new Date(entry.createdAt))}: </span>
                <strong>+{entry.quantity}</strong> {entry.productName} by {entry.adminName}
                <span className="block text-muted-foreground">Reason: {entry.reason}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
