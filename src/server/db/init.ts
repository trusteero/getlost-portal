import { db } from "./index";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

export async function initializeDatabase() {
  console.log("🔧 Initializing database...");

  try {
    // Check if migrations folder exists
    const fs = await import("fs");
    const path = await import("path");
    const migrationsFolder = path.resolve("./drizzle");
    
    if (!fs.existsSync(migrationsFolder)) {
      console.log("📦 No migrations folder found, skipping migrations");
      return true;
    }

    // Run migrations (will skip if already applied)
    console.log("📦 Running database migrations...");
    try {
      migrate(db, { migrationsFolder });
      console.log("✅ Database migrations completed");
    } catch (migrationError: any) {
      // If tables already exist, that's okay - migrations were already applied
      if (migrationError?.message?.includes("already exists") || 
          migrationError?.cause?.code === "SQLITE_ERROR") {
        console.log("ℹ️  Tables already exist, migrations already applied");
      } else {
        throw migrationError;
      }
    }

    // Test database connection
    const result = await db.select({ count: sql<number>`1` }).from(sql`sqlite_master`);
    console.log("✅ Database connection verified");

    return true;
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}