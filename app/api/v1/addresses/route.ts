import { createAddress, listAddresses } from "@/features/customers/addresses";
import { readJson } from "@/lib/api/body";
import { apiRoute } from "@/lib/api/handler";
import { addressInputSchema } from "@/schemas/address";

// GET /api/v1/addresses — the customer's own addresses, default first (RLS).
export const GET = apiRoute({ auth: "required" }, async () => listAddresses());

// POST /api/v1/addresses — add an address (the first one becomes the default).
export const POST = apiRoute({ auth: "required" }, async ({ request, user }) => {
  const input = await readJson(request, addressInputSchema);
  await createAddress(user.id, input);
  return listAddresses();
});
