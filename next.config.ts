import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AGENTS.md is the project's source of truth; stop `next dev` from rewriting it.
  agentRules: false,
};

export default nextConfig;
