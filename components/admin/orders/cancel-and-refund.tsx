"use client";

import { useActionState } from "react";

import { adminCancelOrderAction, checkRefundStatusAction, requestRefundAction } from "@/actions/admin/orders";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { FormError, FormSuccess, SubmitButton } from "@/components/ui/form";
import type { AdminOrderDetail } from "@/features/orders/admin";
import { isCancellable } from "@/features/orders/rules";
import { formatNaira } from "@/features/weekly-menu/rules";

/** Cancellation and refund are separate, explicitly confirmed actions (AGENTS.md §29–30). */
export function CancelAndRefund({ order }: { order: AdminOrderDetail }) {
  if (isCancellable(order.orderStatus)) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body-sm">
          Cancelling releases this order&apos;s reserved stock. It does <strong>not</strong> refund the customer; you can
          refund separately afterwards.
        </p>
        <ConfirmActionDialog
          trigger="Cancel order"
          title={`Cancel ${order.orderNumber}?`}
          description={
            <>
              <p>The order becomes CANCELLED (final) and its stock is released for other customers.</p>
              <p>No refund is made automatically.</p>
            </>
          }
          confirmLabel="Yes, cancel order"
          pendingLabel="Cancelling…"
          action={adminCancelOrderAction}
          fields={{ orderNumber: order.orderNumber }}
        />
      </div>
    );
  }

  if (order.orderStatus !== "CANCELLED") {
    return <p className="text-body-sm text-muted-foreground">Orders can only be cancelled before they&apos;re ready.</p>;
  }

  return <RefundPanel order={order} />;
}

function refundLabel(refund: AdminOrderDetail["refund"]) {
  if (!refund) return "Not refunded";
  if (refund.status === "REFUNDED") return "Refunded";
  switch (refund.providerStatus) {
    case "failed":
      return "Refund failed at Paystack — you can try again";
    case "request_failed":
      return "Refund request didn't reach Paystack — you can try again";
    case null:
      return "Refund being requested…";
    default:
      return `Refund requested — Paystack status: ${refund.providerStatus}`;
  }
}

function RefundPanel({ order }: { order: AdminOrderDetail }) {
  const [state, action] = useActionState(checkRefundStatusAction, null);
  const refund = order.refund;
  const canRequest =
    order.paymentStatus === "PAID" &&
    (!refund || refund.providerStatus === "failed" || refund.providerStatus === "request_failed");
  const inProgress = refund && refund.status !== "REFUNDED" && !canRequest;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-sm">
        Refund status: <strong>{refundLabel(refund)}</strong>
      </p>
      {canRequest ? (
        <ConfirmActionDialog
          trigger={`Refund ${formatNaira(order.subtotal)}`}
          title={`Refund ${formatNaira(order.subtotal)} to the customer?`}
          description={
            <>
              <p>A full refund of {order.orderNumber} will be requested from Paystack.</p>
              <p>Refunds can take a few days; it&apos;s only shown as refunded once Paystack confirms it.</p>
            </>
          }
          confirmLabel="Yes, request refund"
          pendingLabel="Requesting…"
          action={requestRefundAction}
          fields={{ orderNumber: order.orderNumber, confirm: "yes" }}
        />
      ) : null}
      {inProgress ? (
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="orderNumber" value={order.orderNumber} />
          <FormError state={state} />
          <FormSuccess state={state} message="Refund status updated from Paystack." />
          <SubmitButton variant="outline" size="sm" fullWidth={false} className="self-start" pendingLabel="Checking…">
            Check refund status
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
