import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// `next dev` serves its chunks only to the hostname it was started with. A
// request through a tunnel arrives under the public hostname, which counts as a
// different origin, and every chunk is refused with "Blocked cross-origin
// request to Next.js dev resource" — the page loads but nothing on it works.
// The hostnames come from the environment (NEXT_DEV_ORIGINS, comma separated)
// so a deployment names its own instead of hard-coding one here.
const devOrigins = (process.env.NEXT_DEV_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // reactCompiler: true, // Disabled due to Jest worker crash on transcript page

  allowedDevOrigins: devOrigins,

  // Build-time output mode. Produces a self-contained server at
  // .next/standalone/server.js for production deployment.
  // Does not affect `npm run dev`.
  output: "standalone",
  productionBrowserSourceMaps: false,
  compress: true,

  // Fix workspace root detection when parent dirs have package-lock.json
  turbopack: {
    root: __dirname,
  },

  // Development answers its own chunks with `max-age=14400`, so a browser that
  // loaded the page once keeps running that bundle for four hours: a reload
  // does not revalidate it, and an edit — a corrected API address, a fixed
  // component — never reaches that tab. Through a tunnel that reads as "the
  // fix did not work" on the one device that was opened first. A build keeps
  // the long cache, which is what it is for.
  async headers() {
    if (process.env.NODE_ENV === "production") return [];
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },

  // Proxy API calls and audio files to standalone backend during development
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/api/:path*",
      },
      {
        source: "/audio/:path*",
        destination: "http://localhost:4000/audio/:path*",
      },
    ];
  },

  // Expose build metadata to the client
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || "dev",
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
