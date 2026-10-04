import { prepareCheckout } from "@/features/checkout/service";
import { readJson } from "@/lib/api/body";
import { apiRoute } from "@/lib/api/handler";
import { prepareCheckoutSchema } from "@/schemas/checkout";

// POST /api/v1/checkout/review { deliveryDate, addressId | newAddress, specialNotes }
// — the authoritative order summary (server prices, stock, date and cutoff
// checks). Same operation as the website's review step; reserves nothing.
export const POST = apiRoute({ auth: "required" }, async ({ request }) => {
  const input = await readJson(request, prepareCheckoutSchema);
  return prepareCheckout(input);
});
