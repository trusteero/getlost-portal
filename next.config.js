/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  experimental: {
    serverComponentsExternalPackages: ['better-auth', 'better-sqlite3'],
  },
  webpack: (config, { isServer }) => {
    // Prevent better-auth from being bundled in Edge Runtime
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push('better-auth');
    } else if (typeof config.externals === 'object') {
      config.externals['better-auth'] = 'commonjs better-auth';
    }
    
    // During build, skip database-related modules if they cause issues
    if (isServer && process.env.NEXT_PHASE === 'phase-production-build') {
      // Don't try to resolve database connections during build
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'better-sqlite3': false,
      };
    }
    
    return config;
  },
};

export default config;
