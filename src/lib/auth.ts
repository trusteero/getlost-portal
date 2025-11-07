import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db";
import Database from "better-sqlite3";
import { trackUserActivity } from "@/server/services/analytics";
import * as betterAuthSchema from "@/server/db/better-auth-schema";

// Get database URL from environment
const dbUrl = process.env.DATABASE_URL || "./db.sqlite";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: betterAuthSchema,
  }),

  // Secret for signing tokens (use BETTER_AUTH_SECRET or AUTH_SECRET or generate)
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || undefined,

  // Trust the host in production (only if BETTER_AUTH_URL is set)
  trustedOrigins: process.env.NODE_ENV === "production" && process.env.BETTER_AUTH_URL
    ? [process.env.BETTER_AUTH_URL]
    : undefined,

  // Base URL for auth (will be set via env)
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV === "production", // Only require verification in production

    // Send verification email
    sendVerificationEmail: async ({ user, url, token }: { user: { email: string; name?: string | null }; url: string; token: string }) => {
      try {
        // Import email service here to avoid circular dependencies
        const { sendEmail } = await import("@/server/services/email");

        await sendEmail({
          to: user.email,
          subject: "Verify your email",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ea580c;">Verify Your Email</h2>
              <p>Hi ${user.name || "there"},</p>
              <p>Please click the link below to verify your email address:</p>
              <div style="margin: 30px 0;">
                <a href="${url}" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                  Verify Email
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">Or copy and paste this link: ${url}</p>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">
                If you didn't create an account, you can safely ignore this email.
              </p>
            </div>
          `,
        });
      } catch (error) {
        // Log error but don't fail signup if email sending fails
        console.error("Failed to send verification email:", error);
        // In development, log the verification URL
        if (process.env.NODE_ENV === "development") {
          console.log("Verification URL:", url);
        }
      }
    },

    // Send password reset email
    sendResetPassword: async ({ user, url, token }: { user: { email: string; name?: string | null }; url: string; token: string }) => {
      try {
        // Import email service here to avoid circular dependencies
        const { sendEmail } = await import("@/server/services/email");

        await sendEmail({
          to: user.email,
          subject: "Reset your password",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ea580c;">Reset Your Password</h2>
              <p>Hi ${user.name || "there"},</p>
              <p>You requested to reset your password. Click the link below to create a new password:</p>
              <div style="margin: 30px 0;">
                <a href="${url}" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">Or copy and paste this link: ${url}</p>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>
            </div>
          `,
        });
      } catch (error) {
        // Log error but don't fail password reset if email sending fails
        console.error("Failed to send password reset email:", error);
        // In development, log the reset URL
        if (process.env.NODE_ENV === "development") {
          console.log("Password reset URL:", url);
        }
      }
    },
  },

  // Social providers (only enable if credentials are provided)
  socialProviders: {
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? {
          google: {
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          },
        }
      : {}),
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // User configuration
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        required: false,
      },
    },
  },

  // Account configuration
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"], // Allow linking with Google
    },
  },

  // Advanced configuration
  advanced: {
    cookiePrefix: "better-auth",
    database: {
      generateId: () => crypto.randomUUID(), // Provide custom ID generation function
    },
  },
});

// Export type for TypeScript
export type Auth = typeof auth;