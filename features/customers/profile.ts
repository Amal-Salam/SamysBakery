import "server-only";

import { AppError, fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Profile updates run as the customer: RLS limits them to their own row and
// column grants allow only full_name and phone (never role).

export async function updateProfile(userId: string, input: { fullName: string; phone: string | null }): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName, phone: input.phone })
    .eq("id", userId)
    .select("id");
  if (error) throw fromDbError(error);
  if (data.length === 0) throw new AppError("NOT_FOUND", "Your profile could not be found.");
}

const DELETE_ERRORS: Record<string, string> = {
  ORDERS_IN_PROGRESS:
    "You have orders that are still being prepared or delivered. You can delete your account once they're delivered or cancelled.",
  PAYMENT_IN_PROGRESS: "A payment is still in progress. Please try again in a few minutes.",
  ADMIN_ACCOUNT: "Admin accounts can't be deleted here.",
};

/** Delete + anonymize (owner decision), in one database transaction. */
export async function deleteMyAccount(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    const message = DELETE_ERRORS[error.message];
    if (message) throw new AppError("CONFLICT", message);
    throw fromDbError(error);
  }
  // The login no longer exists; clear this browser's session cookies.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
}
