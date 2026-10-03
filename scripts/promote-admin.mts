// Operator-only: promote an existing account to ADMIN (Database.md §2:
// "Admin accounts are manually seeded during deployment").
//
// Usage:  npm run admin:promote            (uses ADMIN_BOOTSTRAP_EMAIL)
//         npm run admin:promote -- a@b.com
//
// The user must already have signed up (and verified their email). The app never
// grants admin based on email at runtime — this only sets profiles.role once.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.argv[2] ?? process.env.ADMIN_BOOTSTRAP_EMAIL ?? "")
  .trim()
  .toLowerCase();

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!email) {
  console.error("Provide an email argument or set ADMIN_BOOTSTRAP_EMAIL.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserIdByEmail(target: string): Promise<string | null> {
  const perPage = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error("Could not list users.");
    const match = data.users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
}

const userId = await findUserIdByEmail(email);
if (!userId) {
  console.error("No account found for that email. Sign up first, then re-run.");
  process.exit(1);
}

const { data, error } = await supabase
  .from("profiles")
  .update({ role: "ADMIN" })
  .eq("id", userId)
  .select("id")
  .maybeSingle();

if (error || !data) {
  console.error("Could not update the profile role.");
  process.exit(1);
}

console.log("Account promoted to ADMIN.");
