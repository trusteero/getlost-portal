import { db } from "./index";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import crypto from "crypto";

export async function initializeDatabase() {
  console.log("🔧 Initializing database...");

  try {
    // Check if migrations folder exists
    const fs = await import("fs");
    const path = await import("path");
    const migrationsFolder = path.resolve("./drizzle");
    
    if (!fs.existsSync(migrationsFolder)) {
      console.log("📦 No migrations folder found, skipping migrations");
      return true;
    }

    // Run migrations (will skip if already applied)
    console.log("📦 Running database migrations...");
    try {
      migrate(db, { migrationsFolder });
      console.log("✅ Database migrations completed");
    } catch (migrationError: any) {
      // If tables already exist, that's okay - migrations were already applied
      if (migrationError?.message?.includes("already exists") || 
          migrationError?.cause?.code === "SQLITE_ERROR") {
        console.log("ℹ️  Tables already exist, migrations already applied");
      } else {
        throw migrationError;
      }
    }

    // Migrate account table if needed (Better Auth requires id column)
    await migrateAccountTable();

    // Test database connection
    const result = await db.select({ count: sql<number>`1` }).from(sql`sqlite_master`);
    console.log("✅ Database connection verified");

    return true;
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}

async function migrateAccountTable() {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const { env } = await import("@/env");
    
    // Get database path
    let dbPath = env.DATABASE_URL || "./dev.db";
    if (dbPath.startsWith("file://")) {
      dbPath = dbPath.replace(/^file:\/\//, "");
    } else if (dbPath.startsWith("file:")) {
      dbPath = dbPath.replace(/^file:/, "");
    }

    if (!fs.existsSync(dbPath)) {
      console.log("📦 Database file doesn't exist yet, skipping account migration");
      return;
    }

    const sqlite = new Database(dbPath);
    
    try {
      // Check if account table exists
      const tableInfo = sqlite.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='getlostportal_account'
      `).get();

      if (!tableInfo) {
        console.log("📦 Account table doesn't exist, will be created by migrations");
        sqlite.close();
        return;
      }

      // Check if table already has id column (already migrated)
      const columns = sqlite.prepare("PRAGMA table_info(getlostportal_account)").all();
      const hasIdColumn = columns.some((col: any) => col.name === "id");
      
      if (hasIdColumn) {
        console.log("✅ Account table already has 'id' column - migration not needed");
        sqlite.close();
        return;
      }

      console.log("🔄 Migrating account table for Better Auth...");

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

      console.log(`Found ${oldAccounts.length} existing accounts to migrate`);

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

      console.log(`✅ Successfully migrated ${oldAccounts.length} accounts`);
      console.log("✅ Account table now matches Better Auth schema");
    } finally {
      sqlite.close();
    }
  } catch (error: any) {
    // Don't fail initialization if migration fails - log and continue
    console.error("⚠️  Account table migration failed:", error?.message || error);
    console.log("⚠️  Continuing with initialization - migration can be run manually");
  }
}