import type { Metadata } from "next";
import Link from "next/link";

import { publishMenuAction, unpublishMenuAction } from "@/actions/admin/menu";
import { ActivityList } from "@/components/admin/audit/activity-list";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { AddMenuProductForm } from "@/components/admin/menu/add-menu-product-form";
import { MenuProductEditor } from "@/components/admin/menu/menu-product-editor";
import { MenuStatusBadge } from "@/components/admin/menu/menu-status-badge";
import { OrderCutoffForm } from "@/components/admin/menu/order-cutoff-form";
import { ReservationTimeoutForm } from "@/components/admin/menu/reservation-timeout-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import {
  getCurrentAdminMenu,
  getMenuActivity,
  listAddableProducts,
  listMenuHistory,
} from "@/features/weekly-menu/queries";
import { getOrderCutoff, getReservationTimeout } from "@/features/weekly-menu/service";
import { formatWeekRange } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Current Weekly Menu" };

export default async function CurrentMenuPage({ searchParams }: PageProps<"/admin/menu">) {
  const [{ created }, menu, history, cutoff] = await Promise.all([
    searchParams,
    getCurrentAdminMenu(),
    listMenuHistory(),
    getOrderCutoff(),
  ]);
  const holdMinutes = await getReservationTimeout();
  const [addable, activity] = menu
    ? await Promise.all([listAddableProducts(menu.id), getMenuActivity(menu)])
    : [[], []];

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading-1 text-primary">Current Weekly Menu</h1>
        <p className="text-body-sm text-muted-foreground">
          Menus run Tuesday to Saturday (Abuja time) and expire automatically after Saturday.
        </p>
      </div>

      {created === "1" ? (
        <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-body-sm text-success">
          New week created. It starts empty — add products from the Product Library.
        </p>
      ) : null}

      {!menu ? (
        <EmptyState
          title="No current menu."
          description="Create a new week to start building the next menu."
          action={
            <Button asChild>
              <Link href="/admin/menu/new">Create New Week</Link>
            </Button>
          }
        />
      ) : (
        <>
          <section aria-labelledby="menu-heading" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-col gap-2">
                <h2 id="menu-heading" className="text-heading-2 text-primary">
                  {formatWeekRange(menu.weekStart, menu.weekEnd)}
                </h2>
                <MenuStatusBadge status={menu.status} />
              </div>
              {menu.status === "DRAFT" ? (
                <ConfirmActionDialog
                  trigger="Publish menu"
                  triggerVariant="default"
                  confirmVariant="default"
                  title="Publish this menu?"
                  description={
                    <p>
                      Customers will be able to see and order the {menu.products.length}{" "}
                      {menu.products.length === 1 ? "product" : "products"} on this menu.
                    </p>
                  }
                  confirmLabel="Publish menu"
                  pendingLabel="Publishing…"
                  action={publishMenuAction}
                  fields={{ menuId: menu.id, confirm: "yes" }}
                />
              ) : menu.hasOrders ? (
                <p className="max-w-xs text-body-sm text-muted-foreground">
                  This menu has orders, so it can&apos;t be unpublished.
                </p>
              ) : (
                <ConfirmActionDialog
                  trigger="Unpublish"
                  triggerVariant="outline"
                  title="Unpublish this menu?"
                  description={
                    <p>Customers will no longer see it. It returns to draft so you can edit and republish it.</p>
                  }
                  confirmLabel="Unpublish menu"
                  pendingLabel="Unpublishing…"
                  action={unpublishMenuAction}
                  fields={{ menuId: menu.id, confirm: "yes" }}
                />
              )}
            </div>

            {menu.products.length === 0 ? (
              <EmptyState
                title="This menu is empty."
                description="Add products from the Product Library below. A menu needs at least one product before it can be published."
              />
            ) : (
              <ul className="flex flex-col gap-3" aria-label="Products on this menu">
                {menu.products.map((product) => (
                  <MenuProductEditor key={product.id} product={product} editable />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="add-heading" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
            <h2 id="add-heading" className="text-heading-3 text-primary">
              Add from Product Library
            </h2>
            <AddMenuProductForm menuId={menu.id} products={addable} />
          </section>
        </>
      )}

      {menu ? (
        <section aria-labelledby="menu-activity-heading" className="flex flex-col gap-3">
          <h2 id="menu-activity-heading" className="text-heading-2 text-primary">
            Menu activity
          </h2>
          <ActivityList entries={activity} empty="No activity recorded for this menu yet." />
        </section>
      ) : null}

      <section aria-labelledby="cutoff-heading" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 id="cutoff-heading" className="text-heading-3 text-primary">
          Ordering settings
        </h2>
        <OrderCutoffForm cutoff={cutoff} />
        <ReservationTimeoutForm minutes={holdMinutes} />
      </section>

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="text-heading-2 text-primary">
          Previous menus
        </h2>
        {history.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">No previous menus yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {history.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/admin/menu/${entry.id}`}
                  className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-2 hover:bg-muted"
                >
                  <span className="font-medium">{formatWeekRange(entry.weekStart, entry.weekEnd)}</span>
                  <span className="text-body-sm text-muted-foreground">
                    {entry.productCount} {entry.productCount === 1 ? "product" : "products"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
