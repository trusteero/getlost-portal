/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  webpack: (config, { isServer, isEdgeRuntime }) => {
    // Exclude better-auth from Edge Runtime bundles (middleware)
    if (isEdgeRuntime) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'better-auth': false,
        '@/lib/auth': false,
      };
    }
    return config;
  },
};

export default config;
