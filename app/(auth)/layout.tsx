import Link from "next/link";

import { WhiskDrawing } from "@/components/brand/ornaments";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link
            href="/"
            className="font-heading text-heading-3 font-semibold text-primary sm:text-heading-2"
          >
            Samy&apos;s Bakery
          </Link>
        </div>
      </header>
      <div className="pattern-wheat flex flex-1 flex-col">
        <main
          id="main-content"
          className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 sm:py-16"
        >
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
            <WhiskDrawing className="size-10 text-primary" />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
