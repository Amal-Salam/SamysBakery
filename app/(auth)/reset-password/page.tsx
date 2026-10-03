import type { Metadata } from "next";
import Link from "next/link";

import { PasswordResetRequestForm } from "@/components/auth/password-reset-request-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-heading-1 text-primary">Reset your password</h1>
        <p className="text-body-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a link to choose a new password.
        </p>
      </div>
      <PasswordResetRequestForm />
      <p className="text-body-sm">
        <Link href="/login" className="font-medium text-accent underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
