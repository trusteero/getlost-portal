#!/usr/bin/env node
/**
 * Script to check if user data persists across deployments
 * Usage: node scripts/check-user-persistence.js [email]
 */

import Database from "better-sqlite3";
import { existsSync } from "fs";
import { dirname } from "path";

const DATABASE_URL = process.env.DATABASE_URL || "file:/var/data/db.sqlite";
const emailToCheck = process.argv[2] || "eero.jyske@gmail.com";

// Parse database path
let dbPath = DATABASE_URL;
if (dbPath.startsWith('file://')) {
  dbPath = dbPath.replace(/^file:\/\//, '');
} else if (dbPath.startsWith('file:')) {
  dbPath = dbPath.replace(/^file:/, '');
}

console.log("🔍 Checking user persistence...");
console.log(`   Database URL: ${DATABASE_URL}`);
console.log(`   Resolved path: ${dbPath}`);
console.log(`   Checking for user: ${emailToCheck}\n`);

// Check if database directory exists
const dbDir = dirname(dbPath);
const dirExists = existsSync(dbDir);
const dbExists = existsSync(dbPath);

console.log("📁 Directory check:");
console.log(`   Directory: ${dbDir}`);
console.log(`   Directory exists: ${dirExists ? "✅" : "❌"}`);
console.log(`   Database file exists: ${dbExists ? "✅" : "❌"}`);

if (!dirExists) {
  console.error("\n❌ ERROR: Database directory does not exist!");
  console.error(`   Expected: ${dbDir}`);
  console.error("   This means the persistent disk is not mounted correctly.");
  process.exit(1);
}

if (!dbExists) {
  console.error("\n❌ ERROR: Database file does not exist!");
  console.error(`   Expected: ${dbPath}`);
  console.error("   This means the database was never created or was deleted.");
  process.exit(1);
}

// Check database size
try {
  const stats = require('fs').statSync(dbPath);
  const sizeKB = Math.round(stats.size / 1024);
  console.log(`\n📊 Database info:`);
  console.log(`   Size: ${sizeKB} KB`);
} catch (error) {
  console.error("   ⚠️  Could not get database size:", error.message);
}

// Try to connect and check for user
try {
  console.log("\n🔌 Connecting to database...");
  const db = new Database(dbPath, { readonly: true });
  
  // Check what tables exist
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log(`\n📋 Tables found (${tables.length}):`);
  tables.forEach((table: any) => {
    console.log(`   - ${table.name}`);
  });
  
  // Check for user in Better Auth 'user' table
  let userFound = false;
  try {
    const user = db.prepare(`
      SELECT id, email, name, role, email_verified, created_at, updated_at 
      FROM user 
      WHERE email = ?
    `).get(emailToCheck.toLowerCase());
    
    if (user) {
      userFound = true;
      console.log(`\n✅ User found in 'user' table:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Role: ${user.role || "user"}`);
      console.log(`   Email Verified: ${user.email_verified ? "Yes" : "No"}`);
      console.log(`   Created: ${new Date(user.created_at * 1000).toISOString()}`);
      console.log(`   Updated: ${new Date(user.updated_at * 1000).toISOString()}`);
      
      // Check for account
      const account = db.prepare(`
        SELECT id, account_id, provider_id, user_id, created_at
        FROM account 
        WHERE user_id = ?
      `).get(user.id);
      
      if (account) {
        console.log(`\n✅ Account found:`);
        console.log(`   Account ID: ${account.id}`);
        console.log(`   Provider: ${account.provider_id}`);
        console.log(`   Created: ${new Date(account.created_at * 1000).toISOString()}`);
      } else {
        console.log(`\n⚠️  No account record found for this user`);
        console.log(`   User may not be able to log in without an account record`);
      }
    }
  } catch (error: any) {
    if (error.message.includes("no such table: user")) {
      console.log(`\n⚠️  'user' table does not exist (Better Auth table)`);
      console.log(`   Checking for old 'getlostportal_user' table...`);
      
      try {
        const oldUser = db.prepare(`
          SELECT id, email, name, role, emailVerified, createdAt, updatedAt 
          FROM getlostportal_user 
          WHERE email = ?
        `).get(emailToCheck.toLowerCase());
        
        if (oldUser) {
          console.log(`\n⚠️  User found in OLD 'getlostportal_user' table:`);
          console.log(`   This means the database hasn't been migrated to Better Auth`);
          console.log(`   User ID: ${oldUser.id}`);
          console.log(`   Email: ${oldUser.email}`);
        } else {
          console.log(`\n❌ User not found in old table either`);
        }
      } catch (oldError) {
        console.log(`\n❌ Old table also doesn't exist`);
      }
    } else {
      throw error;
    }
  }
  
  // Count total users
  try {
    const userCount = db.prepare("SELECT COUNT(*) as count FROM user").get();
    console.log(`\n📊 Total users in 'user' table: ${(userCount as any).count || 0}`);
  } catch {
    // Table doesn't exist
  }
  
  try {
    const oldUserCount = db.prepare("SELECT COUNT(*) as count FROM getlostportal_user").get();
    console.log(`📊 Total users in 'getlostportal_user' table: ${(oldUserCount as any).count || 0}`);
  } catch {
    // Table doesn't exist
  }
  
  db.close();
  
  if (!userFound) {
    console.log(`\n❌ User '${emailToCheck}' not found in database`);
    console.log(`\n💡 To create the user, run:`);
    console.log(`   npm run create-user ${emailToCheck} <password> "<name>"`);
    process.exit(1);
  } else {
    console.log(`\n✅ User persistence check passed!`);
    process.exit(0);
  }
} catch (error: any) {
  console.error("\n❌ Error checking database:", error.message);
  console.error(error);
  process.exit(1);
}

