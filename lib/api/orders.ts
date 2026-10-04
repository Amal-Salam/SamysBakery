import "server-only";

import { z } from "zod";

import { AppError } from "@/lib/errors";

const ORDER_NUMBER = z.string().regex(/^SAM-\d{4,}$/);

export function orderNumberFrom(params: Record<string, string | string[] | undefined>): string {
  const parsed = ORDER_NUMBER.safeParse(params.orderNumber);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid order.");
  return parsed.data;
}
