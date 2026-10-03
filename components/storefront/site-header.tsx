import Link from "next/link";

// Admin navigation must never appear here (Design System §4.1).
// "About" is omitted until an About route/copy is approved.
// Cart count and auth-aware account entry arrive with their milestones.
const navLinks = [
  { href: "/menu", label: "Menu" },
  { href: "/account", label: "Account" },
  { href: "/cart", label: "Cart" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="font-heading text-heading-3 font-semibold text-primary sm:text-heading-2"
        >
          Samy&apos;s Bakery
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center gap-1 sm:gap-4">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center rounded-md px-2 text-body-sm font-medium text-foreground transition-colors hover:text-accent sm:px-3 sm:text-body"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
