#!/usr/bin/env node
/**
 * Script to delete a specific user from the database
 * Usage: node scripts/delete-user.js <email>
 * Example: node scripts/delete-user.js user@example.com
 * 
 * WARNING: This will delete:
 * - The user
 * - All their sessions (Better Auth)
 * - All their accounts (Better Auth)
 * - All their books (cascade delete)
 * - All book versions (cascade delete)
 * - All reports (cascade delete)
 * - All notifications (cascade delete)
 * - All user activity records (cascade delete)
 * 
 * This is a destructive operation and cannot be undone!
 */

import Database from "better-sqlite3";
import { existsSync } from "fs";
import { dirname } from "path";

const DATABASE_URL = process.env.DATABASE_URL || "file:/var/data/db.sqlite";
const emailToDelete = process.argv[2];

if (!emailToDelete) {
  console.error("❌ Please provide an email address");
  console.error("Usage: node scripts/delete-user.js <email>");
  console.error("Example: node scripts/delete-user.js user@example.com");
  process.exit(1);
}

// Parse database path
let dbPath = DATABASE_URL;
if (dbPath.startsWith('file://')) {
  dbPath = dbPath.replace(/^file:\/\//, '');
} else if (dbPath.startsWith('file:')) {
  dbPath = dbPath.replace(/^file:/, '');
}

console.log("🗑️  Deleting user from database...");
console.log(`   Email: ${emailToDelete}`);
console.log(`   Database: ${dbPath}\n`);

if (!existsSync(dbPath)) {
  console.error(`❌ Database file does not exist: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);

try {
  // Start transaction
  db.exec("BEGIN TRANSACTION");

  // Check if user exists in Better Auth 'user' table
  let user = db.prepare(`
    SELECT id, email, name, role 
    FROM getlostportal_user 
    WHERE email = ?
  `).get(emailToDelete.toLowerCase());

  // If not found, check old schema
  if (!user) {
    user = db.prepare(`
      SELECT id, email, name, role 
      FROM getlostportal_user 
      WHERE email = ?
    `).get(emailToDelete.toLowerCase());
  }

  if (!user) {
    console.log(`❌ User with email '${emailToDelete}' not found`);
    db.exec("ROLLBACK");
    db.close();
    process.exit(1);
  }

  const userId = user.id;
  console.log(`✅ Found user:`);
  console.log(`   ID: ${userId}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.name || 'N/A'}`);
  console.log(`   Role: ${user.role || 'user'}\n`);

  // Count related records
  const bookCount = db.prepare(`
    SELECT COUNT(*) as count FROM getlostportal_book WHERE userId = ?
  `).get(userId);
  const books = bookCount?.count || 0;

  const sessionCount = db.prepare(`
    SELECT COUNT(*) as count FROM getlostportal_session WHERE user_id = ?
  `).get(userId);
  const sessions = sessionCount?.count || 0;

  const accountCount = db.prepare(`
    SELECT COUNT(*) as count FROM getlostportal_account WHERE user_id = ?
  `).get(userId);
  const accounts = accountCount?.count || 0;

  console.log(`📊 Related records:`);
  console.log(`   Books: ${books}`);
  console.log(`   Sessions: ${sessions}`);
  console.log(`   Accounts: ${accounts}\n`);

  // Confirm deletion
  console.log(`⚠️  WARNING: This will delete the user and all related data!`);
  console.log(`   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n`);
  
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Delete in order to respect foreign key constraints
  console.log("🗑️  Deleting related records...");

  // Delete reports (via book versions)
  const reportCount = db.prepare(`
    DELETE FROM getlostportal_report 
    WHERE bookVersionId IN (
      SELECT id FROM getlostportal_book_version 
      WHERE bookId IN (SELECT id FROM getlostportal_book WHERE userId = ?)
    )
  `).run(userId);
  console.log(`   Deleted ${reportCount.changes} report(s)`);

  // Delete digest jobs
  const digestCount = db.prepare(`
    DELETE FROM getlostportal_digest_job 
    WHERE bookId IN (SELECT id FROM getlostportal_book WHERE userId = ?)
  `).run(userId);
  console.log(`   Deleted ${digestCount.changes} digest job(s)`);

  // Delete book versions
  const versionCount = db.prepare(`
    DELETE FROM getlostportal_book_version 
    WHERE bookId IN (SELECT id FROM getlostportal_book WHERE userId = ?)
  `).run(userId);
  console.log(`   Deleted ${versionCount.changes} book version(s)`);

  // Delete books
  const deletedBooks = db.prepare(`
    DELETE FROM getlostportal_book WHERE userId = ?
  `).run(userId);
  console.log(`   Deleted ${deletedBooks.changes} book(s)`);

  // Delete sessions (Better Auth)
  const deletedSessions = db.prepare(`
    DELETE FROM getlostportal_session WHERE user_id = ?
  `).run(userId);
  console.log(`   Deleted ${deletedSessions.changes} session(s)`);

  // Delete accounts (Better Auth)
  const deletedAccounts = db.prepare(`
    DELETE FROM getlostportal_account WHERE user_id = ?
  `).run(userId);
  console.log(`   Deleted ${deletedAccounts.changes} account(s)`);

  // Delete notifications
  const notificationCount = db.prepare(`
    DELETE FROM getlostportal_notification WHERE userId = ?
  `).run(userId);
  console.log(`   Deleted ${notificationCount.changes} notification(s)`);

  // Delete user activity
  const activityCount = db.prepare(`
    DELETE FROM getlostportal_user_activity WHERE userId = ?
  `).run(userId);
  console.log(`   Deleted ${activityCount.changes} activity record(s)`);

  // Finally, delete the user
  console.log("\n🗑️  Deleting user...");
  const deletedUser = db.prepare(`
    DELETE FROM getlostportal_user WHERE id = ?
  `).run(userId);

  if (deletedUser.changes === 0) {
    console.log("❌ Failed to delete user");
    db.exec("ROLLBACK");
    db.close();
    process.exit(1);
  }

  // Commit transaction
  db.exec("COMMIT");
  console.log("\n✅ Successfully deleted user and all related data");
  console.log(`   User ID: ${userId}`);
  console.log(`   Email: ${emailToDelete}`);

  db.close();
  process.exit(0);
} catch (error) {
  console.error("\n❌ Error deleting user:", error);
  db.exec("ROLLBACK");
  db.close();
  process.exit(1);
}

