import { archiveProductAction } from "@/actions/admin/products";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { canArchive } from "@/features/products/rules";
import type { LibraryProduct } from "@/features/products/queries";

export function ArchiveProduct({ product }: { product: LibraryProduct }) {
  if (!canArchive(product.status)) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-body-sm text-muted-foreground" id="archive-blocked">
          This product is on the {product.status === "ON_CURRENT_MENU" ? "current" : "draft"} weekly
          menu. Remove it from that menu before deleting it.
        </p>
        <button
          type="button"
          disabled
          aria-describedby="archive-blocked"
          className="inline-flex h-10 w-fit cursor-not-allowed items-center rounded-md bg-destructive/10 px-4 text-button font-medium text-destructive opacity-50"
        >
          Delete product
        </button>
      </div>
    );
  }

  const hasHistory = product.status === "USED_PREVIOUSLY";

  return (
    <ConfirmActionDialog
      trigger="Delete product"
      title={`Delete “${product.name}”?`}
      description={
        <>
          {hasHistory ? (
            <p>
              <strong>This product has historical references.</strong> It has appeared on{" "}
              {product.timesOnMenu} past weekly {product.timesOnMenu === 1 ? "menu" : "menus"}.
              Deleting it removes it from the active Product Library, but historical menus and
              orders keep their own copies.
            </p>
          ) : (
            <p>It will be removed from the Product Library and can&apos;t be added to new menus.</p>
          )}
          <p>This action is recorded in the audit log.</p>
        </>
      }
      confirmLabel="Yes, delete product"
      pendingLabel="Deleting…"
      action={archiveProductAction}
      fields={{ id: product.id, confirm: "yes" }}
    />
  );
}
