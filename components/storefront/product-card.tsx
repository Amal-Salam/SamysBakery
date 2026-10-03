import Link from "next/link";

import type { StorefrontProduct } from "@/features/weekly-menu/storefront";
import { formatNaira } from "@/features/weekly-menu/rules";

import { AvailabilityBadge } from "./availability-badge";
import { ProductImage } from "./product-image";

export function ProductCard({ product, priority = false }: { product: StorefrontProduct; priority?: boolean }) {
  const soldOut = product.availabilityStatus === "SOLD_OUT";

  return (
    <article className="group relative flex flex-col gap-3">
      <ProductImage
        image={product.image}
        name={product.name}
        priority={priority}
        dimmed={soldOut}
        sizes="(min-width: 1280px) 22rem, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
        className="group-hover:[&_img]:scale-[1.03]"
      />
      <div className="flex flex-col gap-1.5">
        <h3 className="font-heading text-heading-3 leading-tight">
          <Link
            href={`/menu/${product.slug}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>
        {product.description ? (
          <p className="line-clamp-2 text-body-sm text-muted-foreground">{product.description}</p>
        ) : null}
        {product.ingredients ? (
          <p className="line-clamp-1 text-caption text-muted-foreground">
            <span className="font-medium">Ingredients:</span> {product.ingredients}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-body font-semibold">{formatNaira(product.price)}</p>
          <AvailabilityBadge status={product.availabilityStatus} available={product.availableQuantity} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, prioritizeFirst = false }: { products: StorefrontProduct[]; prioritizeFirst?: boolean }) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, index) => (
        <li key={product.id} className="has-[a:focus-visible]:rounded-lg has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-ring">
          <ProductCard product={product} priority={prioritizeFirst && index < 2} />
        </li>
      ))}
    </ul>
  );
}
