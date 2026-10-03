import type { Metadata } from "next";
import Link from "next/link";

import { ProductForm } from "@/components/admin/products/product-form";
import { listCategories } from "@/features/products/queries";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const categories = await listCategories();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/products" className="text-body-sm text-accent underline underline-offset-4">
          ← Product Library
        </Link>
        <h1 className="text-heading-1 text-primary">Add product</h1>
        <p className="text-body-sm text-muted-foreground">
          You can add photos after creating the product.
        </p>
      </div>
      <ProductForm mode="create" categories={categories} />
    </div>
  );
}
