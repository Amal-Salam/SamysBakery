import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MenuProductEditor } from "@/components/admin/menu/menu-product-editor";
import { MenuStatusBadge } from "@/components/admin/menu/menu-status-badge";
import { EmptyState } from "@/components/ui/states";
import { getAdminMenu } from "@/features/weekly-menu/queries";
import { formatWeekRange } from "@/lib/utils/dates";
import { uuidSchema } from "@/schemas/product";

export const metadata: Metadata = { title: "Weekly menu" };

// Read-only view of a previous (historical) menu.
export default async function MenuHistoryPage({ params }: PageProps<"/admin/menu/[id]">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const menu = await getAdminMenu(id);
  if (!menu) notFound();
  if (menu.status !== "EXPIRED") redirect("/admin/menu");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/menu" className="text-body-sm text-accent underline underline-offset-4">
          ← Current Weekly Menu
        </Link>
        <h1 className="text-heading-1 text-primary">{formatWeekRange(menu.weekStart, menu.weekEnd)}</h1>
        <MenuStatusBadge status={menu.status} />
        <p className="text-body-sm text-muted-foreground">
          Previous menus are kept for reference and can&apos;t be changed.
        </p>
      </div>
      {menu.products.length === 0 ? (
        <EmptyState title="This menu had no products." />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Products on this menu">
          {menu.products.map((product) => (
            <MenuProductEditor key={product.id} product={product} editable={false} />
          ))}
        </ul>
      )}
    </div>
  );
}
