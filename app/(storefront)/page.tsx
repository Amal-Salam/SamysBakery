import Link from "next/link";
import { Suspense } from "react";

import { DoodleBadge } from "@/components/brand/doodle-badge";
import { LoafDrawing, OvenDrawing, WheatDivider, WheatDrawing, WhiskDrawing } from "@/components/brand/ornaments";
import { ProductGrid } from "@/components/storefront/product-card";
import { ProductImage } from "@/components/storefront/product-image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { getPublishedMenu } from "@/features/weekly-menu/storefront";
import { formatWeekRange } from "@/lib/utils/dates";

// Copy supplied by the owner (2026-10-03).
const HOMEPAGE_PREVIEW_COUNT = 4;

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { account } = await searchParams;
  return (
    <>
      {account === "deleted" ? (
        <p role="status" className="mx-auto mt-6 w-full max-w-6xl rounded-md bg-success/10 px-4 py-3 text-body-sm text-success">
          Your account has been deleted.
        </p>
      ) : null}
      {/* Hero */}
      <div className="pattern-wheat">
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-20">
        <div className="flex flex-col items-start gap-6">
          <p className="text-caption font-semibold tracking-[0.2em] text-accent uppercase">New Menu Every Tuesday - Orders Close By Saturday</p>
          <h1 className="text-display-xl text-primary">Something delicious is always baking.</h1>
          <p className="max-w-md text-body-lg text-muted-foreground">
            Small-batch bakes, exciting flavours, and artisanal treats made fresh for your week.
          </p>
          <Button asChild size="lg">
            <Link href="/menu">Explore This Week&apos;s Menu</Link>
          </Button>
        </div>
        <Suspense fallback={<Skeleton className="aspect-[4/5] w-full rounded-xl md:aspect-square" />}>
          <HeroImage />
        </Suspense>
      </section>
      </div>

      {/* This Week's Menu */}
      <section aria-labelledby="this-week-heading" className="bg-surface py-16 md:py-20">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <WheatDrawing className="size-10 text-primary md:size-12" />
              <h2 id="this-week-heading" className="text-display-l text-primary">
                This Week&apos;s Menu
              </h2>
              <DoodleBadge tone="accent" shape="oval">
                This week only
              </DoodleBadge>
            </div>
            <p className="text-heading-3 font-heading">Fresh this week. Available Tuesday–Saturday.</p>
            <p className="max-w-xl text-body text-muted-foreground">
              A new selection of cakes, breads, and pastries, thoughtfully chosen for the week.
            </p>
          </div>
          <Suspense fallback={<LoadingState label="Loading this week's menu…" />}>
            <ThisWeekPreview />
          </Suspense>
        </div>
      </section>

      {/* A Little About Samy's */}
      <section id="about" aria-labelledby="about-heading" className="scroll-mt-8 py-16 md:py-24">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 sm:px-6">
          <WheatDivider className="mb-4" />
          <div className="flex flex-wrap items-center gap-4">
            <WhiskDrawing className="size-10 text-primary md:size-12" />
            <h2 id="about-heading" className="text-display-l text-primary">
              A Little About Samy&apos;s
            </h2>
          </div>
          <p className="font-heading text-heading-2 text-accent">
            An artisanal bakery where there&apos;s always something exciting to discover.
          </p>
          <p className="text-body-lg">
            At Samy&apos;s, every week brings something new. From familiar favourites to unexpected
            flavours, we make small-batch bakes with care, creativity, and plenty of personality.
          </p>
          <p className="text-body-lg">
            No permanent menu. No boring routine. Just good things worth looking forward to.
          </p>
        </div>
      </section>

      {/* Closing CTA */}
      <section
        aria-labelledby="closing-heading"
        className="pattern-wheat bg-primary py-16 text-primary-foreground [--pattern-ink:var(--color-surface)] [--pattern-opacity:0.08] md:py-20"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-4 text-center sm:px-6">
          <LoafDrawing className="size-12" accentClassName="stroke-accent-soft" />
          <h2 id="closing-heading" className="text-display-l">
            Your next favourite bake might be waiting.
          </h2>
          <p className="text-body-lg opacity-90">See what&apos;s fresh this week.</p>
          <Button asChild size="lg" variant="secondary">
            <Link href="/menu">Explore the Menu</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

// Hero photography comes from this week's menu; text-only when none has a photo.
async function HeroImage() {
  const menu = await getPublishedMenu();
  const products = menu?.products ?? [];
  const heroProduct =
    products.find((product) => product.image && product.availabilityStatus !== "SOLD_OUT") ??
    products.find((product) => product.image);
  if (!heroProduct) return null;
  return (
    <ProductImage
      image={heroProduct.image}
      name={heroProduct.name}
      priority
      sizes="(min-width: 768px) 36rem, 92vw"
      className="aspect-[4/5] w-full rounded-xl md:aspect-square"
    />
  );
}

async function ThisWeekPreview() {
  const menu = await getPublishedMenu();
  if (!menu || menu.products.length === 0) {
    return (
      <EmptyState
        illustration={<OvenDrawing className="h-24 w-28" />}
        title="No products are currently available."
        description="This week's menu hasn't been published yet. Please check back soon."
      />
    );
  }
  return (
    <>
      <p className="-mt-6 text-body-sm font-medium">{formatWeekRange(menu.weekStart, menu.weekEnd)}</p>
      <ProductGrid products={menu.products.slice(0, HOMEPAGE_PREVIEW_COUNT)} />
      <Button asChild size="lg" variant="outline" className="self-start">
        <Link href="/menu">View This Week&apos;s Menu</Link>
      </Button>
    </>
  );
}
