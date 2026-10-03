// Pure cart rules (no I/O). The cart never reserves stock and never trusts
// client prices: every read is evaluated against current server-side menu data.

import { z } from "zod";

import type { AvailabilityStatus } from "@/features/inventory/rules";

export const MAX_LINE_QUANTITY = 1000;
export const MAX_CART_LINES = 50;

/** A cart line as stored: weekly-menu product id + quantity. Nothing else. */
export type CartLine = { productId: string; quantity: number };

const guestCartSchema = z
  .array(
    z.object({
      p: z.uuid(),
      q: z.number().int().min(1).max(MAX_LINE_QUANTITY),
    })
  )
  .max(MAX_CART_LINES);

/** Parses the guest-cart cookie. Anything malformed or tampered is discarded. */
export function parseGuestCart(raw: string | undefined): CartLine[] {
  if (!raw) return [];
  try {
    const parsed = guestCartSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    return combineLines(parsed.data.map((line) => ({ productId: line.p, quantity: line.q })));
  } catch {
    return [];
  }
}

export function serializeGuestCart(lines: CartLine[]): string {
  return JSON.stringify(lines.map((line) => ({ p: line.productId, q: line.quantity })));
}

/** Same products combine quantities (spec), preserving first-seen order. */
export function combineLines(lines: CartLine[]): CartLine[] {
  const combined = new Map<string, number>();
  for (const line of lines) {
    combined.set(line.productId, Math.min(MAX_LINE_QUANTITY, (combined.get(line.productId) ?? 0) + line.quantity));
  }
  return [...combined.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

/** Current server-side facts about a weekly-menu product on the published menu. */
export type MenuFacts = {
  name: string;
  slug: string;
  price: number;
  image: { path: string; alt: string } | null;
  available: number;
  status: AvailabilityStatus;
};

export type CartItemIssue = "UNAVAILABLE" | "SOLD_OUT" | "EXCEEDS_AVAILABLE";

export type CartItem = {
  productId: string;
  quantity: number;
  name: string;
  slug: string | null;
  image: { path: string; alt: string } | null;
  unitPrice: number | null;
  lineTotal: number | null;
  available: number;
  issue: CartItemIssue | null;
};

export type EvaluatedCart = {
  items: CartItem[];
  /** Server-calculated from current prices; only lines that can be bought. */
  subtotal: number;
  itemCount: number;
  canCheckout: boolean;
};

/** Money in kobo to avoid floating-point drift. */
const toKobo = (naira: number) => Math.round(naira * 100);

export function evaluateCart(lines: CartLine[], menu: ReadonlyMap<string, MenuFacts>): EvaluatedCart {
  let subtotalKobo = 0;
  const items = lines.map((line): CartItem => {
    const facts = menu.get(line.productId);
    if (!facts) {
      return {
        productId: line.productId,
        quantity: line.quantity,
        name: "This product is no longer on the menu",
        slug: null,
        image: null,
        unitPrice: null,
        lineTotal: null,
        available: 0,
        issue: "UNAVAILABLE",
      };
    }
    const issue: CartItemIssue | null =
      facts.status === "SOLD_OUT" ? "SOLD_OUT" : line.quantity > facts.available ? "EXCEEDS_AVAILABLE" : null;
    const lineKobo = toKobo(facts.price) * line.quantity;
    if (!issue) subtotalKobo += lineKobo;
    return {
      productId: line.productId,
      quantity: line.quantity,
      name: facts.name,
      slug: facts.slug,
      image: facts.image,
      unitPrice: facts.price,
      lineTotal: lineKobo / 100,
      available: facts.available,
      issue,
    };
  });

  return {
    items,
    subtotal: subtotalKobo / 100,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    canCheckout: items.length > 0 && items.every((item) => item.issue === null),
  };
}

export type MergeResult = {
  lines: CartLine[];
  capped: string[];
  dropped: string[];
};

/**
 * Merges a guest cart into an account cart (owner decision): quantities combine,
 * capped at availability; products no longer buyable are dropped. Reports both
 * so the customer can be told.
 */
export function mergeCarts(
  account: CartLine[],
  guest: CartLine[],
  menu: ReadonlyMap<string, MenuFacts>
): MergeResult {
  const capped: string[] = [];
  const dropped: string[] = [];
  const guestIds = new Set(guest.map((line) => line.productId));
  const lines: CartLine[] = [];

  for (const line of combineLines([...account, ...guest])) {
    const facts = menu.get(line.productId);
    // Only judge lines the guest contributed; leave the account's own lines as they were.
    if (!guestIds.has(line.productId)) {
      lines.push(line);
      continue;
    }
    if (!facts || facts.status === "SOLD_OUT") {
      const accountLine = account.find((existing) => existing.productId === line.productId);
      if (accountLine) lines.push(accountLine);
      dropped.push(facts?.name ?? "A product that is no longer on the menu");
      continue;
    }
    if (line.quantity > facts.available) {
      capped.push(facts.name);
      lines.push({ productId: line.productId, quantity: facts.available });
      continue;
    }
    lines.push(line);
  }
  return { lines, capped, dropped };
}

export function cartIssueMessage(item: CartItem): string | null {
  switch (item.issue) {
    case "UNAVAILABLE":
      return "No longer available — please remove it.";
    case "SOLD_OUT":
      return "Sold out — please remove it.";
    case "EXCEEDS_AVAILABLE":
      return `Only ${item.available} available — please reduce the quantity.`;
    default:
      return null;
  }
}
