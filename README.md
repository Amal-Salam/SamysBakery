# Samy's Bakery v2

Online storefront and admin system for Samy's Bakery, an artisanal micro-bakery in Abuja.

Read [AGENTS.md](AGENTS.md) and the specifications in [docs/](docs/) before contributing.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui (Radix) · Supabase · Paystack · Resend · Zod · Vitest · Playwright

## Getting started

Requires Node.js 24+.

```bash
npm install
cp .env.example .env.local   # fill in values; never commit .env.local
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command             | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Start the development server              |
| `npm run build`     | Production build                          |
| `npm run start`     | Serve the production build                |
| `npm run lint`      | ESLint                                    |
| `npm run typecheck` | TypeScript type check                     |
| `npm test`          | Unit tests (Vitest, offline)              |
| `npm run test:db`   | Integration + security tests (linked Supabase; creates and removes throwaway users) |
| `npm run test:e2e`  | End-to-end tests (Playwright)             |
| `npm run db:push`   | Apply migrations to the linked Supabase project |
| `npm run db:types`  | Regenerate `types/database.ts` from the linked project |
| `npm run admin:promote` | Promote `ADMIN_BOOTSTRAP_EMAIL` (or an email argument) to ADMIN |

First-time E2E setup: `npx playwright install chromium`.

## Supabase

Link the CLI once, in your own terminal (credentials stay in your keychain):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push
```

In the Supabase dashboard → Authentication → URL Configuration, add
`<NEXT_PUBLIC_APP_URL>/auth/callback` to the redirect allow-list.

## Admin accounts

There is one admin role. To create an admin: sign up normally, verify the email, then run
`npm run admin:promote` (uses `ADMIN_BOOTSTRAP_EMAIL`) or `npm run admin:promote -- someone@example.com`.

## Design tokens

All colours, fonts, type scale and radii are defined once in [app/globals.css](app/globals.css) (`@theme`). Tailwind's default palette is disabled, so only approved tokens are available. Change tokens there, never in components.
