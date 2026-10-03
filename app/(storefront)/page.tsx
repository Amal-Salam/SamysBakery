import Link from "next/link";

import { Button } from "@/components/ui/button";

// Foundation placeholder. The real homepage (hero, weekly menu, introduction,
// editorial feature, closing CTA) is built in Milestone 6 — Storefront.
export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center gap-8 px-4 py-16 sm:px-6 md:py-24">
      <h1 className="text-display-xl text-primary">Samy&apos;s Bakery</h1>
      <Button asChild size="lg">
        <Link href="/menu">View This Week&apos;s Menu</Link>
      </Button>
    </section>
  );
}
