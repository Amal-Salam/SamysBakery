import "server-only";

import { z } from "zod";

import { AppError } from "@/lib/errors";

const UUID = z.uuid();

export function idFrom(params: Record<string, string | string[] | undefined>, key: string, label: string): string {
  const parsed = UUID.safeParse(params[key]);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", `Invalid ${label}.`);
  return parsed.data;
}
