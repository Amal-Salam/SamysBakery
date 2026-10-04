import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityList } from "@/components/admin/audit/activity-list";
import { ArchiveProduct } from "@/components/admin/products/archive-product";
import { LibraryStatusBadge } from "@/components/admin/products/library-status-badge";
import { ProductForm } from "@/components/admin/products/product-form";
import { ProductImages } from "@/components/admin/products/product-images";
import { getEntityActivity } from "@/features/admin/audit";
import { getLibraryProduct, listCategories } from "@/features/products/queries";
import { uuidSchema } from "@/schemas/product";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
  searchParams,
}: PageProps<"/admin/products/[id]">) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  if (!uuidSchema.safeParse(id).success) notFound();

  const [product, categories] = await Promise.all([getLibraryProduct(id), listCategories()]);
  if (!product) notFound();
  const activity = await getEntityActivity([{ type: "product", ids: [product.id] }]);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Link href="/admin/products" className="text-body-sm text-accent underline underline-offset-4">
          ← Product Library
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-heading-1 text-primary">{product.name}</h1>
          <LibraryStatusBadge status={product.status} />
        </div>
        {created === "1" ? (
          <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-body-sm text-success">
            Product created. Add photos below.
          </p>
        ) : null}
      </div>

      <section aria-labelledby="details-heading" className="flex flex-col gap-4">
        <h2 id="details-heading" className="text-heading-2 text-primary">
          Details
        </h2>
        <ProductForm mode="edit" categories={categories} product={product} />
      </section>

      <section aria-labelledby="photos-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="photos-heading" className="text-heading-2 text-primary">
            Photos
          </h2>
          <p className="text-body-sm text-muted-foreground">
            The first photo is the main photo.
          </p>
        </div>
        <ProductImages productId={product.id} productName={product.name} images={product.images} />
      </section>

      <section aria-labelledby="product-history-heading" className="flex flex-col gap-3">
        <h2 id="product-history-heading" className="text-heading-2 text-primary">
          History
        </h2>
        <ActivityList entries={activity} empty="No changes recorded yet." />
      </section>

      <section
        aria-labelledby="danger-heading"
        className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4"
      >
        <h2 id="danger-heading" className="text-heading-3 text-destructive">
          Delete product
        </h2>
        <ArchiveProduct product={product} />
      </section>
    </div>
  );
}
