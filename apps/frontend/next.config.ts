// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep your existing image config
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",   // ← matches any host
        pathname: "/**",  // ← matches any path
      },
    ],
    // optionally disable optimization entirely:
    // unoptimized: true,
  },

  // Preserve your custom webpack tweaks
  webpack: (config, { isServer }) => {
    if (!isServer) config.resolve.alias.canvas = false;
    config.module.rules.push({
      test: /\.worker\.js$/,
      loader: "worker-loader",
      options: { name: "static/[hash].worker.js", publicPath: "/_next/" },
    });
    return config;
  },

  turbopack: {},
};

export default nextConfig;
