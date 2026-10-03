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
| `npm test`          | Unit / integration / security (Vitest)    |
| `npm run test:e2e`  | End-to-end tests (Playwright)             |

First-time E2E setup: `npx playwright install chromium`.

## Design tokens

All colours, fonts, type scale and radii are defined once in [app/globals.css](app/globals.css) (`@theme`). Tailwind's default palette is disabled, so only approved tokens are available. Change tokens there, never in components.
