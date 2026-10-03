"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addProductImage,
  archiveProduct,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProductImage,
  moveCategory,
  moveProductImage,
  renameCategory,
  updateProduct,
  updateProductImageAlt,
} from "@/features/products/service";
import { fail, ok, toFailure, validationFailure } from "@/lib/errors";
import { assertAdmin } from "@/lib/security/auth";
import {
  categoryInputSchema,
  moveDirectionSchema,
  productImageMetaSchema,
  productInputSchema,
  uuidSchema,
} from "@/schemas/product";
import type { ActionResult } from "@/types/api";

// Request → Authentication/Authorization (assertAdmin) → Zod validation →
// business rules + database (service/RLS/functions) → standard result.

const LIBRARY_PATH = "/admin/products";

function productFields(formData: FormData) {
  return {
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    description: formData.get("description") ?? "",
    ingredients: formData.get("ingredients") ?? "",
  };
}

function parseId(value: FormDataEntryValue | null) {
  return uuidSchema.safeParse(value);
}

export async function createProductAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  let productId: string;
  try {
    await assertAdmin();
    const parsed = productInputSchema.safeParse(productFields(formData));
    if (!parsed.success) return validationFailure(parsed.error);
    ({ id: productId } = await createProduct(parsed.data));
  } catch (error) {
    return toFailure(error);
  }
  revalidatePath(LIBRARY_PATH);
  redirect(`${LIBRARY_PATH}/${productId}?created=1`);
}

export async function updateProductAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = parseId(formData.get("id"));
    if (!id.success) return fail("VALIDATION_ERROR", "Invalid product.");
    const parsed = productInputSchema.safeParse(productFields(formData));
    if (!parsed.success) return validationFailure(parsed.error);
    await updateProduct(id.data, parsed.data);
    revalidatePath(LIBRARY_PATH);
    revalidatePath(`${LIBRARY_PATH}/${id.data}`);
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function archiveProductAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = parseId(formData.get("id"));
    if (!id.success) return fail("VALIDATION_ERROR", "Invalid product.");
    if (formData.get("confirm") !== "yes") {
      return fail("VALIDATION_ERROR", "Please confirm the deletion.");
    }
    await archiveProduct(id.data);
  } catch (error) {
    return toFailure(error);
  }
  revalidatePath(LIBRARY_PATH);
  redirect(`${LIBRARY_PATH}?deleted=1`);
}

export async function addProductImageAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const productId = parseId(formData.get("productId"));
    if (!productId.success) return fail("VALIDATION_ERROR", "Invalid product.");
    const meta = productImageMetaSchema.safeParse({ altText: formData.get("altText") ?? "" });
    if (!meta.success) return validationFailure(meta.error);
    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return fail("VALIDATION_ERROR", "Choose a photo to upload.", { photo: ["Choose a photo to upload."] });
    }
    await addProductImage(productId.data, file, meta.data.altText);
    revalidatePath(`${LIBRARY_PATH}/${productId.data}`);
    revalidatePath(LIBRARY_PATH);
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function updateProductImageAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const imageId = parseId(formData.get("imageId"));
    const productId = parseId(formData.get("productId"));
    if (!imageId.success || !productId.success) return fail("VALIDATION_ERROR", "Invalid photo.");
    const meta = productImageMetaSchema.safeParse({ altText: formData.get("altText") ?? "" });
    if (!meta.success) return validationFailure(meta.error);
    await updateProductImageAlt(imageId.data, meta.data.altText);
    revalidatePath(`${LIBRARY_PATH}/${productId.data}`);
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function moveProductImageAction(formData: FormData): Promise<void> {
  await runSimpleAdminAction(async () => {
    const imageId = uuidSchema.parse(formData.get("imageId"));
    const productId = uuidSchema.parse(formData.get("productId"));
    await moveProductImage(imageId, moveDirectionSchema.parse(formData.get("direction")));
    revalidatePath(`${LIBRARY_PATH}/${productId}`);
    revalidatePath(LIBRARY_PATH);
  });
}

export async function deleteProductImageAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const imageId = parseId(formData.get("imageId"));
    const productId = parseId(formData.get("productId"));
    if (!imageId.success || !productId.success) return fail("VALIDATION_ERROR", "Invalid photo.");
    await deleteProductImage(imageId.data);
    revalidatePath(`${LIBRARY_PATH}/${productId.data}`);
    revalidatePath(LIBRARY_PATH);
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

// ---------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------

export async function createCategoryAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const parsed = categoryInputSchema.safeParse({ name: formData.get("name") ?? "" });
    if (!parsed.success) return validationFailure(parsed.error);
    await createCategory(parsed.data.name);
    revalidatePath(LIBRARY_PATH);
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function renameCategoryAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = parseId(formData.get("id"));
    if (!id.success) return fail("VALIDATION_ERROR", "Invalid category.");
    const parsed = categoryInputSchema.safeParse({ name: formData.get("name") ?? "" });
    if (!parsed.success) return validationFailure(parsed.error);
    await renameCategory(id.data, parsed.data.name);
    revalidatePath(LIBRARY_PATH);
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

export async function moveCategoryAction(formData: FormData): Promise<void> {
  await runSimpleAdminAction(async () => {
    const id = uuidSchema.parse(formData.get("id"));
    await moveCategory(id, moveDirectionSchema.parse(formData.get("direction")));
    revalidatePath(LIBRARY_PATH);
  });
}

export async function deleteCategoryAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = parseId(formData.get("id"));
    if (!id.success) return fail("VALIDATION_ERROR", "Invalid category.");
    await deleteCategory(id.data);
    revalidatePath(LIBRARY_PATH);
    return ok(null);
  } catch (error) {
    return toFailure(error);
  }
}

/** For small reorder buttons with no form state: authorize, run, log failures safely. */
async function runSimpleAdminAction(run: () => Promise<void>) {
  try {
    await assertAdmin();
    await run();
  } catch (error) {
    toFailure(error);
  }
}
