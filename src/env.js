import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		AUTH_SECRET: z.string().optional(), // Optional - Better Auth can generate if needed
		BETTER_AUTH_SECRET: z.string().optional(), // Optional - Better Auth secret
		AUTH_GOOGLE_ID: z.string().optional(), // Optional - Google OAuth not required
		AUTH_GOOGLE_SECRET: z.string().optional(), // Optional - Google OAuth not required
		DATABASE_URL: z.string().optional().default(() => {
			// During build, use build database. At runtime, must be set via env var.
			if (process.env.NEXT_PHASE === 'phase-production-build' || 
			    process.argv.includes('build')) {
				return "file:./build-db.sqlite";
			}
			return process.env.DATABASE_URL || "file:./dev.db";
		}()),
		BETTER_AUTH_URL: z.string().optional(), // Better Auth base URL
		SUPER_ADMIN_EMAILS: z.string().optional(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		// NEXT_PUBLIC_CLIENTVAR: z.string(),
		NEXT_PUBLIC_SUPPORTED_FORMATS: z.string().optional(),
		NEXT_PUBLIC_SUPER_ADMIN_EMAILS: z.string().optional(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		AUTH_SECRET: process.env.AUTH_SECRET,
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
		AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
		DATABASE_URL: process.env.DATABASE_URL,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
		SUPER_ADMIN_EMAILS: process.env.SUPER_ADMIN_EMAILS,
		NODE_ENV: process.env.NODE_ENV,
		NEXT_PUBLIC_SUPPORTED_FORMATS: process.env.NEXT_PUBLIC_SUPPORTED_FORMATS,
		NEXT_PUBLIC_SUPER_ADMIN_EMAILS: process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS,
	},
	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
	 * useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
