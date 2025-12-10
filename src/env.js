import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		AUTH_SECRET: z.string().optional(), // Optional - Better Auth can generate if needed
		AUTH_GOOGLE_ID: z.string().optional(), // Optional - Google OAuth not required
		AUTH_GOOGLE_SECRET: z.string().optional(), // Optional - Google OAuth not required
		DATABASE_URL: z.string().default("file:./build-db.sqlite"), // Default for build phase
		SUPER_ADMIN_EMAILS: z.string().optional(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		
		// File storage paths (optional - have defaults)
		BOOK_STORAGE_PATH: z.string().optional(),
		COVER_STORAGE_PATH: z.string().optional(),
		REPORT_STORAGE_PATH: z.string().optional(),
		UPLOAD_DIR: z.string().optional(),
		BOOK_REPORTS_PATH: z.string().optional(),
		
		// URLs (optional - have defaults)
		BETTER_AUTH_URL: z.string().url().optional(),
		CUSTOM_DOMAIN: z.string().optional(),
		
		// Stripe (optional - payments can be disabled)
		STRIPE_SECRET_KEY: z.string().optional(),
		STRIPE_WEBHOOK_SECRET: z.string().optional(),
		USE_SIMULATED_PURCHASES: z.string().optional(),
		
		// Email service (optional - can use test mode)
		RESEND_API_KEY: z.string().optional(),
		RESEND_FROM_EMAIL: z.string().email().optional(),
		
		// BookDigest service (optional - has default)
		BOOKDIGEST_URL: z.string().url().optional(),
		BOOKDIGEST_API_KEY: z.string().optional(),
		
		// Test mode
		DISABLE_EMAIL_IN_TESTS: z.string().optional(),
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		NEXT_PUBLIC_SUPPORTED_FORMATS: z.string().optional(),
		NEXT_PUBLIC_SUPER_ADMIN_EMAILS: z.string().optional(),
		NEXT_PUBLIC_APP_URL: z.string().url().optional(),
		NEXT_PUBLIC_CUSTOM_DOMAIN: z.string().optional(),
		NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		AUTH_SECRET: process.env.AUTH_SECRET,
		AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
		AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
		DATABASE_URL: process.env.DATABASE_URL,
		SUPER_ADMIN_EMAILS: process.env.SUPER_ADMIN_EMAILS,
		NODE_ENV: process.env.NODE_ENV,
		BOOK_STORAGE_PATH: process.env.BOOK_STORAGE_PATH,
		COVER_STORAGE_PATH: process.env.COVER_STORAGE_PATH,
		REPORT_STORAGE_PATH: process.env.REPORT_STORAGE_PATH,
		UPLOAD_DIR: process.env.UPLOAD_DIR,
		BOOK_REPORTS_PATH: process.env.BOOK_REPORTS_PATH,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
		CUSTOM_DOMAIN: process.env.CUSTOM_DOMAIN,
		STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
		STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
		USE_SIMULATED_PURCHASES: process.env.USE_SIMULATED_PURCHASES,
		RESEND_API_KEY: process.env.RESEND_API_KEY,
		RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
		BOOKDIGEST_URL: process.env.BOOKDIGEST_URL,
		BOOKDIGEST_API_KEY: process.env.BOOKDIGEST_API_KEY,
		DISABLE_EMAIL_IN_TESTS: process.env.DISABLE_EMAIL_IN_TESTS,
		NEXT_PUBLIC_SUPPORTED_FORMATS: process.env.NEXT_PUBLIC_SUPPORTED_FORMATS,
		NEXT_PUBLIC_SUPER_ADMIN_EMAILS: process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS,
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
		NEXT_PUBLIC_CUSTOM_DOMAIN: process.env.NEXT_PUBLIC_CUSTOM_DOMAIN,
		NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
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
