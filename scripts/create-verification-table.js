#!/usr/bin/env node

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get database path from environment or use default
let dbPath = process.env.DATABASE_URL || "./dev.db";

// Remove file:// or file: prefix if present
if (dbPath.startsWith("file://")) {
  dbPath = dbPath.replace(/^file:\/\//, "");
} else if (dbPath.startsWith("file:")) {
  dbPath = dbPath.replace(/^file:/, "");
}

console.log("📦 Creating Better Auth verification table...");
console.log("   Database path:", dbPath);

if (!fs.existsSync(dbPath)) {
  console.error("❌ Database file not found:", dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

try {
  // Check if table already exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='getlostportal_verification'
  `).get();

  if (tableExists) {
    console.log("✅ Verification table already exists");
    db.close();
    process.exit(0);
  }

  // Create the verification table
  console.log("🔄 Creating getlostportal_verification table...");
  db.exec(`
    CREATE TABLE IF NOT EXISTS getlostportal_verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
    )
  `);

  console.log("✅ Verification table created successfully!");
  
  // Verify it was created
  const verify = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='getlostportal_verification'
  `).get();
  
  if (verify) {
    console.log("✅ Verified: Table exists");
  } else {
    console.error("❌ Error: Table was not created");
    process.exit(1);
  }
  
  db.close();
  console.log("✅ Done!");
} catch (error) {
  console.error("❌ Error creating verification table:", error.message);
  db.close();
  process.exit(1);
}

