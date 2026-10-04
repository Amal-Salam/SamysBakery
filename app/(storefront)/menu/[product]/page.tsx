import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { WheatDivider } from "@/components/brand/ornaments";
import { AddToCartForm } from "@/components/cart/add-to-cart-form";
import { AvailabilityBadge } from "@/components/storefront/availability-badge";
import { ProductImage } from "@/components/storefront/product-image";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/features/weekly-menu/rules";
import { getMenuProduct } from "@/features/weekly-menu/storefront";

const loadProduct = cache(getMenuProduct);

export async function generateMetadata({ params }: PageProps<"/menu/[product]">): Promise<Metadata> {
  const { product: slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return { title: "Product not found" };
  return { title: product.name, description: product.description || undefined };
}

export default async function ProductPage({ params }: PageProps<"/menu/[product]">) {
  const { product: slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();

  const soldOut = product.availabilityStatus === "SOLD_OUT";

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-2 md:gap-14 md:py-16">
      <ProductImage
        image={product.image}
        name={product.name}
        priority
        dimmed={soldOut}
        sizes="(min-width: 768px) 36rem, 92vw"
        className="w-full rounded-xl"
      />

      <div className="flex flex-col gap-6 md:pt-6">
        <Link href="/menu" className="text-body-sm text-accent underline underline-offset-4">
          ← This Week&apos;s Menu
        </Link>
        <h1 className="text-display-l text-primary">{product.name}</h1>
        {product.description ? <p className="text-body-lg">{product.description}</p> : null}

        <div className="flex flex-wrap items-center gap-4">
          <p className="text-heading-2 font-semibold">{formatNaira(product.price)}</p>
          <AvailabilityBadge status={product.availabilityStatus} available={product.availableQuantity} />
        </div>

        {soldOut ? (
          <p role="status" className="text-body text-muted-foreground">
            This bake is sold out for this week.
          </p>
        ) : null}

        <AddToCartForm productId={product.id} available={product.availableQuantity} soldOut={soldOut} />

        {product.ingredients ? <WheatDivider /> : null}
        {product.ingredients ? (
          <details className="rounded-lg border border-border bg-surface">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium">Ingredients</summary>
            <p className="border-t border-border px-4 py-3 text-body-sm">{product.ingredients}</p>
          </details>
        ) : null}

        <Button asChild variant="outline" size="lg" className="w-full sm:w-fit">
          <Link href="/menu">{soldOut ? "Back to Weekly Menu" : "Continue Browsing"}</Link>
        </Button>
      </div>
    </div>
  );
}
