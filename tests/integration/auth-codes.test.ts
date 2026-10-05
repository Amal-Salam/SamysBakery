import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { anonClient, serviceClient } from "../security/helpers";

// Email codes for the mobile app (A3). The same emails keep the link the
// website uses and add a 6-digit code the app types in. Reads the local
// Supabase mail catcher.

const MAILPIT = "http://127.0.0.1:54324";

async function latestEmail(to: string): Promise<{ subject: string; html: string }> {
  for (let i = 0; i < 40; i += 1) {
    const { messages } = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json()) as {
      messages: { ID: string; Subject: string }[];
    };
    if (messages.length > 0) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { HTML: string; Subject: string };
      return { subject: message.Subject, html: message.HTML };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("no email arrived");
}

function codeFrom(html: string): string {
  const match = html.match(/>\s*(\d{6})\s*</);
  if (!match) throw new Error("no 6-digit code in the email");
  return match[1];
}

describe("sign-up with an emailed code", () => {
  it("the confirmation email has both the website link and a 6-digit code; the code signs the customer in", async () => {
    const email = `code-signup-${randomUUID()}@example.com`;
    const client = anonClient();
    const { error } = await client.auth.signUp({ email, password: "a-strong-password-1", options: { data: { full_name: "Code Customer" } } });
    expect(error).toBeNull();

    const message = await latestEmail(email);
    expect(message.subject).toBe("Confirm your Samy's Bakery account");
    expect(message.html).toMatch(/\/auth\/v1\/verify\?[^"']*type=signup/); // the website's link is still there
    const code = codeFrom(message.html);

    // A wrong code is refused; the right one verifies the email and signs in.
    const wrong = await client.auth.verifyOtp({ email, token: code === "000000" ? "111111" : "000000", type: "signup" });
    expect(wrong.error).not.toBeNull();
    const { data, error: verifyError } = await client.auth.verifyOtp({ email, token: code, type: "signup" });
    expect(verifyError).toBeNull();
    expect(data.session?.access_token).toBeTruthy();

    const { data: profile } = await serviceClient().from("profiles").select("full_name, role").eq("id", data.user!.id).single();
    expect(profile).toEqual({ full_name: "Code Customer", role: "CUSTOMER" });
    const { data: user } = await serviceClient().auth.admin.getUserById(data.user!.id);
    expect(user.user?.email_confirmed_at).toBeTruthy();
  });
});

describe("password reset with an emailed code", () => {
  it("the reset email has both the website link and a code; the code allows setting a new password", async () => {
    const email = `code-reset-${randomUUID()}@example.com`;
    const { data: created } = await serviceClient().auth.admin.createUser({ email, password: "old-password-1", email_confirm: true });
    expect(created.user).toBeTruthy();

    const client = anonClient();
    expect((await client.auth.resetPasswordForEmail(email)).error).toBeNull();
    const message = await latestEmail(email);
    expect(message.subject).toBe("Reset your Samy's Bakery password");
    expect(message.html).toMatch(/\/auth\/v1\/verify\?[^"']*type=recovery/);
    const code = codeFrom(message.html);

    const { error } = await client.auth.verifyOtp({ email, token: code, type: "recovery" });
    expect(error).toBeNull();
    expect((await client.auth.updateUser({ password: "new-password-2" })).error).toBeNull();

    const fresh = anonClient();
    expect((await fresh.auth.signInWithPassword({ email, password: "old-password-1" })).error).not.toBeNull();
    expect((await fresh.auth.signInWithPassword({ email, password: "new-password-2" })).error).toBeNull();

    // A used code can't be used again.
    const reuse = await anonClient().auth.verifyOtp({ email, token: code, type: "recovery" });
    expect(reuse.error).not.toBeNull();
  });
});
