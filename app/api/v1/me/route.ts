import { apiRoute } from "@/lib/api/handler";

// GET /api/v1/me — the signed-in customer (role from profiles, never the token).
export const GET = apiRoute({ auth: "required" }, async ({ user }) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  phone: user.phone,
  role: user.role,
}));
