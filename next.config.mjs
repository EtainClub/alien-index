import { configuredBasePath } from "./scripts/config.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: configuredBasePath,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
