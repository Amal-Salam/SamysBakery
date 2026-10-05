# Samy's Bakery — Android app

Customer app (Expo / React Native). It uses the website's API (`/api/v1`) and the same
Supabase database, so carts, orders and accounts are shared with the website.

## Run on your phone

1. Start the website and local database (see the [main README](../README.md)), with the
   website reachable on your Wi-Fi.
2. Create `mobile/.env.local` from `.env.example`. **Public values only**: the API
   address, the Supabase address and the *publishable* key. The app refuses a secret key.
3. Run:

   ```bash
   npm install
   npx expo start --lan
   ```

4. Open the **Expo Go** app on an Android phone on the same Wi-Fi and enter the `exp://…`
   address shown.

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests |
| `npm run typecheck` · `npm run lint` | Code checks |
| `npm run export:android` | Build the Android bundle (checks it compiles) |

## Good to know

- **In the app:** menu, cart (live-synced with the website), checkout, Paystack (secure browser tab), orders, cancel, account, addresses, profile, sign-up and password reset with 6-digit email codes.
- **Not in the app:** Google sign-in and admin pages.
- **App icon and splash** are a temporary "S" monogram, see [assets/BRANDING.md](assets/BRANDING.md).
- **Before the Play Store:** confirm the Android package name in `app.json`, add a real logo and a privacy policy.
