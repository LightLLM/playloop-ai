import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "cloudflare:workers": path.resolve(__dirname, "lib/cloudflare-workers-shim.cjs"),
    };
    return config;
  },
};

export default nextConfig;
