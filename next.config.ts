import type { NextConfig } from "next";

// Product photos are served from the public Supabase Storage bucket.
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321");
const isLocalSupabase = ["127.0.0.1", "localhost"].includes(supabaseUrl.hostname);

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
  experimental: {
    serverActions: {
      // Product photo uploads (5 MB max) plus multipart overhead.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
