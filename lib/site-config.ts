// Business details shown on the storefront, kept in one place.
//
// ⚠ BEFORE LAUNCH: the social links below are DUMMY placeholders (owner
// decision 2026-10-03) and must be replaced with the real profile URLs.
// Phone and email are intentionally omitted until real details are provided.

export const SITE = {
  name: "Samy's Bakery",
  tagline: "Artisanal bakes. Exciting flavours. Fresh every week.",
  hours: "Tuesday – Saturday: 8:00 AM – 6:00 PM",
  social: [
    { label: "Instagram", href: "https://www.instagram.com/", placeholder: true },
    { label: "TikTok", href: "https://www.tiktok.com/", placeholder: true },
    { label: "WhatsApp", href: "https://www.whatsapp.com/", placeholder: true },
  ],
} as const;
