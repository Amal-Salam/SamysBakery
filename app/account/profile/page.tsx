import type { Metadata } from "next";

import { RollingPinDrawing } from "@/components/brand/ornaments";
import { DeleteAccountForm, ProfileForm } from "@/components/account/profile-form";
import { requireUser } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="profile-heading" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <RollingPinDrawing className="size-9 text-primary" />
          <h1 id="profile-heading" className="text-heading-1 text-primary">
            Profile
          </h1>
        </div>
        <ProfileForm fullName={user.fullName} phone={user.phone} email={user.email} />
      </section>
      {user.role === "CUSTOMER" ? (
        <section aria-labelledby="delete-heading" className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4">
          <h2 id="delete-heading" className="text-heading-3 text-destructive">
            Delete account
          </h2>
          <DeleteAccountForm />
        </section>
      ) : null}
    </div>
  );
}
