# Samy's Bakery

Online storefront and admin for Samy's Bakery, an artisanal micro-bakery.
Customers order from a weekly menu and pay with Paystack; delivery is arranged separately.

**Stack:** Next.js · TypeScript · Tailwind · Supabase (database, auth, storage) · Paystack · Resend.
The Android app lives in [mobile/](mobile/README.md). Project rules: [AGENTS.md](AGENTS.md).

## Run locally

Needs Node.js 24+ and Docker.

```bash
npm install
cp .env.example .env.local   # fill in values; never commit it
npx supabase start           # local database, auth and mail catcher (http://127.0.0.1:54324)
npm run dev                  # http://localhost:3000
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run lint` · `npm run typecheck` | Code checks |
| `npm test` | Unit tests (offline) |
| `npm run test:db` | Integration and security tests (local database) |
| `npm run test:schema` | Database tests (local database) |
| `npm run test:e2e` | Browser tests (local database; first run `npx playwright install chromium`) |
| `npm run build` | Production build |
| `npm run db:push` | Apply migrations to the linked Supabase project |
| `npm run admin:promote -- you@example.com` | Make an existing account an admin |

What each test covers: [tests/README.md](tests/README.md).

## Good to know

- **Mobile API:** `/api/v1` serves the mobile app (bearer-token sign-in, same rules as the website).
- **Emails:** sign-up and password-reset templates are in `supabase/templates/` (link for the website, 6-digit code for the app).
- **Design tokens:** colours and fonts live only in `app/globals.css`.
- **Deploying:** see [DEPLOYMENT.md](DEPLOYMENT.md).
