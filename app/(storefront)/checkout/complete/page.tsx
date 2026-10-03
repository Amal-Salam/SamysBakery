import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PendingPaymentRefresh } from "@/components/checkout/pending-payment-refresh";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { isOurReference } from "@/features/payments/rules";
import { processPayment } from "@/features/payments/service";
import { requireUser } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Payment" };

// Paystack redirects here after the hosted checkout. The ?reference= is only a
// lookup key: success is decided by verifying with Paystack server-side.
export default async function PaymentCompletePage({ searchParams }: PageProps<"/checkout/complete">) {
  const { reference } = await searchParams;
  const user = await requireUser("/checkout");

  if (!isOurReference(reference)) {
    return (
      <Shell>
        <ErrorState title="We couldn't find that payment." description="If you were charged, your order will still be confirmed by email." action={<BackToCheckout />} />
      </Shell>
    );
  }

  const outcome = await processPayment(reference);

  if (outcome.kind === "CONFIRMED") {
    // Only the customer who placed the order is taken to its confirmation.
    if (outcome.userId === user.id) redirect(`/order-confirmation/${outcome.orderNumber}`);
    return (
      <Shell>
        <EmptyState title="This payment belongs to another account." />
      </Shell>
    );
  }

  return (
    <Shell>
      {outcome.kind === "PENDING" || outcome.kind === "VERIFICATION_UNAVAILABLE" ? (
        <>
          <EmptyState
            title="We're confirming your payment…"
            description="This usually takes a few seconds. You don't need to pay again; we'll update this page automatically."
          />
          <PendingPaymentRefresh />
        </>
      ) : outcome.kind === "FAILED" ? (
        <ErrorState
          title="Payment was not completed."
          description="You haven't been charged for an order. Your cart is still saved, so you can try again."
          action={<BackToCheckout />}
        />
      ) : outcome.kind === "REFUNDED_LATE" ? (
        <ErrorState
          title="Your payment arrived too late to hold your items."
          description="Your items were released before the payment completed, so no order was placed. A full refund has been requested automatically; it can take a few business days to appear."
          action={<BackToCheckout label="Back to checkout" />}
        />
      ) : (
        <ErrorState
          title="We couldn't confirm this payment."
          description="No order was placed. If you were charged, our team will review it and contact you."
          action={<BackToCheckout />}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-14 sm:px-6">{children}</div>;
}

function BackToCheckout({ label = "Try again" }: { label?: string }) {
  return (
    <Button asChild size="lg">
      <Link href="/checkout">{label}</Link>
    </Button>
  );
}
