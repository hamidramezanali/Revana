import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Keep the local dev server from sharing generated chunks with `next build`.
  // Both commands otherwise write to `.next`, which can leave a live server
  // referring to a chunk that the other command has just replaced or removed.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
