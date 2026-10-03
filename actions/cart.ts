"use server";

import { revalidatePath } from "next/cache";

import {
  addToCart,
  clearCart,
  dismissCartNotice,
  removeCartItem,
  updateCartItem,
} from "@/features/cart/service";
import { ok, toFailure, validationFailure } from "@/lib/errors";
import { cartLineSchema, cartProductSchema } from "@/schemas/cart";
import type { ActionResult } from "@/types/api";

// Guests and customers may both use the cart (owner decision), so these
// actions require no sign-in; ownership is enforced by the storage layer
// (the guest's own cookie, or RLS on the customer's database cart).

/** The cart count and drawer live in the shared layout. */
function refreshCartViews() {
  revalidatePath("/", "layout");
}

function lineFrom(formData: FormData) {
  return cartLineSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
  });
}

export async function addToCartAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = lineFrom(formData);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    await addToCart(parsed.data.productId, parsed.data.quantity);
  } catch (error) {
    return toFailure(error);
  }
  refreshCartViews();
  return ok(null);
}

export async function updateCartItemAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = lineFrom(formData);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    await updateCartItem(parsed.data.productId, parsed.data.quantity);
  } catch (error) {
    return toFailure(error);
  }
  refreshCartViews();
  return ok(null);
}

export async function removeCartItemAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = cartProductSchema.safeParse({ productId: formData.get("productId") });
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    await removeCartItem(parsed.data.productId);
  } catch (error) {
    return toFailure(error);
  }
  refreshCartViews();
  return ok(null);
}

export async function clearCartAction(): Promise<ActionResult> {
  try {
    await clearCart();
  } catch (error) {
    return toFailure(error);
  }
  refreshCartViews();
  return ok(null);
}

export async function dismissCartNoticeAction(): Promise<void> {
  await dismissCartNotice();
}
