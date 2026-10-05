# Deployment

Production runs on **Vercel** (app) + **Supabase** (database, auth, photos) + **Paystack**
(payments) + **Resend** (order emails). Secrets live only in the Vercel and provider
dashboards — never in this repository.

Current plan (owner decisions, Milestone 20):

- The existing hosted Supabase project is production.
- Paystack runs in **test mode** until the production smoke test passes and Paystack has
  approved the business; then switch to live keys (see “Going live”).
- The site starts on its `*.vercel.app` address; the `.shop` domain comes later.

Everywhere below, `APP_URL` means the site's address, e.g. `https://bakedgoodies.vercel.app`.

## 1. Database (Supabase)

All migrations are applied with `npm run db:push` (from a linked checkout). Check with
`npx supabase migration list --linked`: every local migration must have a remote match.
Scheduled jobs (`pg_cron`) expire ended menus hourly and expired payment holds every minute.

> Once real customers use the site, do **not** run `npm run test:schema:linked` against it.
> The tests roll back, but they still consume order numbers and briefly lock tables.

## 2. Vercel

1. vercel.com → **Add New → Project** → import `Amal-Salam/BakedGoodies`. Framework: Next.js
   (detected). Node.js 24 is picked up from `package.json`.
2. **Environment variables** — add for the **Production** environment only (preview
   deployments must never talk to the production database):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_APP_URL` | `APP_URL` (no trailing slash) |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API keys → publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API keys → secret / service-role key |
   | `PAYSTACK_SECRET_KEY` | Paystack → Settings → API Keys → **Test** secret key (`sk_test_…`) |
   | `RESEND_API_KEY` | Resend API key (`re_…`) — once the sending domain is verified |
   | `RESEND_FROM_EMAIL` | e.g. `Samy's Bakery <orders@mail.your-domain.shop>` |
   | `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud → Credentials → OAuth client → Client ID |
   | `GOOGLE_OAUTH_CLIENT_SECRET` | the same OAuth client → Client secret (mark **Sensitive**) |

   Do **not** set `PAYSTACK_API_BASE`, `RESEND_API_BASE`, `GOOGLE_OAUTH_BASE` or `E2E_DISABLE_RATE_LIMITS` —
   they exist only for automated tests.
3. Deploy. If the final address differs from what you set in `NEXT_PUBLIC_APP_URL`, fix the
   variable and **Redeploy**.

Until the Resend variables are set, paid orders still work but confirmation emails are not
sent. An email is only retried when the same payment is processed again (a Paystack webhook
retry or the customer reopening the payment-return link), so orders paid before Resend is
configured will usually never get one.

## 3. Supabase Auth settings (dashboard)

- **Authentication → URL Configuration**
  - Site URL: `APP_URL`
  - Redirect URLs: add `APP_URL/**` (keep `http://localhost:3000/**` for local development).
- **Authentication → Rate Limits**: raise the sign-in/sign-up and token-verification limits.
  Sign-in runs on our server, so Supabase sees one IP for everyone; the app enforces its own
  per-visitor limits (`lib/security/rate-limit.ts`).
- **Authentication → Providers → Email**: minimum password length **8** (the app requires 8).
- **Authentication → Emails → SMTP Settings**: Supabase's built-in email only reaches your
  own team's addresses and is heavily rate-limited, so real customers can't receive
  verification or password-reset emails until custom SMTP is set. Use Resend once the domain
  is verified: host `smtp.resend.com`, port `465`, user `resend`, password = a Resend API key,
  sender = an address on the verified domain.

- **Authentication → Emails → Templates** (needed for the mobile app's 6-digit codes; the
  website keeps working with the links either way):
  - **Confirm signup** — subject `Confirm your Samy's Bakery account`; body: paste the whole of
    `supabase/templates/confirmation.html`.
  - **Reset password** — subject `Reset your Samy's Bakery password`; body: paste the whole of
    `supabase/templates/recovery.html`.
  - Keep **Email OTP length** at 6. If the dashboard says templates need custom SMTP, do this
    right after the Resend SMTP step above.

## 4. Google sign-in

Google sign-in runs on our own domain (`/auth/google`), so Google's screen shows `APP_URL`'s
host, not `<project-ref>.supabase.co`. Our server exchanges the code with Google and then
signs the user in to Supabase with the Google ID token.

1. **Google Cloud → APIs & Services → Credentials → your OAuth client (Web application)**
   - Authorized redirect URIs: add `APP_URL/auth/google/callback` (exact, no trailing slash).
     For local development also add `http://localhost:3000/auth/google/callback`.
   - The old Supabase callback (`https://<project-ref>.supabase.co/auth/v1/callback`) is no
     longer used; remove it once live Google sign-in works.
2. **Supabase → Authentication → Sign In / Providers → Google**: keep it **enabled**, its
   Client ID must be the same OAuth client ID, and leave **Skip nonce checks** off.
3. **Vercel**: set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` (section 2), then
   **Redeploy**. Without them the Google button returns to sign-in with an error.
4. **Google Auth Platform → Branding**: app name, support email, and `APP_URL`'s host under
   Authorized domains. Before opening to the public, set the publishing status to
   **In production** so any Google account can sign in.

## 5. Paystack (test mode)

Paystack → Settings → **API Keys & Webhooks** (Test mode):

- **Test Webhook URL**: `APP_URL/api/paystack/webhook`
- Callback URL can stay empty — the app sends `APP_URL/checkout/complete` with each payment.

Test cards: Paystack's documentation lists them (e.g. a successful Visa test card). No real
money moves in test mode.

## 6. Production smoke test

Run after every first deployment and after switching to live keys
(Implementation Spec §32). Tick each item on the live site.

**Public** — homepage loads · menu loads · product page loads · sold-out state shows · cart
works (add, change quantity, remove).

**Authentication** — register · verification email arrives and works · sign in · Google sign-in
· sign out · password reset email arrives and works.

**Checkout** — address · delivery date (no Sun/Mon; today disappears after the cutoff) ·
subtotal correct · Paystack test payment · confirmation page.

**Orders** — order appears in My orders · admin sees it · admin status update · cancellation
releases stock (Inventory page) · refund flow (test mode).

**Admin** — dashboard · weekly menu · products · inventory · customers · revenue · audit log.

**Email** — order confirmation email received.

## 7. Going live (later)

1. Paystack approves the business → copy the **Live** secret key into `PAYSTACK_SECRET_KEY`
   and set the **Live Webhook URL** to `APP_URL/api/paystack/webhook`. Redeploy.
2. Place one real small order, confirm it, then cancel and refund it from the admin.
3. Moving to the `.shop` domain: add it in Vercel → Domains, add the DNS records Vercel
   shows in GoDaddy, then update `NEXT_PUBLIC_APP_URL`, the Supabase Site URL / Redirect URLs
   and the Paystack webhook URL to the new address, and redeploy.
