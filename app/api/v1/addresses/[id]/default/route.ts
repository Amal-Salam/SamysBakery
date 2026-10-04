import { listAddresses, setDefaultAddress } from "@/features/customers/addresses";
import { apiRoute } from "@/lib/api/handler";
import { idFrom } from "@/lib/api/ids";

// POST /api/v1/addresses/:id/default — make it the default address.
export const POST = apiRoute({ auth: "required" }, async ({ params }) => {
  await setDefaultAddress(idFrom(params, "id", "address"));
  return listAddresses();
});
