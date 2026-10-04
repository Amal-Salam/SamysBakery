import { getCheckoutContext } from "@/features/checkout/service";
import { apiRoute } from "@/lib/api/handler";

// GET /api/v1/checkout — what the app needs to start checkout: saved addresses
// and the delivery dates the database allows right now (cutoff applied).
export const GET = apiRoute({ auth: "required" }, async ({ user }) => {
  const context = await getCheckoutContext(user);
  return {
    customer: { name: user.fullName, email: user.email },
    addresses: context.addresses,
    deliveryDates: context.deliveryDates,
    cutoff: context.cutoff,
    today: context.today,
  };
});
