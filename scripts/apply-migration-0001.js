import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";

const dbPath = process.env.DATABASE_URL || "./dev.db";
let resolvedPath = dbPath;

if (resolvedPath.startsWith("file://")) {
  resolvedPath = resolvedPath.replace(/^file:\/\//, "");
} else if (resolvedPath.startsWith("file:")) {
  resolvedPath = resolvedPath.replace(/^file:/, "");
}

console.log(`📁 Database path: ${resolvedPath}`);

const db = new Database(resolvedPath);

try {
  // Read the migration file
  const migrationFile = join(process.cwd(), "drizzle", "0001_square_sleepwalker.sql");
  console.log(`📄 Reading migration file: ${migrationFile}`);
  
  const migrationSQL = readFileSync(migrationFile, "utf-8");
  
  // Split by statement breakpoint and execute each statement
  const statements = migrationSQL
    .split("--> statement-breakpoint")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));
  
  console.log(`📦 Found ${statements.length} statements to execute`);
  
  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (stmt.trim()) {
      try {
        console.log(`  Executing statement ${i + 1}/${statements.length}...`);
        db.exec(stmt);
      } catch (error) {
        // If table already exists, that's okay
        const errorMessage = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
        if (errorMessage.includes("already exists")) {
          console.log(`  ⚠️  Table already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }
  }
  
  console.log("✅ Migration applied successfully!");
} catch (error) {
  const errorMessage = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
  console.error("❌ Migration failed:", errorMessage);
  process.exit(1);
} finally {
  db.close();
}

