#!/usr/bin/env node

/**
 * Migration script to update account table for Better Auth
 * 
 * Better Auth expects:
 * - id column as primary key
 * - account_id column (maps to providerAccountId)
 * - provider_id column (maps to provider)
 * - user_id column (maps to userId)
 * 
 * Old NextAuth schema has:
 * - Composite primary key on (provider, providerAccountId)
 * - userId column
 * - provider column
 * - providerAccountId column
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get database path from environment or use default
const dbPath = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace(/^file:/, "").replace(/^\/\//, "")
  : path.join(process.cwd(), "dev.db");

console.log("📦 Migrating account table for Better Auth...");
console.log("Database path:", dbPath);

if (!fs.existsSync(dbPath)) {
  console.error("❌ Database file not found:", dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

try {
  // Check if account table exists
  const tableInfo = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='getlostportal_account'
  `).get();

  if (!tableInfo) {
    console.log("⚠️  Account table doesn't exist, creating new one...");
    
    // Create new Better Auth account table
    db.exec(`
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
    
    console.log("✅ Created new Better Auth account table");
    process.exit(0);
  }

  // Check if table already has id column (already migrated)
  const columns = db.prepare("PRAGMA table_info(getlostportal_account)").all();
  const hasIdColumn = columns.some(col => col.name === "id");
  
  if (hasIdColumn) {
    console.log("✅ Account table already has 'id' column - migration not needed");
    process.exit(0);
  }

  console.log("🔄 Migrating existing account table...");

  // Get all existing accounts
  const oldAccounts = db.prepare(`
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
  `).all();

  console.log(`Found ${oldAccounts.length} existing accounts to migrate`);

  // Create new table with Better Auth schema
  db.exec(`
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
  const insert = db.prepare(`
    INSERT INTO getlostportal_account_new (
      id, account_id, provider_id, user_id,
      access_token, refresh_token, id_token,
      access_token_expires_at, scope,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((accounts) => {
    for (const account of accounts) {
      const id = require("crypto").randomUUID();
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
  db.exec(`
    DROP TABLE getlostportal_account;
    ALTER TABLE getlostportal_account_new RENAME TO getlostportal_account;
  `);

  console.log(`✅ Successfully migrated ${oldAccounts.length} accounts`);
  console.log("✅ Account table now matches Better Auth schema");

} catch (error) {
  console.error("❌ Migration failed:", error);
  process.exit(1);
} finally {
  db.close();
}

