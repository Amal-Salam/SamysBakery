import type { Metadata } from "next";
import { Fragment, Suspense } from "react";

import { DoodleBadge } from "@/components/brand/doodle-badge";
import { OvenDrawing, RollingPinDrawing, WheatDivider, WheatDrawing } from "@/components/brand/ornaments";
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <WheatDrawing className="size-10 text-primary md:size-12" />
          <h1 className="text-display-l text-primary">This Week&apos;s Menu</h1>
          <DoodleBadge tone="accent" shape="oval">
            This week only
          </DoodleBadge>
        </div>
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
          illustration={<OvenDrawing className="h-24 w-28" />}
          title="No products are currently available."
          description="This week's menu hasn't been published yet. Please check back soon."
        />
      ) : (
        groups.map((group, index) => (
          <Fragment key={group.name ?? "uncategorized"}>
            {index > 0 ? <WheatDivider /> : null}
            <section
              aria-labelledby={showHeadings ? `category-${index}` : undefined}
              aria-label={showHeadings ? undefined : "Products"}
              className="flex flex-col gap-6"
            >
              {showHeadings ? (
                <div className="flex items-center gap-3">
                  <RollingPinDrawing className="size-9 text-primary" />
                  <h2 id={`category-${index}`} className="text-heading-1 text-primary">
                    {group.name ?? "Also this week"}
                  </h2>
                </div>
              ) : null}
              <ProductGrid products={group.products} prioritizeFirst={index === 0} />
            </section>
          </Fragment>
        ))
      )}
    </>
  );
}
