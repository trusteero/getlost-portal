import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db";
import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import { trackUserActivity } from "@/server/services/analytics";
import * as betterAuthSchema from "@/server/db/better-auth-schema";
import { env } from "@/env";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/server/services/email";

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

// Run session table migration synchronously before Better Auth initializes
function ensureSessionTableMigration() {
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
      // Check if session table exists
      const tableInfo = sqlite.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='getlostportal_session'
      `).get();

      if (!tableInfo) {
        sqlite.close();
        return; // Table doesn't exist yet
      }

      // Check table structure - if it has sessionToken, it's the old schema
      const columns = sqlite.prepare("PRAGMA table_info(getlostportal_session)").all();
      const hasSessionToken = columns.some((col: any) => col.name === "sessionToken");
      const hasIdColumn = columns.some((col: any) => col.name === "id");
      
      // If already migrated (has id column), skip
      if (hasIdColumn && !hasSessionToken) {
        sqlite.close();
        return; // Already migrated
      }

      // If it doesn't have sessionToken, it might be a different issue
      if (!hasSessionToken && !hasIdColumn) {
        console.log("⚠️  [Better Auth] Session table has unexpected schema");
        sqlite.close();
        return;
      }

      console.log("🔄 [Better Auth] Migrating session table synchronously...");

      // Get all existing sessions from old schema
      const oldSessions = sqlite.prepare(`
        SELECT 
          sessionToken,
          userId,
          expires
        FROM getlostportal_session
      `).all() as Array<{
        sessionToken: string;
        userId: string;
        expires: number;
      }>;

      // Create new table with Better Auth schema
      sqlite.exec(`
        CREATE TABLE getlostportal_session_new (
          id TEXT PRIMARY KEY,
          expires_at INTEGER NOT NULL,
          token TEXT NOT NULL UNIQUE,
          created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
          updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          user_id TEXT NOT NULL REFERENCES getlostportal_user(id) ON DELETE CASCADE
        )
      `);

      // Migrate data
      const insert = sqlite.prepare(`
        INSERT INTO getlostportal_session_new (
          id, expires_at, token, user_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertMany = sqlite.transaction((sessions: typeof oldSessions) => {
        for (const session of sessions) {
          const id = crypto.randomUUID();
          insert.run(
            id,
            session.expires,
            session.sessionToken,
            session.userId,
            Math.floor(Date.now() / 1000),
            Math.floor(Date.now() / 1000)
          );
        }
      });

      insertMany(oldSessions);

      // Drop old table and rename new one
      sqlite.exec(`
        DROP TABLE getlostportal_session;
        ALTER TABLE getlostportal_session_new RENAME TO getlostportal_session;
      `);

      console.log(`✅ [Better Auth] Successfully migrated ${oldSessions.length} sessions`);
    } finally {
      sqlite.close();
    }
  } catch (error: any) {
    // Log but don't throw - allow Better Auth to initialize
    console.error("⚠️  [Better Auth] Session migration failed:", error?.message || error);
  }
}

// Ensure verification table exists
function ensureVerificationTable() {
  try {
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
      // Check if verification table exists
      const tableInfo = sqlite.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='getlostportal_verification'
      `).get();

      if (tableInfo) {
        sqlite.close();
        return; // Table exists
      }

      console.log("🔄 [Better Auth] Creating verification table...");
      
      // Create verification table
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS getlostportal_verification (
          id TEXT PRIMARY KEY,
          identifier TEXT NOT NULL,
          value TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
          updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
        )
      `);

      console.log("✅ [Better Auth] Verification table created");
    } finally {
      sqlite.close();
    }
  } catch (error: any) {
    console.error("⚠️  [Better Auth] Verification table check failed:", error?.message || error);
  }
}

// Run migrations synchronously before Better Auth initializes
ensureAccountTableMigration();
ensureSessionTableMigration();
ensureVerificationTable();

