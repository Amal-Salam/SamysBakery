"use server";

import { revalidatePath } from "next/cache";

import { addInventory } from "@/features/inventory/service";
import { ok, toFailure, validationFailure } from "@/lib/errors";
import { assertAdmin } from "@/lib/security/auth";
import { addInventorySchema } from "@/schemas/inventory";
import type { ActionResult } from "@/types/api";

export async function addInventoryAction(
  _prev: ActionResult<{ available: number; added: number }> | null,
  formData: FormData
): Promise<ActionResult<{ available: number; added: number }>> {
  try {
    await assertAdmin();
    const parsed = addInventorySchema.safeParse({
      weeklyMenuProductId: formData.get("weeklyMenuProductId"),
      quantity: formData.get("quantity"),
      reason: formData.get("reason") ?? "",
    });
    if (!parsed.success) return validationFailure(parsed.error);
    const { weeklyMenuProductId, quantity, reason } = parsed.data;
    const available = await addInventory(weeklyMenuProductId, quantity, reason);
    revalidatePath("/admin/inventory");
    revalidatePath("/admin");
    revalidatePath("/", "layout");
    return ok({ available, added: quantity });
  } catch (error) {
    return toFailure(error);
  }
}
