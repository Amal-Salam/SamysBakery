import { Suspense } from "react";

import { signOut } from "@/actions/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { checkAdminPage } from "@/lib/security/auth";

// Every /admin/* page except /admin/login renders inside this layout, which
// verifies authentication AND the ADMIN role server-side.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const check = await checkAdminPage();

  if (check.status === "forbidden") {
    return (
      <main id="main-content" className="mx-auto w-full max-w-xl flex-1 px-4">
        <ErrorState
          title="Forbidden"
          description="Your account does not have access to the admin area."
          action={
            <form action={signOut}>
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          }
        />
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <p className="font-heading text-heading-3 font-semibold text-primary">
            Samy&apos;s Bakery Admin
          </p>
          <div className="flex items-center gap-3">
            <span className="hidden text-body-sm text-muted-foreground sm:inline">
              {check.user.email}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col lg:flex-row">
        <Suspense>
          <AdminSidebar />
        </Suspense>
        <main id="main-content" className="w-full min-w-0 flex-1 px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
