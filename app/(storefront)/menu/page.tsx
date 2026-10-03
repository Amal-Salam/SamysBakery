import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductGrid } from "@/components/storefront/product-card";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { groupByCategory } from "@/features/weekly-menu/rules";
import { getPublishedMenu } from "@/features/weekly-menu/storefront";
import { formatWeekRange } from "@/lib/utils/dates";

export const metadata: Metadata = {
  title: "This Week's Menu",
  description: "Fresh this week. Cakes, breads and pastries available Tuesday–Saturday.",
};

export default function MenuPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-12 sm:px-6 md:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-display-l text-primary">This Week&apos;s Menu</h1>
        <p className="max-w-xl text-muted-foreground">
          A new selection of cakes, breads, and pastries, thoughtfully chosen for the week.
        </p>
      </header>
      <Suspense fallback={<LoadingState label="Loading this week's menu…" />}>
        <MenuContent />
      </Suspense>
    </div>
  );
}

async function MenuContent() {
  const menu = await getPublishedMenu();
  const groups = menu ? groupByCategory(menu.products) : [];
  const showHeadings = groups.length > 1 || groups.some((group) => group.name);

  return (
    <>
      {menu ? (
        <p className="-mt-8 font-heading text-heading-3">{formatWeekRange(menu.weekStart, menu.weekEnd)}</p>
      ) : null}

      {!menu || menu.products.length === 0 ? (
        <EmptyState
          title="No products are currently available."
          description="This week's menu hasn't been published yet. Please check back soon."
        />
      ) : (
        groups.map((group, index) => (
          <section
            key={group.name ?? "uncategorized"}
            aria-labelledby={showHeadings ? `category-${index}` : undefined}
            aria-label={showHeadings ? undefined : "Products"}
            className="flex flex-col gap-6"
          >
            {showHeadings ? (
              <h2 id={`category-${index}`} className="text-heading-1 text-primary">
                {group.name ?? "Also this week"}
              </h2>
            ) : null}
            <ProductGrid products={group.products} prioritizeFirst={index === 0} />
          </section>
        ))
      )}
    </>
  );
}
