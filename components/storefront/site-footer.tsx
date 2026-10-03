import Link from "next/link";

import { SITE } from "@/lib/site-config";

// Footer copy supplied by the owner (2026-10-03). Not shown yet, by decision:
// the menu-drop sign-up (out of MVP scope), phone/email (placeholders), and
// FAQ/legal links (no approved content yet).
const linkClass = "inline-flex min-h-11 items-center text-body-sm text-foreground hover:text-accent";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-surface-muted">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <p className="font-heading text-heading-2 font-semibold text-primary">{SITE.name}</p>
          <p className="text-body-sm text-muted-foreground">{SITE.tagline}</p>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="font-sans text-body-sm font-semibold">Hours</h2>
          <p className="text-body-sm">{SITE.hours}</p>
        </div>

        <nav aria-labelledby="footer-links-heading" className="flex flex-col gap-1">
          <h2 id="footer-links-heading" className="font-sans text-body-sm font-semibold">
            Quick Links
          </h2>
          <ul>
            <li>
              <Link href="/menu" className={linkClass}>
                This Week&apos;s Menu
              </Link>
            </li>
            <li>
              <Link href="/#about" className={linkClass}>
                About Us
              </Link>
            </li>
            <li>
              <Link href="/account" className={linkClass}>
                My Account
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-connect-heading" className="flex flex-col gap-1">
          <h2 id="footer-connect-heading" className="font-sans text-body-sm font-semibold">
            Connect
          </h2>
          <ul className="flex flex-wrap gap-x-4">
            {SITE.social.map((link) => (
              <li key={link.label}>
                <a href={link.href} className={linkClass} target="_blank" rel="noopener noreferrer">
                  {link.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 text-caption text-muted-foreground sm:px-6">
          &copy; {year} {SITE.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
