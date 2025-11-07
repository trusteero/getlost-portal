/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  webpack: (config, { isServer }) => {
    // Exclude better-auth from middleware bundle
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'better-auth': false,
      };
    }
    return config;
  },
};

export default config;
