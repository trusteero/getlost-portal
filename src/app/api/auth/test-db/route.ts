import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import fs from "fs";
import { env } from "@/env";

export async function GET() {
  try {
    // Get database path
    let dbPath = env.DATABASE_URL || "./dev.db";
    if (dbPath.startsWith("file://")) {
      dbPath = dbPath.replace(/^file:\/\//, "");
    } else if (dbPath.startsWith("file:")) {
      dbPath = dbPath.replace(/^file:/, "");
    }

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({
        error: "Database file does not exist",
        path: dbPath,
      }, { status: 404 });
    }

    const sqlite = new Database(dbPath);
    
    try {
      // Check all Better Auth tables
      const tables = [
        "getlostportal_user",
        "getlostportal_account",
        "getlostportal_session",
        "getlostportal_verification",
      ];

      const tableStatus: Record<string, { exists: boolean; columns?: string[] }> = {};

      for (const tableName of tables) {
        const tableInfo = sqlite.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name=?
        `).get(tableName);

        if (tableInfo) {
          const columns = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
          tableStatus[tableName] = {
            exists: true,
            columns: columns.map(c => c.name),
          };
        } else {
          tableStatus[tableName] = {
            exists: false,
          };
        }
      }

      return NextResponse.json({
        databasePath: dbPath,
        databaseExists: true,
        tables: tableStatus,
      });
    } finally {
      sqlite.close();
    }
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    }, { status: 500 });
  }
}

