import { z } from "zod";

import { deleteMyAccount, updateProfile } from "@/features/customers/profile";
import { readJson } from "@/lib/api/body";
import { apiRoute } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { DELETE_CONFIRMATION_PHRASE, profileInputSchema } from "@/schemas/profile";

// GET /api/v1/me — the signed-in customer (role from profiles, never the token).
export const GET = apiRoute({ auth: "required" }, async ({ user }) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  phone: user.phone,
  role: user.role,
}));

// PATCH /api/v1/me { fullName, phone } — edit name and phone only (same rules
// as the website; column grants make role and email unchangeable here).
export const PATCH = apiRoute({ auth: "required" }, async ({ request, user }) => {
  const input = await readJson(request, profileInputSchema);
  await updateProfile(user.id, input);
  return { id: user.id, email: user.email, fullName: input.fullName, phone: input.phone, role: user.role };
});

const deleteSchema = z.object({ confirmation: z.string() });

// DELETE /api/v1/me { confirmation: "DELETE" } — delete + anonymize, in one
// database transaction (owner decision). Blocked while an order or payment is
// in progress, exactly as on the website.
export const DELETE = apiRoute({ auth: "required" }, async ({ request }) => {
  const { confirmation } = await readJson(request, deleteSchema);
  if (confirmation.trim() !== DELETE_CONFIRMATION_PHRASE) {
    throw new AppError("VALIDATION_ERROR", `Type ${DELETE_CONFIRMATION_PHRASE} to confirm.`);
  }
  await deleteMyAccount();
  return null;
});
