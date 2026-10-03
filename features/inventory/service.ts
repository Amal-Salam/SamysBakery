import "server-only";

import { AppError, fromDbError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ErrorCode } from "@/types/api";

// Inventory transactions. All locking, availability checks and writes happen in
// a single database transaction (reserve_checkout_inventory / add_inventory);
// this layer only maps outcomes to the approved error contract.

export type ReservationContext = {
  paymentId: string;
  reference: string;
  amount: number;
  currency: "NGN";
  expiresAt: string;
};

const RESERVE_ERRORS: Record<string, { code: ErrorCode; message: string }> = {
  CART_EMPTY: { code: "CHECKOUT_INVALID", message: "Your cart is empty." },
  MENU_UNAVAILABLE: { code: "MENU_UNAVAILABLE", message: "There's no menu open for ordering right now." },
  PRODUCT_UNAVAILABLE: {
    code: "PRODUCT_UNAVAILABLE",
    message: "Something in your cart is no longer on this week's menu. Please review your cart.",
  },
  DELIVERY_DATE_INVALID: {
    code: "DELIVERY_DATE_INVALID",
    message: "Please choose one of the available delivery days (Tuesday–Saturday this week).",
  },
  ORDER_CUTOFF_PASSED: {
    code: "ORDER_CUTOFF_PASSED",
    message: "Today's ordering cutoff has passed. Please choose another delivery day.",
  },
  ADDRESS_NOT_FOUND: { code: "NOT_FOUND", message: "That address could not be found." },
  NOTES_TOO_LONG: { code: "VALIDATION_ERROR", message: "Special notes can be at most 500 characters." },
  UNAUTHENTICATED: { code: "UNAUTHENTICATED", message: "Please sign in to continue." },
};

/**
 * Atomically validates the customer's cart and holds the stock for payment
 * (15-minute temporary reservations), creating a PENDING payment whose amount
 * the database derived from current prices. No Paystack call happens here.
 */
export async function reserveCheckout(input: {
  deliveryDate: string;
  addressId: string;
  specialNotes: string | null;
}): Promise<ReservationContext> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("reserve_checkout_inventory", {
    delivery_date: input.deliveryDate,
    address_id: input.addressId,
    special_notes: input.specialNotes as string,
  });

  if (error) {
    if (error.message === "OUT_OF_STOCK") {
      const products = error.details ? ` (${error.details})` : "";
      throw new AppError(
        "OUT_OF_STOCK",
        `Sorry, there isn't enough left of something in your cart${products}. Please review your cart.`
      );
    }
    const known = RESERVE_ERRORS[error.message];
    if (known) throw new AppError(known.code, known.message);
    throw fromDbError(error);
  }

  const context = data as unknown as {
    payment_id: string;
    reference: string;
    amount: number;
    currency: "NGN";
    expires_at: string;
  };
  return {
    paymentId: context.payment_id,
    reference: context.reference,
    amount: Number(context.amount),
    currency: context.currency,
    expiresAt: context.expires_at,
  };
}

/** Releases a pending payment's held stock (failed / abandoned payment). Idempotent. */
export async function releaseReservation(paymentId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("release_inventory_reservation", { target_payment_id: paymentId });
  if (error) throw fromDbError(error, { P0002: "That payment could not be found." });
}

/** Admin stock increase (positive only, audited). Returns the new available quantity. */
export async function addInventory(weeklyMenuProductId: string, quantity: number, reason: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("add_inventory", {
    target_weekly_menu_product_id: weeklyMenuProductId,
    quantity,
    reason,
  });
  if (error) {
    throw fromDbError(error, {
      INVALID_QUANTITY: "Enter a quantity of at least 1.",
      INVALID_REASON: "Enter a reason for the stock increase.",
      MENU_EXPIRED: "This menu has ended, so its stock can't change.",
      P0002: "That product could not be found.",
    });
  }
  return data as number;
}
