import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { env } from "@/env";

/**
 * API endpoint to remove all users from the database
 * 
 * WARNING: This is a destructive operation!
 * 
 * Usage: POST /api/admin/remove-all-users
 * Requires: Admin authentication (check in the handler)
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Add admin authentication check here
    // For now, this is unprotected - you should add auth!
    
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
      const count = userCount ? (userCount as any).count : 0;
      console.log(`Found ${count} users to delete`);

      if (count === 0) {
        db.exec("ROLLBACK");
        db.close();
        return NextResponse.json({ 
          success: true, 
          message: "No users to delete",
          deleted: {
            users: 0,
            books: 0,
            digestJobs: 0,
            bookVersions: 0,
            reports: 0,
            sessions: 0,
            accounts: 0,
            verificationTokens: 0,
            notifications: 0,
            activityRecords: 0,
          }
        });
      }

      // Delete in order to respect foreign key constraints
      const reportCount = db.prepare(`
        DELETE FROM getlostportal_report 
        WHERE bookVersionId IN (
          SELECT id FROM getlostportal_book_version 
          WHERE bookId IN (SELECT id FROM getlostportal_book WHERE userId IN (SELECT id FROM getlostportal_user))
        )
      `).run();

      const digestJobCount = db.prepare(`
        DELETE FROM getlostportal_digest_job 
        WHERE bookId IN (SELECT id FROM getlostportal_book WHERE userId IN (SELECT id FROM getlostportal_user))
      `).run();

      const versionCount = db.prepare(`
        DELETE FROM getlostportal_book_version 
        WHERE bookId IN (SELECT id FROM getlostportal_book WHERE userId IN (SELECT id FROM getlostportal_user))
      `).run();

      const bookCount = db.prepare("DELETE FROM getlostportal_book WHERE userId IN (SELECT id FROM getlostportal_user)").run();

      const sessionCount = db.prepare("DELETE FROM getlostportal_session").run();
      const accountCount = db.prepare("DELETE FROM getlostportal_account").run();
      const verificationCount = db.prepare("DELETE FROM getlostportal_verification").run();
      const notificationCount = db.prepare("DELETE FROM getlostportal_notification").run();
      const activityCount = db.prepare("DELETE FROM getlostportal_user_activity").run();

      const deleteUsers = db.prepare("DELETE FROM getlostportal_user");
      const result = deleteUsers.run();

      // Commit transaction
      db.exec("COMMIT");

      const summary = {
        users: result.changes,
        books: bookCount.changes,
        digestJobs: digestJobCount.changes,
        bookVersions: versionCount.changes,
        reports: reportCount.changes,
        sessions: sessionCount.changes,
        accounts: accountCount.changes,
        verificationTokens: verificationCount.changes,
        notifications: notificationCount.changes,
        activityRecords: activityCount.changes,
      };

      console.log("✅ Successfully removed all users:", summary);

      return NextResponse.json({
        success: true,
        message: "All users removed successfully",
        deleted: summary,
      });

    } catch (error: any) {
      db.exec("ROLLBACK");
      console.error("❌ Error removing users:", error);
      return NextResponse.json(
        { 
          success: false, 
          error: error?.message || "Failed to remove users" 
        },
        { status: 500 }
      );
    } finally {
      db.close();
    }

  } catch (error: any) {
    console.error("❌ Database connection error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || "Failed to connect to database" 
      },
      { status: 500 }
    );
  }
}

