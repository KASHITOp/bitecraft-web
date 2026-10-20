import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Changes on every build so the service worker refreshes its cache after a deploy.
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? Date.now().toString(36),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
