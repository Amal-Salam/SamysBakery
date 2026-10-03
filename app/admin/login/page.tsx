import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminSignInForm } from "@/components/auth/admin-sign-in-form";
import { ADMIN_HOME_PATH } from "@/lib/auth/routes";
import { getCurrentUser } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Admin sign in" };

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user?.role === "ADMIN") redirect(ADMIN_HOME_PATH);

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16"
    >
      <div className="flex flex-col gap-1">
        <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
          Samy&apos;s Bakery
        </p>
        <h1 className="text-heading-2 text-primary">Admin sign in</h1>
      </div>
      <AdminSignInForm />
    </main>
  );
}
