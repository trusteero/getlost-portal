import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get database path from env or default
let dbPath = process.env.DATABASE_URL || "./dev.db";
if (dbPath.startsWith("file://")) {
  dbPath = dbPath.replace(/^file:\/\//, "");
} else if (dbPath.startsWith("file:")) {
  dbPath = dbPath.replace(/^file:/, "");
}

// Resolve to absolute path
if (!path.isAbsolute(dbPath)) {
  dbPath = path.resolve(process.cwd(), dbPath);
}

console.log("📦 Ensuring Better Auth tables exist...");
console.log("Database path:", dbPath);

if (!fs.existsSync(dbPath)) {
  console.log("⚠️  Database file doesn't exist, creating it...");
  // Create directory if needed
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

    const sqlite = new Database(dbPath);

try {
  // Create user table if it doesn't exist (must be first, as other tables reference it)
  const userTableExists = sqlite.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='getlostportal_user'
  `).get();

  if (!userTableExists) {
    console.log("🔄 Creating user table...");
    sqlite.exec(`
      CREATE TABLE getlostportal_user (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT NOT NULL UNIQUE,
        emailVerified INTEGER DEFAULT 0,
        image TEXT,
        role TEXT DEFAULT 'user' NOT NULL,
        password TEXT,
        createdAt INTEGER DEFAULT (unixepoch()) NOT NULL,
        updatedAt INTEGER DEFAULT (unixepoch()) NOT NULL
      )
    `);
    console.log("✅ User table created");
  } else {
    console.log("✅ User table already exists");
    // Check if password column exists, add it if missing (for compatibility with Render)
    try {
      const columns = sqlite.prepare("PRAGMA table_info(getlostportal_user)").all();
      const hasPassword = columns.some((col: any) => col.name === "password");
      if (!hasPassword) {
        sqlite.exec(`ALTER TABLE getlostportal_user ADD COLUMN password TEXT`);
        console.log("✅ Added password column to existing user table");
      }
    } catch (error) {
      // Column might already exist, that's okay
    }
  }

  // Create account table if it doesn't exist
  const accountTableExists = sqlite.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='getlostportal_account'
  `).get();

  if (!accountTableExists) {
    console.log("🔄 Creating account table...");
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
    console.log("✅ Account table created");
  } else {
    console.log("✅ Account table already exists");
  }

  // Create session table if it doesn't exist
  const sessionTableExists = sqlite.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='getlostportal_session'
  `).get();

  if (!sessionTableExists) {
    console.log("🔄 Creating session table...");
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
    console.log("✅ Session table created");
  } else {
    console.log("✅ Session table already exists");
  }

  // Create verification table if it doesn't exist
  const verificationTableExists = sqlite.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='getlostportal_verification'
  `).get();

  if (!verificationTableExists) {
    console.log("🔄 Creating verification table...");
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
    console.log("✅ Verification table created");
  } else {
    console.log("✅ Verification table already exists");
  }

  console.log("\n✅ All Better Auth tables are ready!");
} catch (error) {
  console.error("❌ Error ensuring tables:", error);
  process.exit(1);
} finally {
  sqlite.close();
}