// Debug: Log database configuration
console.log("🔍 [Better Auth] Database configuration:");
console.log("  DATABASE_URL:", env.DATABASE_URL);
try {
  // Get the actual database path from the db instance
  const dbPath = env.DATABASE_URL || "./dev.db";
  let resolvedPath = dbPath;
  if (resolvedPath.startsWith("file://")) {
    resolvedPath = resolvedPath.replace(/^file:\/\//, "");
  } else if (resolvedPath.startsWith("file:")) {
    resolvedPath = resolvedPath.replace(/^file:/, "");
  }
  console.log("  Resolved database path:", resolvedPath);
  console.log("  Database file exists:", fs.existsSync(resolvedPath));
  
  // Log table names from schema
  const userTableName = (betterAuthSchema.user as any)?.name || "unknown";
  const accountTableName = (betterAuthSchema.account as any)?.name || "unknown";
  const sessionTableName = (betterAuthSchema.session as any)?.name || "unknown";
  console.log("  User table:", userTableName);
  console.log("  Account table:", accountTableName);
  console.log("  Session table:", sessionTableName);
} catch (error) {
  console.log("  Could not extract database info:", error);
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: betterAuthSchema,
  }),

  // Secret for signing tokens (use BETTER_AUTH_SECRET or AUTH_SECRET or generate)
  // Better Auth requires a secret - generate one if not provided
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || (() => {
    if (process.env.NODE_ENV === "development") {
      console.warn("⚠️  [Better Auth] No AUTH_SECRET found. Using a temporary secret for development.");
      console.warn("   For production, set AUTH_SECRET in your environment variables.");
      // Generate a temporary secret for development
      return crypto.randomBytes(32).toString("base64");
    }
    throw new Error("AUTH_SECRET is required in production. Please set AUTH_SECRET or BETTER_AUTH_SECRET environment variable.");
  })(),

  // Trust the host in production
  // Use BETTER_AUTH_URL if set, otherwise try to detect from environment
  trustedOrigins: (() => {
    if (process.env.NODE_ENV === "production") {
      // In production, use BETTER_AUTH_URL or NEXT_PUBLIC_APP_URL
      const productionUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
      if (productionUrl) {
        return [productionUrl];
      }
      // If no URL is set, trust all origins (less secure but works)
      return undefined;
    }
    // In development, don't restrict origins
    return undefined;
  })(),

  // Base URL for auth (will be set via env)
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  
  // Log the base URL for debugging
  // Better Auth will use: {baseURL}/api/auth/callback/google

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // Require email verification before login
  },

  // Email verification configuration
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      console.log("📧 [Better Auth] Sending verification email to:", user.email);
      console.log("📧 [Better Auth] Verification URL (original):", url);
      
      // Extract the token from Better Auth's URL and redirect to our verification page
      // Better Auth's URL format: /api/auth/verify-email?token=...&callbackURL=...
      const urlObj = new URL(url, process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
      const token = urlObj.searchParams.get("token");
      const callbackURL = urlObj.searchParams.get("callbackURL") || "/";
      
      // Create a URL that points to our verification page instead of the API
      const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const verificationPageURL = `${baseURL}/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent(callbackURL)}`;
      
      console.log("📧 [Better Auth] Verification URL (modified):", verificationPageURL);
      
      const customHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Verify Your Email</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f9fafb;
                margin: 0;
                padding: 20px;
              }
              .container {
                background: white;
                border-radius: 12px;
                padding: 48px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                max-width: 500px;
                margin: 0 auto;
              }
              .content {
                text-align: center;
              }
              h2 {
                font-size: 24px;
                font-weight: 600;
                color: #111827;
                margin: 0 0 16px;
              }
              p {
                color: #6b7280;
                margin: 0 0 24px;
                font-size: 16px;
              }
              .button {
                display: inline-block;
                padding: 16px 48px;
                background-color: #ea580c;
                color: white !important;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                margin: 24px 0;
                transition: background-color 0.2s;
              }
              .button:hover {
                background-color: #dc2626;
              }
              .expire-text {
                color: #9ca3af;
                font-size: 14px;
                margin: 16px 0;
              }
              .footer {
                margin-top: 40px;
                padding-top: 24px;
                border-top: 1px solid #e5e7eb;
                font-size: 13px;
                color: #9ca3af;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="content">
                <h2>Verify Your Email Address</h2>
                <p>Welcome to Get Lost! Please verify your email to complete your registration.</p>

                <a href="${verificationPageURL}" class="button" style="color: white !important;">Verify Email</a>

                <p class="expire-text">This link will expire in 24 hours</p>
              </div>

              <div class="footer">
                <p style="margin: 0;">If you didn't create an account with Get Lost, you can safely ignore this email.</p>
                <p style="margin: 8px 0 0;">&copy; ${new Date().getFullYear()} Get Lost. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const emailSent = await sendEmail({
        to: user.email,
        subject: "Verify your email for Get Lost",
        html: customHtml,
        text: `Welcome to Get Lost! Please verify your email by clicking this link: ${verificationPageURL}`,
      });

      console.log("📧 [Better Auth] Email send result:", emailSent);
      // Better Auth expects void return, not boolean
      return;
    },
  },

  // Social providers (only enable if credentials are provided)
  socialProviders: (() => {
    const googleId = process.env.AUTH_GOOGLE_ID;
    const googleSecret = process.env.AUTH_GOOGLE_SECRET;
    const hasGoogleCredentials = !!googleId && !!googleSecret;
    
    // Log configuration status for debugging
    console.log("🔍 [Better Auth] Google OAuth configuration check:");
    console.log("   AUTH_GOOGLE_ID:", googleId ? `${googleId.substring(0, 10)}...` : "NOT SET");
    console.log("   AUTH_GOOGLE_SECRET:", googleSecret ? "SET" : "NOT SET");
    console.log("   Has credentials:", hasGoogleCredentials);
    
    if (!hasGoogleCredentials) {
      console.warn("⚠️  [Better Auth] Google OAuth credentials not found.");
      console.warn("   Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in Render dashboard to enable Google sign-in.");
      console.warn("   Google sign-in will be disabled until credentials are configured.");
      return {};
    }
    
    if (!googleId || !googleSecret) {
      console.error("❌ [Better Auth] Google OAuth credentials are incomplete.");
      return {};
    }
    
    console.log("✅ [Better Auth] Google OAuth configured");
    
    // Log the expected callback URL for debugging
    const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const expectedCallbackURL = `${baseURL}/api/auth/callback/google`;
    console.log("🔍 [Better Auth] Expected Google OAuth callback URL:", expectedCallbackURL);
    console.log("   ⚠️  Make sure this EXACT URL is in Google Cloud Console → Authorized redirect URIs");
    
    return {
      google: {
        clientId: googleId,
        clientSecret: googleSecret,
      },
    };
  })(),

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

  // Plugins (email plugin removed - using emailVerification config instead)
  // plugins: [emailPlugin()],
});

// Export type for TypeScript
export type Auth = typeof auth;
