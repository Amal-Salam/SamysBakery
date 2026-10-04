import * as WebBrowser from "expo-web-browser";

import { config } from "@/config";

/**
 * Opens a page of the Samy's Bakery website in a secure in-app browser tab
 * (Chrome Custom Tab) — used for flows that stay on the web in v1
 * (registration, password reset, addresses, profile). Paths are fixed here,
 * never built from user input.
 */
const PAGES = {
  register: "/login?mode=register",
  resetPassword: "/reset-password",
  addresses: "/account/addresses",
  profile: "/account/profile",
} as const;

export function openWebsite(page: keyof typeof PAGES) {
  return WebBrowser.openBrowserAsync(`${config.apiUrl}${PAGES[page]}`);
}
