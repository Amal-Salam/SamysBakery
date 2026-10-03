import "server-only";

import { getCart } from "@/features/cart/service";
import type { CartItem } from "@/features/cart/rules";
import {
  assertAddressOwned,
  createAddress,
  getAddress,
  listAddresses,
  type Address,
} from "@/features/customers/addresses";
import { getPublishedMenu } from "@/features/weekly-menu/storefront";
import { AppError, fromDbError } from "@/lib/errors";
import { assertUser, type CurrentUser } from "@/lib/security/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { lagosToday } from "@/lib/utils/dates";
import type { PrepareCheckoutInput } from "@/schemas/checkout";

import type { DeliveryDateStatus } from "./rules";

// Checkout preparation (API contract §10). Never creates an order or a payment;
// it re-derives everything from server data immediately before payment. Payment
// initialization (Milestone 10) will call prepareCheckout again rather than
// trusting anything the browser held between steps.

export type CheckoutLine = Pick<CartItem, "productId" | "name" | "quantity"> & {
  unitPrice: number;
  lineTotal: number;
};

export type CheckoutSummary = {
  customer: { name: string; email: string };
  lines: CheckoutLine[];
  subtotal: number;
  currency: "NGN";
  deliveryDate: string;
  address: Address;
  specialNotes: string | null;
};

export type CheckoutContext = {
  user: CurrentUser;
  addresses: Address[];
  deliveryDates: string[];
  cutoff: string;
  today: string;
};

export async function getCheckoutContext(user: CurrentUser): Promise<CheckoutContext> {
  const supabase = await createSupabaseServerClient();
  const [addresses, dates, cutoff] = await Promise.all([
    listAddresses(),
    supabase.rpc("eligible_delivery_dates"),
    supabase.rpc("order_cutoff_time"),
  ]);
  if (dates.error) throw fromDbError(dates.error);
  if (cutoff.error) throw fromDbError(cutoff.error);
  return {
    user,
    addresses,
    deliveryDates: (dates.data as unknown as string[]) ?? [],
    cutoff: String(cutoff.data).slice(0, 5),
    today: lagosToday(),
  };
}

const DATE_ERRORS: Record<Exclude<DeliveryDateStatus, "VALID">, AppError> = {
  MENU_UNAVAILABLE: new AppError("MENU_UNAVAILABLE", "There's no menu open for ordering right now."),
  ORDER_CUTOFF_PASSED: new AppError(
    "ORDER_CUTOFF_PASSED",
    "Today's ordering cutoff has passed. Please choose another delivery day."
  ),
  DELIVERY_DATE_INVALID: new AppError(
    "DELIVERY_DATE_INVALID",
    "Please choose one of the available delivery days (Tuesday–Saturday this week)."
  ),
};

export async function prepareCheckout(input: PrepareCheckoutInput): Promise<CheckoutSummary> {
  // 1. Authenticated customer.
  const user = await assertUser();

  // 2–7. Cart re-evaluated against the current published menu and server prices.
  const [cart, menu] = await Promise.all([getCart(), getPublishedMenu()]);
  if (!menu) throw DATE_ERRORS.MENU_UNAVAILABLE;
  if (cart.items.length === 0) throw new AppError("CHECKOUT_INVALID", "Your cart is empty.");
  if (!cart.canCheckout) {
    const soldOut = cart.items.some((item) => item.issue === "SOLD_OUT" || item.issue === "EXCEEDS_AVAILABLE");
    throw new AppError(
      soldOut ? "OUT_OF_STOCK" : "PRODUCT_UNAVAILABLE",
      "Some items in your cart are no longer available in that quantity. Please review your cart."
    );
  }

  // 8–9. Delivery date and ordering cutoff, decided by the database.
  const supabase = await createSupabaseServerClient();
  const { data: status, error } = await supabase.rpc("delivery_date_status", {
    requested: input.deliveryDate,
  });
  if (error) throw fromDbError(error);
  if (status !== "VALID") throw DATE_ERRORS[status as Exclude<DeliveryDateStatus, "VALID">];

  // Address: an owned saved address, or a new one (saved to the account — owner decision).
  const address = input.newAddress
    ? await createAddress(user.id, input.newAddress)
    : assertAddressOwned(await getAddress(input.addressId!));

  // 10. Authoritative subtotal (already computed server-side in kobo by the cart).
  const lines: CheckoutLine[] = cart.items.map((item) => ({
    productId: item.productId,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice!,
    lineTotal: item.lineTotal!,
  }));

  // 11. Summary.
  return {
    customer: { name: user.fullName, email: user.email },
    lines,
    subtotal: cart.subtotal,
    currency: "NGN",
    deliveryDate: input.deliveryDate,
    address,
    specialNotes: input.specialNotes,
  };
}
