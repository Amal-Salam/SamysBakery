import type { Metadata } from "next";

import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Account" };

// Minimal signed-in view. Profile, addresses and orders arrive in Milestone 13.
export default async function AccountPage() {
  const user = await requireUser("/account");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-heading-1 text-primary">Account</h1>
      <dl className="grid gap-1 text-body">
        {user.fullName ? (
          <div>
            <dt className="sr-only">Name</dt>
            <dd className="font-medium">{user.fullName}</dd>
          </div>
        ) : null}
        <div>
          <dt className="sr-only">Email</dt>
          <dd className="text-muted-foreground">{user.email}</dd>
        </div>
      </dl>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </div>
  );
}
