import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

// Integration/security tests run against the linked Supabase project.
// They create throwaway users (@example.com, pre-confirmed — no email is sent)
// and remove them in cleanup.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for security tests (.env.local).`);
  return value;
}

const url = () => requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = () => requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

export function serviceClient(): SupabaseClient<Database> {
  return createClient<Database>(url(), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: noSession,
  });
}

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(url(), publishableKey(), { auth: noSession });
}

export type TestUser = {
  id: string;
  email: string;
  client: SupabaseClient<Database>;
};

export async function createTestUser(fullName: string): Promise<TestUser> {
  const email = `sb-test-${randomUUID()}@example.com`;
  const password = `pw-${randomUUID()}`;

  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`);

  return { id: data.user.id, email, client };
}

export async function deleteTestUsers(users: TestUser[]) {
  const service = serviceClient();
  for (const user of users) {
    await user.client.auth.signOut();
    // profiles → auth.users is ON DELETE RESTRICT (history must never cascade away),
    // so remove the test profile first.
    await service.from("profiles").delete().eq("id", user.id);
    await service.auth.admin.deleteUser(user.id);
  }
}
