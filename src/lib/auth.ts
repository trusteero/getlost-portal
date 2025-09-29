import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db";
import Database from "better-sqlite3";
import { trackUserActivity } from "@/server/services/analytics";

// Get database URL from environment
const dbUrl = process.env.DATABASE_URL || "./db.sqlite";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),

  // Trust the host in production
  trustedOrigins: process.env.NODE_ENV === "production" ? [process.env.BETTER_AUTH_URL!] : undefined,

  // Base URL for auth (will be set via env)
  baseURL: process.env.BETTER_AUTH_URL,

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,

    // Send verification email
    sendVerificationEmail: async ({ user, url, token }) => {
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
    },

    // Send password reset email
    sendResetPassword: async ({ user, url, token }) => {
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
    },
  },

  // Social providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "placeholder",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder",
    },
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
    generateId: false, // Use default ID generation
  },

  // Hooks for tracking and role management
  hooks: {
    after: [
      {
        matcher(context) {
          // Track activity on any authenticated action
          return context.method === "getSession" && context.session?.user;
        },
        handler: async (context) => {
          if (context.session?.user?.id) {
            // Track user activity (fire and forget)
            trackUserActivity(context.session.user.id).catch(console.error);
          }
        },
      },
      {
        matcher(context) {
          // Check super admin status on sign in
          return context.method === "signInEmail" || context.method === "signInSocial";
        },
        handler: async (context) => {
          if (!context.user) return;

          const superAdminEmails = process.env.SUPER_ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
          const isSuperAdmin = context.user.email && superAdminEmails.includes(context.user.email);

          if (isSuperAdmin && context.user.role !== "super_admin") {
            // Update user to super admin
            await context.context.adapter.updateUser(context.user.id, {
              role: "super_admin",
            });
          }
        },
      },
    ],
  },
});

// Export type for TypeScript
export type Auth = typeof auth;