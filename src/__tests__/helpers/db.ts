/**
 * Test database utilities
 * Creates a fresh in-memory or file-based database for each test
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/server/db/schema";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { sql } from "drizzle-orm";
import { execSync } from "child_process";

let testDb: Database.Database | null = null;
let testDrizzle: ReturnType<typeof drizzle> | null = null;

/**
 * Create a fresh test database
 * @param useMemory - If true, uses in-memory database (faster, but no persistence)
 */
export function createTestDatabase(useMemory = true): {
  db: ReturnType<typeof drizzle>;
  sqlite: Database.Database;
} {
  // Close existing connection if any
  if (testDb) {
    testDb.close();
  }

  let dbPath: string;
  if (useMemory) {
    // In-memory database (faster, but data is lost when connection closes)
    dbPath = ":memory:";
  } else {
    // File-based test database
    dbPath = join(process.cwd(), "test.db");
    // Remove existing test database if it exists
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }

  const sqlite = new Database(dbPath);
  
  // Only enable WAL mode for file-based databases (not in-memory)
  if (!useMemory) {
    try {
      sqlite.pragma("journal_mode = WAL");
    } catch (error) {
      // Ignore WAL errors for in-memory or if not supported
    }
  }

  const db = drizzle(sqlite, { schema });
  
  // For in-memory databases, we need to create tables manually
  // For file-based, we can use drizzle-kit push
  if (useMemory) {
    // Create essential tables manually for in-memory DB
    createTablesManually(sqlite);
  } else {
    // Use drizzle-kit push for file-based DB
    try {
      execSync(`npx drizzle-kit push --url "file:${dbPath}" --schema src/server/db/schema.ts`, {
        stdio: "ignore",
        cwd: process.cwd(),
      });
    } catch (error) {
      // Fallback to manual creation if drizzle-kit fails
      createTablesManually(sqlite);
    }
  }
  
  testDb = sqlite;
  testDrizzle = db;

  return {
    db: testDrizzle,
    sqlite,
  };
}

/**
 * Manually create essential tables for testing
 * This is a simplified version - only creates tables we need for tests
 */
function createTablesManually(sqlite: Database.Database): void {
  // Create Better Auth user table (from better-auth-schema.ts)
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

  // Create portal users table (from schema.ts - has password field)
  // Note: This might be the same table, but schema.ts defines it with password
  // Let's add password column if it doesn't exist
  try {
    sqlite.exec(`ALTER TABLE getlostportal_user ADD COLUMN password TEXT`);
  } catch (error) {
    // Column already exists or table doesn't exist - that's okay
  }

  // Create books table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS getlostportal_book (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      coverImageUrl TEXT,
      authorName TEXT,
      authorBio TEXT,
      manuscriptStatus TEXT DEFAULT 'queued',
      createdAt INTEGER DEFAULT (unixepoch()) NOT NULL,
      updatedAt INTEGER
    )
  `);

  // Create book_versions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS getlostportal_book_version (
      id TEXT PRIMARY KEY,
      bookId TEXT NOT NULL,
      versionNumber INTEGER NOT NULL,
      fileName TEXT NOT NULL,
      fileUrl TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      fileType TEXT NOT NULL,
      fileData TEXT,
      mimeType TEXT,
      summary TEXT,
      uploadedAt INTEGER DEFAULT (unixepoch()) NOT NULL
    )
  `);
}

/**
 * Close test database connection
 */
export function closeTestDatabase(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
    testDrizzle = null;
  }

  // Clean up test database file
  const testDbPath = join(process.cwd(), "test.db");
  if (existsSync(testDbPath)) {
    try {
      unlinkSync(testDbPath);
    } catch (error) {
      // Ignore errors (file might be locked)
    }
  }
}

/**
 * Clean all tables in test database
 */
export async function cleanTestDatabase(db: ReturnType<typeof drizzle>): Promise<void> {
  // Get all table names
  const tables = await db.execute(sql`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name LIKE 'getlostportal_%'
  `);

  // Delete all data from tables (in reverse order to handle foreign keys)
  const tableNames = (tables as Array<{ name: string }>).map((t) => t.name).reverse();
  
  for (const tableName of tableNames) {
    await db.execute(sql.raw(`DELETE FROM ${tableName}`));
  }
}
