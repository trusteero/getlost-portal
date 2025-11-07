import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db";
import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import { trackUserActivity } from "@/server/services/analytics";
import * as betterAuthSchema from "@/server/db/better-auth-schema";
import { env } from "@/env";

// Run account table migration synchronously before Better Auth initializes
// This ensures the schema is correct before Better Auth tries to use it
function ensureAccountTableMigration() {
  try {
    // Get database path
    let dbPath = env.DATABASE_URL || "./dev.db";
    if (dbPath.startsWith("file://")) {
      dbPath = dbPath.replace(/^file:\/\//, "");
    } else if (dbPath.startsWith("file:")) {
      dbPath = dbPath.replace(/^file:/, "");
    }

    if (!fs.existsSync(dbPath)) {
      return; // Database doesn't exist yet, will be created with correct schema
    }

    const sqlite = new Database(dbPath);
    
    try {
      // Check if account table exists
      const tableInfo = sqlite.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='getlostportal_account'
      `).get();

      if (!tableInfo) {
        sqlite.close();
        return; // Table doesn't exist yet
      }

      // Check if table already has id column (already migrated)
      const columns = sqlite.prepare("PRAGMA table_info(getlostportal_account)").all();
      const hasIdColumn = columns.some((col: any) => col.name === "id");
      
      if (hasIdColumn) {
        sqlite.close();
        return; // Already migrated
      }

      console.log("🔄 [Better Auth] Migrating account table synchronously...");

      // Get all existing accounts
      const oldAccounts = sqlite.prepare(`
        SELECT 
          userId,
          provider,
          providerAccountId,
          access_token,
          refresh_token,
          id_token,
          expires_at,
          scope
        FROM getlostportal_account
      `).all() as Array<{
        userId: string;
        provider: string;
        providerAccountId: string;
        access_token?: string;
        refresh_token?: string;
        id_token?: string;
        expires_at?: number;
        scope?: string;
      }>;

      // Create new table with Better Auth schema
      sqlite.exec(`
        CREATE TABLE getlostportal_account_new (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          user_id TEXT NOT NULL REFERENCES getlostportal_user(id) ON DELETE CASCADE,
          access_token TEXT,
          refresh_token TEXT,
          id_token TEXT,
          access_token_expires_at INTEGER,
          refresh_token_expires_at INTEGER,
          scope TEXT,
          password TEXT,
          created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
          updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
        )
      `);

      // Migrate data
      const insert = sqlite.prepare(`
        INSERT INTO getlostportal_account_new (
          id, account_id, provider_id, user_id,
          access_token, refresh_token, id_token,
          access_token_expires_at, scope,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = sqlite.transaction((accounts: typeof oldAccounts) => {
        for (const account of accounts) {
          const id = crypto.randomUUID();
          insert.run(
            id,
            account.providerAccountId,
            account.provider,
            account.userId,
            account.access_token || null,
            account.refresh_token || null,
            account.id_token || null,
            account.expires_at || null,
            account.scope || null,
            Math.floor(Date.now() / 1000),
            Math.floor(Date.now() / 1000)
          );
        }
      });

      insertMany(oldAccounts);

      // Drop old table and rename new one
      sqlite.exec(`
        DROP TABLE getlostportal_account;
        ALTER TABLE getlostportal_account_new RENAME TO getlostportal_account;
      `);

      console.log(`✅ [Better Auth] Successfully migrated ${oldAccounts.length} accounts`);
    } finally {
      sqlite.close();
    }
  } catch (error: any) {
    // Log but don't throw - allow Better Auth to initialize
    console.error("⚠️  [Better Auth] Account migration failed:", error?.message || error);
  }
}

// Run migration synchronously before Better Auth initializes
ensureAccountTableMigration();

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
      // In development, just log the verification URL and don't send email
      if (process.env.NODE_ENV === "development") {
        console.log("📧 [DEV] Verification email would be sent to:", user.email);
        console.log("🔗 [DEV] Verification URL:", url);
        return; // Don't try to send email in development
      }

      try {
        // Import email service here to avoid circular dependencies
        const { sendEmail } = await import("@/server/services/email");

        const emailSent = await sendEmail({
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

        if (!emailSent) {
          console.warn("Failed to send verification email, but continuing with signup");
        }
      } catch (error) {
        // Log error but don't fail signup if email sending fails
        console.error("Failed to send verification email:", error);
        // Don't throw - allow signup to continue
      }
    },

    // Send password reset email
    sendResetPassword: async ({ user, url, token }: { user: { email: string; name?: string | null }; url: string; token: string }) => {
      // In development, just log the reset URL and don't send email
      if (process.env.NODE_ENV === "development") {
        console.log("📧 [DEV] Password reset email would be sent to:", user.email);
        console.log("🔗 [DEV] Password reset URL:", url);
        return; // Don't try to send email in development
      }

      try {
        // Import email service here to avoid circular dependencies
        const { sendEmail } = await import("@/server/services/email");

        const emailSent = await sendEmail({
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

        if (!emailSent) {
          console.warn("Failed to send password reset email, but continuing");
        }
      } catch (error) {
        // Log error but don't fail password reset if email sending fails
        console.error("Failed to send password reset email:", error);
        // Don't throw - allow password reset to continue
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
