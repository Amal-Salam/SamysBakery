import Link from "next/link";

import { getCurrentUser } from "@/lib/security/auth";

// Admin navigation must never appear here (Design System §4.1).
// "About" links to the homepage's About section (owner-supplied copy).
// Cart count arrives with the Cart milestone.
export async function SiteHeader() {
  const user = await getCurrentUser();
  const navLinks = [
    { href: "/menu", label: "Menu" },
    { href: "/#about", label: "About", desktopOnly: true },
    user
      ? { href: "/account", label: "Account" }
      : { href: "/login", label: "Sign in" },
    { href: "/cart", label: "Cart" },
  ];

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="font-heading text-heading-3 font-semibold whitespace-nowrap text-primary sm:text-heading-2"
        >
          Samy&apos;s Bakery
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center gap-1 sm:gap-4">
            {navLinks.map((link) => (
              <li key={link.href} className={"desktopOnly" in link ? "hidden sm:block" : undefined}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center rounded-md px-2 text-body-sm font-medium whitespace-nowrap text-foreground transition-colors hover:text-accent sm:px-3 sm:text-body"
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
