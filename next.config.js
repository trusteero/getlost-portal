/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Next 15+: use serverExternalPackages instead of experimental.serverComponentsExternalPackages
  serverExternalPackages: ['better-auth', 'better-sqlite3'],
  webpack: (config) => {
    // Prevent better-auth from being bundled in Edge Runtime
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push('better-auth');
    } else if (typeof config.externals === 'object') {
      config.externals['better-auth'] = 'commonjs better-auth';
    }
    return config;
  },
};

export default config;
