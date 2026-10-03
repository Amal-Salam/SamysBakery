import "server-only";

import { renderOrderConfirmation } from "@/emails/order-confirmation";
import { formatNaira } from "@/features/weekly-menu/rules";
import { publicEnv } from "@/lib/env";
import { sendEmail } from "@/lib/resend/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatLongDate } from "@/lib/utils/dates";

// Decides WHEN the confirmation email is sent: after verified payment created
// the order, exactly once. Never throws: an email problem must not affect the
// paid order (AGENTS.md §32). A failed send is retried the next time the
// payment is processed (webhook retry or the customer's return page).

export type EmailOutcome = "SENT" | "ALREADY_SENT_OR_IN_PROGRESS" | "NOT_CONFIGURED" | "FAILED";

export async function sendOrderConfirmationOnce(orderId: string): Promise<EmailOutcome> {
  const admin = createSupabaseAdminClient();
  try {
    const { data: claimed, error: claimError } = await admin.rpc("claim_confirmation_email", {
      target_order_id: orderId,
    });
    if (claimError) throw claimError;
    if (!claimed) return "ALREADY_SENT_OR_IN_PROGRESS";

    const { data: order, error } = await admin
      .from("orders")
      .select(
        `order_number, email, recipient_name, phone, delivery_address, delivery_city, delivery_state,
         delivery_additional_info, special_notes, delivery_date, subtotal,
         order_items ( product_name, quantity, unit_price, line_total, created_at ),
         profiles:user_id ( full_name )`
      )
      .eq("id", orderId)
      .single();
    if (error || !order) throw error ?? new Error("order not found");

    const profile = order.profiles as unknown as { full_name: string } | null;
    const message = await renderOrderConfirmation({
      orderNumber: order.order_number,
      customerName: profile?.full_name ?? "",
      items: [...order.order_items]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((item) => ({
          name: item.product_name,
          quantity: item.quantity,
          unitPrice: formatNaira(Number(item.unit_price)),
          lineTotal: formatNaira(Number(item.line_total)),
        })),
      subtotal: formatNaira(Number(order.subtotal)),
      deliveryDate: formatLongDate(order.delivery_date),
      recipient: order.recipient_name,
      phone: order.phone,
      address: [order.delivery_address, order.delivery_city, order.delivery_state].join(", "),
      additionalInfo: order.delivery_additional_info,
      specialNotes: order.special_notes,
      orderUrl: new URL(`/order-confirmation/${order.order_number}`, publicEnv.NEXT_PUBLIC_APP_URL).toString(),
    });

    const result = await sendEmail({
      to: order.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      idempotencyKey: `order-confirmation-${orderId}`,
    });

    await admin.rpc("complete_confirmation_email", { target_order_id: orderId, succeeded: result.sent });
    if (!result.sent) {
      if (result.reason === "NOT_CONFIGURED") console.warn("[email] Resend is not configured; confirmation not sent");
      return result.reason;
    }
    return "SENT";
  } catch {
    console.error("[email] confirmation email error", orderId);
    await admin
      .rpc("complete_confirmation_email", { target_order_id: orderId, succeeded: false })
      .then(undefined, () => undefined);
    return "FAILED";
  }
}
