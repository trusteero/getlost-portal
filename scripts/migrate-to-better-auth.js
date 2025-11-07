#!/usr/bin/env node

import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });
dotenv.config({ path: join(__dirname, '../.env') });

const dbPath = process.env.DATABASE_URL || './db.sqlite';
console.log('📦 Migrating database to Better Auth schema...');
console.log('Database path:', dbPath);

// Connect to database
const db = new Database(dbPath);

try {
  // Begin transaction
  db.exec('BEGIN TRANSACTION');

  console.log('🔄 Creating Better Auth tables...');

  // Create Better Auth user table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER DEFAULT 0,
      image TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      role TEXT DEFAULT 'user'
    );
  `);

  // Create Better Auth session table
  db.exec(`
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      ip_address TEXT,
      user_agent TEXT,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
    );
  `);

  // Create Better Auth account table
  db.exec(`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at INTEGER,
      refresh_token_expires_at INTEGER,
      scope TEXT,
      password TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );
  `);

  // Create Better Auth verification table
  db.exec(`
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );
  `);

  console.log('📋 Migrating existing user data...');

  // Check if old tables exist
  const oldTablesExist = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='getlostportal_user'
  `).get();

  if (oldTablesExist) {
    // Migrate users
    const migrateUsers = db.prepare(`
      INSERT OR REPLACE INTO user (id, name, email, email_verified, image, created_at, updated_at, role)
      SELECT
        id,
        name,
        email,
        CASE WHEN emailVerified IS NOT NULL THEN 1 ELSE 0 END,
        image,
        createdAt,
        updatedAt,
        role
      FROM getlostportal_user
    `);
    const userResult = migrateUsers.run();
    console.log(`✅ Migrated ${userResult.changes} users`);

    // Migrate accounts (Google OAuth)
    const migrateAccounts = db.prepare(`
      INSERT OR REPLACE INTO account (
        id,
        account_id,
        provider_id,
        user_id,
        access_token,
        refresh_token,
        id_token,
        access_token_expires_at,
        scope,
        created_at,
        updated_at
      )
      SELECT
        userId || '_' || provider || '_' || providerAccountId as id,
        providerAccountId as account_id,
        provider as provider_id,
        userId as user_id,
        access_token,
        refresh_token,
        id_token,
        expires_at as access_token_expires_at,
        scope,
        (unixepoch()) as created_at,
        (unixepoch()) as updated_at
      FROM getlostportal_account
      WHERE provider = 'google'
    `);
    const accountResult = migrateAccounts.run();
    console.log(`✅ Migrated ${accountResult.changes} OAuth accounts`);

    // Migrate password accounts
    const migratePasswords = db.prepare(`
      INSERT OR REPLACE INTO account (
        id,
        account_id,
        provider_id,
        user_id,
        password,
        created_at,
        updated_at
      )
      SELECT
        id || '_credential' as id,
        email as account_id,
        'credential' as provider_id,
        id as user_id,
        password,
        createdAt,
        updatedAt
      FROM getlostportal_user
      WHERE password IS NOT NULL
    `);
    const passwordResult = migratePasswords.run();
    console.log(`✅ Migrated ${passwordResult.changes} password accounts`);

    // Update foreign key references in other tables
    console.log('🔄 Updating foreign key references...');

    // Update books table to reference new user table
    const tablesWithUserRef = [
      'getlostportal_book',
      'getlostportal_user_activity',
      'getlostportal_digest',
      'getlostportal_notification'
    ];

    for (const table of tablesWithUserRef) {
      const tableExists = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name=?
      `).get(table);

      if (tableExists) {
        // Check if userId column exists
        const hasUserId = db.prepare(`
          SELECT * FROM pragma_table_info(?) WHERE name='userId'
        `).get(table);

        if (hasUserId) {
          console.log(`  Checking ${table}...`);
          // No need to update as user IDs remain the same
        }
      }
    }

    console.log('✅ Foreign key references preserved (user IDs unchanged)');

  } else {
    console.log('⚠️  No existing NextAuth tables found, skipping data migration');
  }

  // Create indexes for Better Auth tables
  console.log('📇 Creating indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
    CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
    CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id);
    CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(user_id);
    CREATE INDEX IF NOT EXISTS idx_account_provider ON account(provider_id, account_id);
    CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);
  `);

  // Commit transaction
  db.exec('COMMIT');
  console.log('✅ Migration completed successfully!');

  // Display summary
  const userCount = /** @type {{ count: number }} */ (db.prepare('SELECT COUNT(*) as count FROM user').get());
  const accountCount = /** @type {{ count: number }} */ (db.prepare('SELECT COUNT(*) as count FROM account').get());

  console.log('\n📊 Migration Summary:');
  console.log(`  • Total users: ${userCount.count}`);
  console.log(`  • Total accounts: ${accountCount.count}`);

  console.log('\n⚠️  Important Notes:');
  console.log('  1. Update your environment variables:');
  console.log('     • Add: BETTER_AUTH_URL=http://localhost:3000 (or your production URL)');
  console.log('     • Add: NEXT_PUBLIC_APP_URL=http://localhost:3000 (or your production URL)');
  console.log('     • Keep: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  console.log('     • Keep: DATABASE_URL');
  console.log('  2. All existing sessions have been invalidated - users will need to log in again');
  console.log('  3. The old NextAuth tables are still present but can be removed later');

} catch (error) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error('❌ Migration failed:', err.message);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
}