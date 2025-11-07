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

// Run migrations synchronously before Better Auth initializes
ensureAccountTableMigration();
ensureSessionTableMigration();

// Debug: Log table names from schema
console.log("🔍 [Better Auth] Schema table names:");
console.log("  User table:", betterAuthSchema.user[Symbol.for("drizzle:Name")] || betterAuthSchema.user);
console.log("  Account table:", betterAuthSchema.account[Symbol.for("drizzle:Name")] || betterAuthSchema.account);
console.log("  Session table:", betterAuthSchema.session[Symbol.for("drizzle:Name")] || betterAuthSchema.session);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: betterAuthSchema,
  }),

  // Secret for signing tokens (use BETTER_AUTH_SECRET or AUTH_SECRET or generate)
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || undefined,

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

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disabled since email sending is disabled
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
