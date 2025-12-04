import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import Database from "better-sqlite3";
import { sqlite } from "@/server/db";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const isAdmin = await isAdminFromRequest(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!sqlite) {
    return NextResponse.json({ error: "Database not available" }, { status: 500 });
  }

  try {
    const results: string[] = [];
    
    // Read the first migration file
    const migrationFile = path.resolve(process.cwd(), "drizzle", "0000_talented_shatterstar.sql");
    
    if (!fs.existsSync(migrationFile)) {
      return NextResponse.json({ error: "Migration file not found" }, { status: 500 });
    }

    const sql = fs.readFileSync(migrationFile, "utf-8");
    
    // Split by statement-breakpoint and execute each CREATE TABLE statement
    const statements = sql.split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      if (statement.trim().length === 0) continue;
      
      try {
        sqlite.exec(statement);
        // Extract table name if it's a CREATE TABLE statement
        const tableMatch = statement.match(/CREATE TABLE[^`]*`([^`]+)`/);
        if (tableMatch) {
          results.push(`✅ Created table: ${tableMatch[1]}`);
        } else if (statement.includes('CREATE INDEX')) {
          const indexMatch = statement.match(/CREATE INDEX[^`]*`([^`]+)`/);
          if (indexMatch) {
            results.push(`✅ Created index: ${indexMatch[1]}`);
          }
        }
      } catch (error: any) {
        if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          // Table/index already exists, that's okay
          continue;
        }
        results.push(`⚠️  Warning: ${error.message}`);
      }
    }

    // Verify tables were created
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'getlostportal_%'").all() as Array<{ name: string }>;
    const tableNames = tables.map(t => t.name);
    
    return NextResponse.json({
      success: true,
      message: "Tables created successfully",
      tables: tableNames,
      details: results,
    });
  } catch (error: any) {
    console.error("Failed to create tables:", error);
    return NextResponse.json(
      { error: "Failed to create tables", details: error.message },
      { status: 500 }
    );
  }
}

