#!/usr/bin/env node
/**
 * Script to list all users in the database
 * Usage: node scripts/list-users.js
 */

import Database from "better-sqlite3";
import { existsSync } from "fs";
import { dirname } from "path";

const DATABASE_URL = process.env.DATABASE_URL || "file:/var/data/db.sqlite";

// Parse database path
let dbPath = DATABASE_URL;
if (dbPath.startsWith('file://')) {
  dbPath = dbPath.replace(/^file:\/\//, '');
} else if (dbPath.startsWith('file:')) {
  dbPath = dbPath.replace(/^file:/, '');
}

console.log("🔍 Listing all users in database...");
console.log(`   Database path: ${dbPath}\n`);

if (!existsSync(dbPath)) {
  console.error("❌ Database file does not exist!");
  process.exit(1);
}

try {
  const db = new Database(dbPath, { readonly: true });
  
  // Check Better Auth 'user' table
  try {
    const users = db.prepare("SELECT id, email, name, role, email_verified, created_at FROM user ORDER BY created_at").all();
    console.log(`📋 Users in 'user' table (Better Auth): ${users.length}`);
    users.forEach((user) => {
      console.log(`   - ${user.email} (${user.name || 'No name'}) - Role: ${user.role || 'user'} - Verified: ${user.email_verified ? 'Yes' : 'No'}`);
    });
  } catch (error) {
    if (error.message && error.message.includes("no such table: user")) {
      console.log("⚠️  'user' table (Better Auth) does not exist");
    } else {
      throw error;
    }
  }
  
  // Check old 'getlostportal_user' table
  try {
    const oldUsers = db.prepare("SELECT id, email, name, role, emailVerified, createdAt FROM getlostportal_user ORDER BY createdAt").all();
    console.log(`\n📋 Users in 'getlostportal_user' table (Legacy): ${oldUsers.length}`);
    oldUsers.forEach((user) => {
      console.log(`   - ${user.email} (${user.name || 'No name'}) - Role: ${user.role || 'user'} - Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
    });
  } catch (error) {
    if (error.message && error.message.includes("no such table: getlostportal_user")) {
      console.log("\n⚠️  'getlostportal_user' table does not exist");
    } else {
      throw error;
    }
  }
  
  db.close();
} catch (error) {
  console.error("\n❌ Error:", error?.message || String(error));
  process.exit(1);
}



