import { isOurReference } from "@/features/payments/rules";
import { processPayment } from "@/features/payments/service";
import { apiRoute } from "@/lib/api/handler";
import { AppError, fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET /api/v1/payments/:reference — the verified outcome of the caller's own
// payment. Ownership is checked first through RLS (another customer's reference
// is simply not found); then the server verifies with Paystack and applies the
// result exactly once (same idempotent path as the webhook).
export const GET = apiRoute({ auth: "required" }, async ({ params, user }) => {
  const reference = params.reference;
  if (!isOurReference(reference)) throw new AppError("VALIDATION_ERROR", "Invalid payment reference.");

  const supabase = await createSupabaseServerClient();
  const { data: own, error } = await supabase.from("payments").select("id").eq("reference", reference).maybeSingle();
  if (error) throw fromDbError(error);
  if (!own) throw new AppError("NOT_FOUND", "That payment could not be found.");

  const outcome = await processPayment(reference);
  switch (outcome.kind) {
    case "CONFIRMED":
      if (outcome.userId !== user.id) throw new AppError("NOT_FOUND", "That payment could not be found.");
      return { status: "CONFIRMED" as const, orderNumber: outcome.orderNumber };
    case "PENDING":
    case "VERIFICATION_UNAVAILABLE":
      return { status: "PENDING" as const };
    case "FAILED":
      return { status: "FAILED" as const };
    case "REFUNDED_LATE":
      return { status: "REFUNDED_LATE" as const };
    case "REJECTED":
      return { status: "REJECTED" as const };
    case "UNKNOWN_REFERENCE":
      throw new AppError("NOT_FOUND", "That payment could not be found.");
  }
});
