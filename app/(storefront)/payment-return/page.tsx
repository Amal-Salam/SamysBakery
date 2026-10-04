import type { Metadata } from "next";

import { BasketDrawing } from "@/components/brand/ornaments";
import { EmptyState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Return to the app", robots: { index: false } };

// Where Paystack sends customers who paid from the mobile app (it opens in the
// phone's browser, which isn't signed in). Deliberately static: it shows no
// order or payment data and decides nothing. The app asks the API for the
// payment status, which the server verifies with Paystack.
export default function PaymentReturnPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-4 py-16 sm:px-6">
      <EmptyState
        illustration={<BasketDrawing className="h-24 w-28" />}
        title="Payment submitted."
        description="You can close this tab and return to the Samy's Bakery app, where your order confirmation will appear."
      />
    </div>
  );
}
