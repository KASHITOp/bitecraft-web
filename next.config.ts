import type { NextConfig } from "next";

/**
 * Two build targets:
 * - web (default): normal Next.js build for Vercel, with the /api/chef route and the service worker.
 * - mobile (BUILD_TARGET=mobile): static export into ./out for the Capacitor Android app.
 *   No API routes (route.web.ts files are skipped), no service worker, trailing-slash URLs so
 *   every screen exists as <screen>/index.html inside the APK.
 */
const mobile = process.env.BUILD_TARGET === "mobile";

const nextConfig: NextConfig = {
  env: {
    // Changes on every build so the service worker refreshes its cache after a deploy.
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? Date.now().toString(36),
    NEXT_PUBLIC_MOBILE: mobile ? "1" : "",
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? "",
  },
  // Route handlers are named route.web.ts so they only exist in the web build.
  pageExtensions: mobile ? ["tsx", "ts"] : ["web.ts", "tsx", "ts"],
  ...(mobile
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
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
      }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
