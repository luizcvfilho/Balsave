import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  devIndicators: false,
  turbopack: {
    root: fileURLToPath(new URL("..", import.meta.url)),
  },
};

export default nextConfig;
