import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CategoryManager } from "@/components/admin/products/category-manager";
import { LibraryStatusBadge } from "@/components/admin/products/library-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCategories, listLibraryProducts } from "@/features/products/queries";
import { productImageUrl } from "@/lib/supabase/storage";
import { isAdminViewer } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Product Library" };

export default async function ProductLibraryPage({
  searchParams,
}: PageProps<"/admin/products">) {
  if (!(await isAdminViewer())) return null;
  const [{ deleted }, products, categories] = await Promise.all([
    searchParams,
    listLibraryProducts(),
    listCategories(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-heading-1 text-primary">Product Library</h1>
          <p className="text-body-sm text-muted-foreground">
            Permanent catalogue products. Add them to a weekly menu to sell them.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">Add product</Link>
        </Button>
      </div>

      {deleted === "1" ? (
        <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-body-sm text-success">
          Product deleted. Past menus and orders keep their copies.
        </p>
      ) : null}

      <section aria-labelledby="products-heading" className="flex flex-col gap-4">
        <h2 id="products-heading" className="sr-only">
          Products
        </h2>
        {products.length === 0 ? (
          <EmptyState
            title="No products yet."
            description="Create your first Product Library product to start building weekly menus."
            action={
              <Button asChild>
                <Link href="/admin/products/new">Add product</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">
                    <span className="sr-only">Photo</span>
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const photo = product.images[0];
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        {photo ? (
                          <Image
                            src={productImageUrl(photo.storagePath)}
                            alt={photo.altText}
                            width={56}
                            height={56}
                            sizes="56px"
                            className="aspect-square h-auto w-14 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex aspect-square w-14 items-center justify-center rounded-md bg-muted text-caption text-muted-foreground">
                            No photo
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-normal">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-caption text-muted-foreground md:hidden">
                          {product.categoryName ?? "Uncategorized"}
                        </p>
                        {product.description ? (
                          <p className="line-clamp-2 text-caption text-muted-foreground">
                            {product.description}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{product.categoryName ?? "Uncategorized"}</TableCell>
                      <TableCell className="whitespace-normal">
                        <LibraryStatusBadge status={product.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/products/${product.id}`}>
                            Edit<span className="sr-only"> {product.name}</span>
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section aria-labelledby="categories-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="categories-heading" className="text-heading-2 text-primary">
            Categories
          </h2>
          <p className="text-body-sm text-muted-foreground">
            Optional groupings for the menu. The order here is the order customers see.
          </p>
        </div>
        <CategoryManager categories={categories} />
      </section>
    </div>
  );
}
