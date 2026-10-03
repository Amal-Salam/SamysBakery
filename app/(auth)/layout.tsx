import Link from "next/link";

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
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10 sm:py-16"
      >
        {children}
      </main>
    </div>
  );
}
