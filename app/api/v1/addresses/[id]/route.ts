import { deleteAddress, listAddresses, updateAddress } from "@/features/customers/addresses";
import { readJson } from "@/lib/api/body";
import { apiRoute } from "@/lib/api/handler";
import { idFrom } from "@/lib/api/ids";
import { addressInputSchema } from "@/schemas/address";

// PATCH /api/v1/addresses/:id — edit one of the customer's own addresses.
export const PATCH = apiRoute({ auth: "required" }, async ({ request, params }) => {
  const id = idFrom(params, "id", "address");
  const input = await readJson(request, addressInputSchema);
  await updateAddress(id, input);
  return listAddresses();
});

// DELETE /api/v1/addresses/:id — remove it (deleting the default promotes the
// most recently added remaining address, as on the website).
export const DELETE = apiRoute({ auth: "required" }, async ({ params }) => {
  await deleteAddress(idFrom(params, "id", "address"));
  return listAddresses();
});
