import { z } from "zod";

import { startPayment } from "@/features/payments/service";
import { readJson } from "@/lib/api/body";
import { apiRoute } from "@/lib/api/handler";
import { SPECIAL_NOTES_MAX } from "@/schemas/checkout";

const startSchema = z.object({
  deliveryDate: z.iso.date("Choose a delivery date."),
  addressId: z.uuid("Choose a saved address."),
  specialNotes: z
    .string()
    .trim()
    .max(SPECIAL_NOTES_MAX, `Special notes can be at most ${SPECIAL_NOTES_MAX} characters.`)
    .optional()
    .transform((value) => value || null),
});

// POST /api/v1/payments { deliveryDate, addressId, specialNotes? } — holds the
// stock, creates the payment with a database-derived amount and returns the
// Paystack checkout URL (opened in a secure browser tab by the app). The app
// sends no amount; any extra fields are ignored.
export const POST = apiRoute({ auth: "required" }, async ({ request }) => {
  const input = await readJson(request, startSchema);
  return startPayment({ ...input, returnTo: "app" });
});
