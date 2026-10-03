import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

import { getPublishedMenu } from "@/features/weekly-menu/storefront";
import { AppError, fromDbError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/security/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import {
  MAX_LINE_QUANTITY,
  MAX_CART_LINES,
  evaluateCart,
  mergeCarts,
  parseGuestCart,
  serializeGuestCart,
  type CartLine,
  type EvaluatedCart,
  type MenuFacts,
} from "./rules";

// Cart storage (owner decisions): signed-in customers use their database cart
// (RLS-protected); guests use an httpOnly cookie holding only product ids and
// quantities. Either way the server re-evaluates prices and availability on
// every read, and the cart never reserves stock.

const GUEST_CART_COOKIE = "samys_cart";
const CART_NOTICE_COOKIE = "samys_cart_notice";
const GUEST_CART_MAX_AGE = 60 * 60 * 24 * 7;

type Db = SupabaseClient<Database>;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** Current published-menu facts keyed by weekly-menu product id. */
async function menuFacts(): Promise<Map<string, MenuFacts>> {
  const menu = await getPublishedMenu();
  return new Map(
    (menu?.products ?? []).map((product) => [
      product.id,
      {
        name: product.name,
        slug: product.slug,
        price: product.price,
        image: product.image,
        available: product.availableQuantity,
        status: product.availabilityStatus,
      },
    ])
  );
}

// ---------------------------------------------------------------------
// Storage backends
// ---------------------------------------------------------------------

async function readGuestLines(): Promise<CartLine[]> {
  return parseGuestCart((await cookies()).get(GUEST_CART_COOKIE)?.value);
}

async function writeGuestLines(lines: CartLine[]) {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(GUEST_CART_COOKIE);
    return;
  }
  store.set(GUEST_CART_COOKIE, serializeGuestCart(lines), { ...cookieOptions, maxAge: GUEST_CART_MAX_AGE });
}

async function findCartId(db: Db, userId: string): Promise<string | null> {
  const { data, error } = await db.from("carts").select("id").eq("user_id", userId).maybeSingle();
  if (error) throw fromDbError(error);
  return data?.id ?? null;
}

async function ensureCartId(db: Db, userId: string): Promise<string> {
  const existing = await findCartId(db, userId);
  if (existing) return existing;
  const { data, error } = await db.from("carts").insert({ user_id: userId }).select("id").single();
  if (error?.code === "23505") {
    // Created concurrently (e.g. two tabs): use that one.
    const cartId = await findCartId(db, userId);
    if (cartId) return cartId;
  }
  if (error || !data) throw fromDbError(error);
  return data.id;
}

async function readAccountLines(db: Db, userId: string): Promise<CartLine[]> {
  const cartId = await findCartId(db, userId);
  if (!cartId) return [];
  const { data, error } = await db
    .from("cart_items")
    .select("weekly_menu_product_id, quantity")
    .eq("cart_id", cartId)
    .order("created_at");
  if (error) throw fromDbError(error);
  return data.map((row) => ({ productId: row.weekly_menu_product_id, quantity: row.quantity }));
}

async function setAccountLine(db: Db, userId: string, productId: string, quantity: number) {
  const cartId = await ensureCartId(db, userId);
  const { data: updated, error } = await db
    .from("cart_items")
    .update({ quantity })
    .eq("cart_id", cartId)
    .eq("weekly_menu_product_id", productId)
    .select("id");
  if (error) throw fromDbError(error);
  if (updated.length > 0) return;
  const { error: insertError } = await db
    .from("cart_items")
    .insert({ cart_id: cartId, weekly_menu_product_id: productId, quantity });
  if (insertError) {
    throw fromDbError(insertError, { "42501": "This product can't be added right now." });
  }
}

async function deleteAccountLines(db: Db, userId: string, productId?: string) {
  const cartId = await findCartId(db, userId);
  if (!cartId) return;
  let query = db.from("cart_items").delete().eq("cart_id", cartId);
  if (productId) query = query.eq("weekly_menu_product_id", productId);
  const { error } = await query;
  if (error) throw fromDbError(error);
}

type Owner = { kind: "guest" } | { kind: "customer"; userId: string; db: Db };

async function currentOwner(): Promise<Owner> {
  const user = await getCurrentUser();
  if (!user) return { kind: "guest" };
  return { kind: "customer", userId: user.id, db: await createSupabaseServerClient() };
}

async function readLines(owner: Owner): Promise<CartLine[]> {
  return owner.kind === "guest" ? readGuestLines() : readAccountLines(owner.db, owner.userId);
}

async function setLine(owner: Owner, lines: CartLine[], productId: string, quantity: number) {
  if (owner.kind === "customer") return setAccountLine(owner.db, owner.userId, productId, quantity);
  const next = lines.some((line) => line.productId === productId)
    ? lines.map((line) => (line.productId === productId ? { productId, quantity } : line))
    : [...lines, { productId, quantity }];
  return writeGuestLines(next);
}

