"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

// Approved admin navigation — AGENTS.md §42. Pages for later milestones
// appear here as they are built out.
const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/orders?view=today", label: "Today's Orders" },
      { href: "/admin/orders?view=upcoming", label: "Upcoming Orders" },
      { href: "/admin/orders?view=ready", label: "Ready for Delivery" },
    ],
  },
  {
    label: "Menu & Products",
    items: [
      { href: "/admin/menu", label: "Current Weekly Menu" },
      { href: "/admin/menu/new", label: "Create New Week" },
      { href: "/admin/products", label: "Product Library" },
    ],
  },
  {
    label: "Customers",
    items: [{ href: "/admin/customers", label: "Customers" }],
  },
  {
    label: "Business",
    items: [
      { href: "/admin/revenue", label: "Revenue" },
      { href: "/admin/inventory", label: "Inventory" },
    ],
  },
] as const;

function useIsActive() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (href: string) => {
    const [path, query] = href.split("?");
    if (query) return pathname === path && searchParams.toString() === query;
    if (path === "/admin") return pathname === "/admin";
    if (path === "/admin/orders") return pathname.startsWith(path) && !searchParams.get("view");
    if (path === "/admin/menu") return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  };
}

function NavList() {
  const isActive = useIsActive();
  return (
    <div className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 text-caption font-medium tracking-wide text-muted-foreground uppercase">
            {group.label}
          </p>
          <ul className="flex flex-col">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center rounded-md px-3 text-body-sm text-foreground hover:bg-muted",
                      active && "bg-muted font-semibold text-primary"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AdminSidebar() {
  return (
    <>
      {/* Desktop */}
      <nav aria-label="Admin" className="hidden w-60 shrink-0 border-r border-border bg-surface p-4 lg:block">
        <NavList />
      </nav>
      {/* Mobile: collapsible */}
      <details className="border-b border-border bg-surface lg:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-body-sm font-medium">
          Admin menu
        </summary>
        <nav aria-label="Admin" className="px-2 pb-4">
          <NavList />
        </nav>
      </details>
    </>
  );
}
