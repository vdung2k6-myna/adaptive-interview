import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // reactCompiler: true, // Disabled due to Jest worker crash on transcript page

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

export default nextConfig;
