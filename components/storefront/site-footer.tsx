import Link from "next/link";

// Footer description, contact and social details are UNDECIDED
// (Design System §4.2) and intentionally omitted.
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-surface-muted">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-heading text-heading-3 font-semibold text-primary">
          Samy&apos;s Bakery
        </p>
        <nav aria-label="Footer">
          <ul className="flex gap-4">
            <li>
              <Link
                href="/menu"
                className="inline-flex min-h-11 items-center text-body-sm text-foreground hover:text-accent"
              >
                Menu
              </Link>
            </li>
            <li>
              <Link
                href="/account"
                className="inline-flex min-h-11 items-center text-body-sm text-foreground hover:text-accent"
              >
                Account
              </Link>
            </li>
          </ul>
        </nav>
        <p className="text-caption text-muted-foreground">
          &copy; {year} Samy&apos;s Bakery
        </p>
      </div>
    </footer>
  );
}
