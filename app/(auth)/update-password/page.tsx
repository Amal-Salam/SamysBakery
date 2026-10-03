import type { Metadata } from "next";
import Link from "next/link";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { getCurrentUser } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the password-reset email via /auth/callback, which establishes
// a recovery session before redirecting here.
export default async function UpdatePasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <h1 className="text-heading-1 text-primary">Link expired</h1>
        <p role="alert" className="text-body-sm text-muted-foreground">
          This password reset link is invalid or has expired.
        </p>
        <p className="text-body-sm">
          <Link href="/reset-password" className="font-medium text-accent underline underline-offset-4">
            Request a new link
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-heading-1 text-primary">Choose a new password</h1>
      <UpdatePasswordForm />
    </>
  );
}
