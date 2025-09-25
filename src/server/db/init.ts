import { db } from "./index";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

export async function initializeDatabase() {
  console.log("🔧 Initializing database...");

  try {
    // Run migrations
    console.log("📦 Running database migrations...");
    migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✅ Database migrations completed");

    // Test database connection
    const result = await db.select({ count: sql<number>`1` }).from(sql`sqlite_master`);
    console.log("✅ Database connection verified");

    return true;
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}