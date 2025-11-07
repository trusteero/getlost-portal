#!/usr/bin/env node

/**
 * Script to remove all users from the database
 * 
 * WARNING: This will delete:
 * - All users
 * - All sessions (Better Auth)
 * - All accounts (Better Auth)
 * - All books (cascade delete)
 * - All book versions (cascade delete)
 * - All reports (cascade delete)
 * - All notifications (cascade delete)
 * - All user activity records (cascade delete)
 * 
 * This is a destructive operation and cannot be undone!
 */

import Database from "better-sqlite3";
import { env } from "../src/env.js";

// Get database path
let dbPath = env.DATABASE_URL || "./dev.db";
if (dbPath.startsWith("file://")) {
  dbPath = dbPath.replace(/^file:\/\//, "");
} else if (dbPath.startsWith("file:")) {
  dbPath = dbPath.replace(/^file:/, "");
}

console.log("🗑️  Removing all users from database...");
console.log("Database path:", dbPath);

const db = new Database(dbPath);

try {
  // Start transaction
  db.exec("BEGIN TRANSACTION");

  // Count users before deletion
  const userCount = db.prepare("SELECT COUNT(*) as count FROM getlostportal_user").get();
  const count = userCount ? userCount.count : 0;
  console.log(`Found ${count} users to delete`);

  if (count === 0) {
    console.log("✅ No users to delete");
    db.exec("ROLLBACK");
    db.close();
    process.exit(0);
  }

  // Delete in order to respect foreign key constraints
  // Need to delete child records before parent records
  
  console.log("Deleting reports...");
  const reportCount = db.prepare(`
    DELETE FROM getlostportal_report 
    WHERE bookVersionId IN (
      SELECT id FROM getlostportal_book_version 
      WHERE bookId IN (SELECT id FROM getlostportal_book WHERE userId IN (SELECT id FROM getlostportal_user))
    )
  `).run();
  console.log(`  Deleted ${reportCount.changes} reports`);

  console.log("Deleting digest jobs...");
  const digestJobCount = db.prepare(`
    DELETE FROM getlostportal_digest_job 
    WHERE bookId IN (SELECT id FROM getlostportal_book WHERE userId IN (SELECT id FROM getlostportal_user))
  `).run();
  console.log(`  Deleted ${digestJobCount.changes} digest jobs`);

  console.log("Deleting book versions...");
  const versionCount = db.prepare(`
    DELETE FROM getlostportal_book_version 
    WHERE bookId IN (SELECT id FROM getlostportal_book WHERE userId IN (SELECT id FROM getlostportal_user))
  `).run();
  console.log(`  Deleted ${versionCount.changes} book versions`);

  console.log("Deleting books...");
  const bookCount = db.prepare("DELETE FROM getlostportal_book WHERE userId IN (SELECT id FROM getlostportal_user)").run();
  console.log(`  Deleted ${bookCount.changes} books`);

  console.log("Deleting sessions...");
  const sessionCount = db.prepare("DELETE FROM getlostportal_session").run();
  console.log(`  Deleted ${sessionCount.changes} sessions`);

  console.log("Deleting accounts...");
  const accountCount = db.prepare("DELETE FROM getlostportal_account").run();
  console.log(`  Deleted ${accountCount.changes} accounts`);

  console.log("Deleting verification tokens...");
  const verificationCount = db.prepare("DELETE FROM getlostportal_verification").run();
  console.log(`  Deleted ${verificationCount.changes} verification tokens`);

  console.log("Deleting notifications...");
  const notificationCount = db.prepare("DELETE FROM getlostportal_notification").run();
  console.log(`  Deleted ${notificationCount.changes} notifications`);

  console.log("Deleting user activity records...");
  const activityCount = db.prepare("DELETE FROM getlostportal_user_activity").run();
  console.log(`  Deleted ${activityCount.changes} activity records`);

  console.log("Deleting users...");
  const deleteUsers = db.prepare("DELETE FROM getlostportal_user");
  const result = deleteUsers.run();
  
  console.log(`  Deleted ${result.changes} users`);

  // Commit transaction
  db.exec("COMMIT");

  console.log("✅ Successfully removed all users from the database");
  console.log(`   - Deleted ${result.changes} users`);
  console.log(`   - Deleted ${bookCount.changes} books`);
  console.log(`   - Deleted ${digestJobCount.changes} digest jobs`);
  console.log(`   - Deleted ${versionCount.changes} book versions`);
  console.log(`   - Deleted ${reportCount.changes} reports`);
  console.log(`   - Deleted ${sessionCount.changes} sessions`);
  console.log(`   - Deleted ${accountCount.changes} accounts`);
  console.log(`   - Deleted ${verificationCount.changes} verification tokens`);
  console.log(`   - Deleted ${notificationCount.changes} notifications`);
  console.log(`   - Deleted ${activityCount.changes} activity records`);

} catch (error) {
  console.error("❌ Error removing users:", error?.message || error);
  db.exec("ROLLBACK");
  process.exit(1);
} finally {
  db.close();
}

