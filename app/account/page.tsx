import type { Metadata } from "next";
import Link from "next/link";

import { LoafDrawing, WheatDivider, WheatDrawing } from "@/components/brand/ornaments";
import { signOut } from "@/actions/auth";
import { OrderList } from "@/components/account/order-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { listMyOrders } from "@/features/orders/customer";
import { requireUser } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const recent = await listMyOrders(3);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <WheatDrawing className="size-9 text-primary" />
            <h1 className="text-heading-1 text-primary">{user.fullName ? `Hello, ${user.fullName}` : "Your account"}</h1>
          </div>
          <p className="text-body-sm text-muted-foreground break-all">{user.email}</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>

      <WheatDivider />
      <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-heading" className="text-heading-2 text-primary">
            Recent orders
          </h2>
          {recent.length > 0 ? (
            <Link href="/account/orders" className="text-body-sm text-accent underline underline-offset-4">
              View all orders
            </Link>
          ) : null}
        </div>
        {recent.length === 0 ? (
          <EmptyState
            illustration={<LoafDrawing className="size-16" />}
            title="You haven't placed any orders yet."
            action={
              <Button asChild>
                <Link href="/menu">View This Week&apos;s Menu</Link>
              </Button>
            }
          />
        ) : (
          <OrderList orders={recent} />
        )}
      </section>
    </div>
  );
}
