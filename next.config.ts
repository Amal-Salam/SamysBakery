import type { NextConfig } from "next";

// Product photos are served from the public Supabase Storage bucket.
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321");
const isLocalSupabase = ["127.0.0.1", "localhost"].includes(supabaseUrl.hostname);
const isDev = process.env.NODE_ENV === "development";

// Security headers (Milestone 18). Scripts and styles allow 'unsafe-inline'
// because Next.js inlines its bootstrap; a nonce-based policy would force every
// page to render dynamically. Everything else is locked to our own origin,
// Supabase (API, auth, photos) and, for form posts, Paystack/Google redirects.
const supabaseOrigin = supabaseUrl.origin;
const supabaseSocket = supabaseOrigin.replace(/^http/, "ws");
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin} ${supabaseSocket}`,
  `form-action 'self' ${supabaseOrigin} https://checkout.paystack.com https://accounts.google.com`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev || isLocalSupabase ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ...(isDev || isLocalSupabase
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // AGENTS.md is the project's source of truth; stop `next dev` from rewriting it.
  agentRules: false,
  // E2E builds against the local Supabase stack use a separate output directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol === "https:" ? "https" : "http",
        hostname: supabaseUrl.hostname,
        port: supabaseUrl.port,
        pathname: "/storage/v1/object/public/product-images/**",
      },
    ],
    // Only true when the app itself points at the local Supabase stack (tests/dev).
    dangerouslyAllowLocalIP: isLocalSupabase,
  },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    serverActions: {
      // Product photo uploads (5 MB max) plus multipart overhead.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
