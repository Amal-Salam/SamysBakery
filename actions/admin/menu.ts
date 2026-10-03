"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addProductFromLibrary,
  createWeek,
  publishMenu,
  removeMenuProduct,
  unpublishMenu,
  updateMenuProduct,
} from "@/features/weekly-menu/service";
import { fail, ok, toFailure, validationFailure } from "@/lib/errors";
import { assertAdmin } from "@/lib/security/auth";
import { uuidSchema } from "@/schemas/product";
import { addMenuProductSchema, updateMenuProductSchema } from "@/schemas/weekly-menu";
import type { ActionResult } from "@/types/api";

const MENU_PATH = "/admin/menu";

/** Menu changes affect the storefront and the Product Library status badges. */
function revalidateMenuViews() {
  revalidatePath(MENU_PATH);
  revalidatePath("/admin/products", "layout");
  revalidatePath("/", "layout");
}

export async function createWeekAction(): Promise<ActionResult> {
  try {
    await assertAdmin();
    await createWeek();
  } catch (error) {
    return toFailure(error);
  }
  revalidateMenuViews();
  redirect(`${MENU_PATH}?created=1`);
}

export async function publishMenuAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const menuId = uuidSchema.safeParse(formData.get("menuId"));
    if (!menuId.success) return fail("VALIDATION_ERROR", "Invalid menu.");
    if (formData.get("confirm") !== "yes") return fail("VALIDATION_ERROR", "Please confirm publishing.");
    await publishMenu(menuId.data);
    revalidateMenuViews();
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function unpublishMenuAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const menuId = uuidSchema.safeParse(formData.get("menuId"));
    if (!menuId.success) return fail("VALIDATION_ERROR", "Invalid menu.");
    if (formData.get("confirm") !== "yes") return fail("VALIDATION_ERROR", "Please confirm unpublishing.");
    await unpublishMenu(menuId.data);
    revalidateMenuViews();
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function addMenuProductAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const parsed = addMenuProductSchema.safeParse({
      menuId: formData.get("menuId"),
      productId: formData.get("productId") ?? "",
      price: formData.get("price") ?? "",
      weeklyQuantity: formData.get("weeklyQuantity") ?? "",
      lowStockThreshold: formData.get("lowStockThreshold") ?? "",
    });
    if (!parsed.success) return validationFailure(parsed.error);
    await addProductFromLibrary(parsed.data);
    revalidateMenuViews();
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function updateMenuProductAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const parsed = updateMenuProductSchema.safeParse({
      id: formData.get("id"),
      name: formData.get("name") ?? "",
      price: formData.get("price") ?? "",
      weeklyQuantity: formData.get("weeklyQuantity") ?? "",
      lowStockThreshold: formData.get("lowStockThreshold") ?? "",
      description: formData.get("description") ?? "",
      ingredients: formData.get("ingredients") ?? "",
      imageSnapshot: formData.get("imageSnapshot") ?? "",
    });
    if (!parsed.success) return validationFailure(parsed.error);
    await updateMenuProduct(parsed.data);
    revalidateMenuViews();
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function removeMenuProductAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = uuidSchema.safeParse(formData.get("id"));
    if (!id.success) return fail("VALIDATION_ERROR", "Invalid menu product.");
    await removeMenuProduct(id.data);
    revalidateMenuViews();
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}