// ---------------------------------------------------------------------
// Operations (API contract §7)
// ---------------------------------------------------------------------

/** Cart with server-calculated prices, availability issues and subtotal. Cached per request. */
export const getCart = cache(async (): Promise<EvaluatedCart> => {
  const [lines, facts] = await Promise.all([readLines(await currentOwner()), menuFacts()]);
  return evaluateCart(lines, facts);
});

function requireBuyable(facts: MenuFacts | undefined): MenuFacts {
  if (!facts) throw new AppError("PRODUCT_UNAVAILABLE", "This product isn't on this week's menu.");
  if (facts.status === "SOLD_OUT") throw new AppError("OUT_OF_STOCK", "Sorry, this product is sold out.");
  return facts;
}

export async function addToCart(productId: string, quantity: number): Promise<void> {
  const owner = await currentOwner();
  const [lines, facts] = await Promise.all([readLines(owner), menuFacts()]);
  const product = requireBuyable(facts.get(productId));

  const inCart = lines.find((line) => line.productId === productId)?.quantity ?? 0;
  const requested = inCart + quantity;
  if (requested > product.available) {
    throw new AppError(
      "OUT_OF_STOCK",
      inCart > 0
        ? `Only ${product.available} available, and you already have ${inCart} in your cart.`
        : `Only ${product.available} available.`
    );
  }
  if (requested > MAX_LINE_QUANTITY) throw new AppError("VALIDATION_ERROR", "That quantity is too large.");
  if (inCart === 0 && lines.length >= MAX_CART_LINES) {
    throw new AppError("VALIDATION_ERROR", "Your cart is full. Please remove something first.");
  }
  await setLine(owner, lines, productId, requested);
}

export async function updateCartItem(productId: string, quantity: number): Promise<void> {
  const owner = await currentOwner();
  const [lines, facts] = await Promise.all([readLines(owner), menuFacts()]);
  if (!lines.some((line) => line.productId === productId)) {
    throw new AppError("NOT_FOUND", "That item isn't in your cart.");
  }
  const product = requireBuyable(facts.get(productId));
  if (quantity > product.available) {
    throw new AppError("OUT_OF_STOCK", `Only ${product.available} available.`);
  }
  await setLine(owner, lines, productId, quantity);
}

export async function removeCartItem(productId: string): Promise<void> {
  const owner = await currentOwner();
  if (owner.kind === "customer") return deleteAccountLines(owner.db, owner.userId, productId);
  const lines = await readGuestLines();
  await writeGuestLines(lines.filter((line) => line.productId !== productId));
}

export async function clearCart(): Promise<void> {
  const owner = await currentOwner();
  if (owner.kind === "customer") return deleteAccountLines(owner.db, owner.userId);
  await writeGuestLines([]);
}

// ---------------------------------------------------------------------
// Sign-in merge (owner decision): combine, cap at availability, tell the customer
// ---------------------------------------------------------------------

/**
 * Moves the guest cookie cart into the signed-in customer's cart. `db` must be
 * the client that just established the session (so RLS sees the new user).
 */
export async function mergeGuestCartIntoAccount(db: Db, userId: string): Promise<void> {
  const guest = await readGuestLines();
  if (guest.length === 0) return;

  const [account, facts] = await Promise.all([readAccountLines(db, userId), menuFacts()]);
  const result = mergeCarts(account, guest, facts);
  const guestIds = new Set(guest.map((line) => line.productId));

  for (const line of result.lines) {
    if (guestIds.has(line.productId) && line.quantity > 0) {
      await setAccountLine(db, userId, line.productId, line.quantity);
    }
  }

  const store = await cookies();
  store.delete(GUEST_CART_COOKIE);
  if (result.capped.length > 0 || result.dropped.length > 0) {
    store.set(
      CART_NOTICE_COOKIE,
      JSON.stringify({ capped: result.capped.slice(0, 10), dropped: result.dropped.slice(0, 10) }),
      { ...cookieOptions, maxAge: 60 * 10 }
    );
  }
}

export type CartNotice = { capped: string[]; dropped: string[] };

export async function readCartNotice(): Promise<CartNotice | null> {
  const raw = (await cookies()).get(CART_NOTICE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as CartNotice;
    if (!Array.isArray(value.capped) || !Array.isArray(value.dropped)) return null;
    return {
      capped: value.capped.filter((name) => typeof name === "string"),
      dropped: value.dropped.filter((name) => typeof name === "string"),
    };
  } catch {
    return null;
  }
}

export async function dismissCartNotice(): Promise<void> {
  (await cookies()).delete(CART_NOTICE_COOKIE);
}
