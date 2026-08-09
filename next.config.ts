import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Build-time output mode. Produces a self-contained server at
  // .next/standalone/server.js for production deployment.
  // Does not affect `npm run dev`.
  output: "standalone",
  productionBrowserSourceMaps: false,
  compress: true,

  // Expose build metadata to the client
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || "dev",
  },
};

export default nextConfig;
