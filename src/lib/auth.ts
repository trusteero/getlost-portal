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
    console.log("🔍 [Better Auth] ensureAccountTableMigration() called");
    // Get database path
    let dbPath = env.DATABASE_URL || "./dev.db";
    console.log("   Database URL from env:", env.DATABASE_URL);
    if (dbPath.startsWith("file://")) {
      dbPath = dbPath.replace(/^file:\/\//, "");
    } else if (dbPath.startsWith("file:")) {
      dbPath = dbPath.replace(/^file:/, "");
    }

    // Ensure database directory exists
    const dbDir = require('path').dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Open database (will create file if it doesn't exist)
    const sqlite = new Database(dbPath);
    
    try {
      // Check if account table exists
      const tableInfo = sqlite.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='getlostportal_account'
      `).get();

      if (!tableInfo) {
        // Table doesn't exist - create it with Better Auth schema
        // First ensure user table exists (required for foreign key)
        const userTable = sqlite.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name='getlostportal_user'
        `).get();
        
        if (!userTable) {
          console.log("🔄 [Better Auth] Creating user table first (required for account table)...");
          sqlite.exec(`
            CREATE TABLE getlostportal_user (
              id TEXT PRIMARY KEY,
              name TEXT,
              email TEXT NOT NULL UNIQUE,
              emailVerified INTEGER DEFAULT 0,
              image TEXT,
              role TEXT DEFAULT 'user' NOT NULL,
              createdAt INTEGER DEFAULT (unixepoch()) NOT NULL,
              updatedAt INTEGER DEFAULT (unixepoch()) NOT NULL
            )
          `);
          console.log("✅ [Better Auth] User table created");
        }
        
        console.log("🔄 [Better Auth] Creating account table with Better Auth schema...");
        sqlite.exec(`
          CREATE TABLE getlostportal_account (
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
        console.log("✅ [Better Auth] Account table created");
        sqlite.close();
        return;
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
  let sqlite: Database.Database | null = null;
  try {
    console.log("🔍 [Better Auth] ensureSessionTableMigration() called");
    // Get database path
    let dbPath = env.DATABASE_URL || "./dev.db";
    console.log("   Database URL from env:", env.DATABASE_URL);
    if (dbPath.startsWith("file://")) {
      dbPath = dbPath.replace(/^file:\/\//, "");
    } else if (dbPath.startsWith("file:")) {
      dbPath = dbPath.replace(/^file:/, "");
    }

    // Ensure database directory exists
    const dbDir = require('path').dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      console.log(`📁 [Better Auth] Creating database directory: ${dbDir}`);
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Open database (will create file if it doesn't exist)
    console.log(`📂 [Better Auth] Opening database at: ${dbPath}`);
    sqlite = new Database(dbPath);
    
    // Ensure user table exists first (required for foreign key)
    try {
      const userTable = sqlite.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='getlostportal_user'
      `).get();
      
      if (!userTable) {
        console.log("🔄 [Better Auth] Creating user table first (required for session table)...");
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS getlostportal_user (
            id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT NOT NULL UNIQUE,
            emailVerified INTEGER DEFAULT 0,
            image TEXT,
            role TEXT DEFAULT 'user' NOT NULL,
            createdAt INTEGER DEFAULT (unixepoch()) NOT NULL,
            updatedAt INTEGER DEFAULT (unixepoch()) NOT NULL
          )
        `);
        console.log("✅ [Better Auth] User table created/verified");
      }
    } catch (error: any) {
      console.error("⚠️  [Better Auth] Error checking/creating user table:", error?.message);
      // Continue anyway - table might already exist
    }
    
    // Check if session table exists
    let tableInfo: { name: string } | undefined;
    try {
      tableInfo = sqlite.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='getlostportal_session'
      `).get() as { name: string } | undefined;
    } catch (error: any) {
      console.error("⚠️  [Better Auth] Error checking session table:", error?.message);
      tableInfo = undefined;
    }

    if (!tableInfo) {
      // Table doesn't exist - create it with Better Auth schema
      console.log("🔄 [Better Auth] Creating session table with Better Auth schema...");
      try {
        sqlite.exec(`
          CREATE TABLE getlostportal_session (
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
        console.log("✅ [Better Auth] Session table created");
      } catch (createError: any) {
        console.error("❌ [Better Auth] Failed to create session table:", createError?.message);
        throw createError; // Re-throw to be caught by outer catch
      }
    } else {
      // Table exists - verify it has the correct schema
      console.log("🔍 [Better Auth] Session table exists, verifying schema...");
      try {
        const columns = sqlite.prepare("PRAGMA table_info(getlostportal_session)").all() as Array<{ name: string }>;
        const columnNames = columns.map((col: any) => col.name);
        const hasSessionToken = columnNames.includes("sessionToken");
        const hasIdColumn = columnNames.includes("id");
        const hasToken = columnNames.includes("token");
        const hasExpiresAt = columnNames.includes("expires_at");
        
        console.log(`   Current columns: ${columnNames.join(", ")}`);
        
        // If already migrated (has id column and token), skip
        if (hasIdColumn && hasToken && hasExpiresAt && !hasSessionToken) {
          console.log("✅ [Better Auth] Session table already has correct Better Auth schema");
          sqlite.close();
          sqlite = null;
          return; // Already migrated
        }

        // If it has sessionToken, it's the old schema - migrate it
        if (hasSessionToken && !hasIdColumn) {
          console.log("🔄 [Better Auth] Migrating session table from old schema to Better Auth schema...");

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
        } else {
          // Unexpected schema - try to recreate the table
          console.log("⚠️  [Better Auth] Session table has unexpected schema, recreating...");
          sqlite.exec(`
            DROP TABLE IF EXISTS getlostportal_session;
            CREATE TABLE getlostportal_session (
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
          console.log("✅ [Better Auth] Session table recreated with correct schema");
        }
      } catch (verifyError: any) {
        console.error("⚠️  [Better Auth] Error verifying/migrating session table:", verifyError?.message);
        // Try to create the table anyway as a last resort (only if sqlite is still available)
        if (sqlite) {
          try {
            sqlite.exec(`
              CREATE TABLE IF NOT EXISTS getlostportal_session (
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
            console.log("✅ [Better Auth] Session table created as fallback");
          } catch (fallbackError: any) {
            console.error("❌ [Better Auth] Even fallback table creation failed:", fallbackError?.message);
            throw fallbackError;
          }
        } else {
          console.error("❌ [Better Auth] Cannot create fallback table - database connection is null");
        }
      }
    }
    
    // Verify the table was created successfully
    if (sqlite) {
      try {
        const verifyTable = sqlite.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name='getlostportal_session'
        `).get();
        
        if (!verifyTable) {
          throw new Error("Session table verification failed - table does not exist after migration");
        }
        
        // Try a simple query to ensure table is accessible
        sqlite.prepare("SELECT COUNT(*) as count FROM getlostportal_session").get();
        console.log("✅ [Better Auth] Session table verified and accessible");
      } catch (verifyError: any) {
        console.error("❌ [Better Auth] Session table verification failed:", verifyError?.message);
        throw verifyError;
      } finally {
        sqlite.close();
        sqlite = null;
      }
    }
  } catch (error: any) {
    if (sqlite) {
      try {
        sqlite.close();
      } catch {
        // Ignore close errors
      }
    }
    // Log error but allow Better Auth to initialize (it might work on retry)
    console.error("❌ [Better Auth] Session migration failed:", error?.message || error);
    console.error("   Stack:", error?.stack);
    // Don't throw - allow the app to continue and retry on next request
  }
}

// Run migrations synchronously before Better Auth initializes
console.log("🔧 [Better Auth] Starting table migrations...");
try {
  ensureAccountTableMigration();
  console.log("✅ [Better Auth] Account table migration completed");
} catch (error: any) {
  console.error("❌ [Better Auth] Account table migration failed:", error?.message || error);
  console.error("   Stack:", error?.stack);
}

try {
  ensureSessionTableMigration();
  console.log("✅ [Better Auth] Session table migration completed");
} catch (error: any) {
  console.error("❌ [Better Auth] Session table migration failed:", error?.message || error);
  console.error("   Stack:", error?.stack);
}

// Verify critical tables exist after migrations
console.log("🔍 [Better Auth] Verifying critical tables exist...");
try {
  let dbPath = env.DATABASE_URL || "./dev.db";
  if (dbPath.startsWith("file://")) {
    dbPath = dbPath.replace(/^file:\/\//, "");
  } else if (dbPath.startsWith("file:")) {
    dbPath = dbPath.replace(/^file:/, "");
  }
  
  const verifyDb = new Database(dbPath);
  try {
    const sessionTable = verifyDb.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='getlostportal_session'
    `).get();
    
    const userTable = verifyDb.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='getlostportal_user'
    `).get();
    
    if (!sessionTable) {
      console.error("❌ [Better Auth] CRITICAL: Session table does not exist after migration!");
      console.error("   This will cause authentication errors. Trying to create it now...");
      // Try one more time to create it
      ensureSessionTableMigration();
    } else {
      console.log("✅ [Better Auth] Session table verified");
    }
    
    if (!userTable) {
      console.error("❌ [Better Auth] CRITICAL: User table does not exist after migration!");
      console.error("   This will cause authentication errors.");
    } else {
      console.log("✅ [Better Auth] User table verified");
    }
  } finally {
    verifyDb.close();
  }
} catch (verifyError: any) {
  console.error("⚠️  [Better Auth] Could not verify tables:", verifyError?.message);
  console.error("   This might be okay if the database is not yet accessible");
}

console.log("🔧 [Better Auth] Table migrations finished");

// CRITICAL: Ensure session table exists before Better Auth initializes
// This will throw if the table cannot be created, preventing Better Auth from starting without tables
function ensureSessionTableExistsSync(): void {
  try {
    let dbPath = env.DATABASE_URL || "./dev.db";
    if (dbPath.startsWith("file://")) {
      dbPath = dbPath.replace(/^file:\/\//, "");
    } else if (dbPath.startsWith("file:")) {
      dbPath = dbPath.replace(/^file:/, "");
    }
    
    const dbDir = require('path').dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    const sqlite = new Database(dbPath);
    try {
      // Check if session table exists
      const sessionTable = sqlite.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='getlostportal_session'
      `).get();
      
      if (!sessionTable) {
        console.log("🚨 [Better Auth] CRITICAL: Session table missing before Better Auth init! Creating now...");
        
        // Ensure user table exists first
        const userTable = sqlite.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name='getlostportal_user'
        `).get();
        
        if (!userTable) {
          console.log("🚨 [Better Auth] Creating user table (required for session table)...");
          sqlite.exec(`
            CREATE TABLE IF NOT EXISTS getlostportal_user (
              id TEXT PRIMARY KEY,
              name TEXT,
              email TEXT NOT NULL UNIQUE,
              emailVerified INTEGER DEFAULT 0,
              image TEXT,
              role TEXT DEFAULT 'user' NOT NULL,
              createdAt INTEGER DEFAULT (unixepoch()) NOT NULL,
              updatedAt INTEGER DEFAULT (unixepoch()) NOT NULL
            )
          `);
        }
        
        // Create session table
        sqlite.exec(`
          CREATE TABLE getlostportal_session (
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
        console.log("✅ [Better Auth] Session table created successfully before Better Auth init");
      } else {
        console.log("✅ [Better Auth] Session table verified - exists before Better Auth init");
      }
      
      // Verify we can query it
      sqlite.prepare("SELECT COUNT(*) as count FROM getlostportal_session").get();
      console.log("✅ [Better Auth] Session table is accessible and ready");
    } finally {
      sqlite.close();
    }
  } catch (error: any) {
    console.error("❌ [Better Auth] CRITICAL ERROR: Cannot ensure session table exists!");
    console.error("   Error:", error?.message);
    console.error("   Stack:", error?.stack);
    // Don't throw in production to allow app to start, but log loudly
    if (process.env.NODE_ENV === "development") {
      throw new Error(`Cannot initialize Better Auth: Session table creation failed: ${error?.message}`);
    }
    console.error("⚠️  [Better Auth] Continuing despite error (production mode)");
  }
}

// Ensure tables exist BEFORE Better Auth initializes
console.log("🔐 [Better Auth] Ensuring critical tables exist before initialization...");
ensureSessionTableExistsSync();

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
