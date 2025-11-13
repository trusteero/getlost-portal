import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/disk-status
 * Check persistent disk status and verify data persistence
 */
export async function GET(request: NextRequest) {
  const isAdmin = await isAdminFromRequest(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const diskPath = "/var/data";
    const dbPath = "/var/data/db.sqlite";
    
    const diskExists = existsSync(diskPath);
    const diskWritable = diskExists && (await fs.access(diskPath).then(() => true).catch(() => false));
    const dbExists = existsSync(dbPath);
    
    let dbSize = 0;
    let dbTables = 0;
    let lastInit = null;
    
    if (dbExists) {
      try {
        const stats = await fs.stat(dbPath);
        dbSize = stats.size;
        
        // Try to read table count
        const Database = (await import("better-sqlite3")).default;
        const db = new Database(dbPath, { readonly: true });
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        dbTables = tables.length;
        db.close();
      } catch (error) {
        console.error("Failed to read database info:", error);
      }
    }
    
    // Check for init marker
    try {
      const markerPath = path.join(diskPath, ".last-init");
      if (existsSync(markerPath)) {
        lastInit = await fs.readFile(markerPath, "utf-8");
      }
    } catch (error) {
      // Marker doesn't exist, that's okay
    }
    
    // Check directory structure
    const directories = {
      bookReports: existsSync(path.join(diskPath, "book-reports")),
      reports: existsSync(path.join(diskPath, "reports")),
      uploads: existsSync(path.join(diskPath, "uploads")),
      books: existsSync(path.join(diskPath, "books")),
      covers: existsSync(path.join(diskPath, "covers")),
    };
    
    return NextResponse.json({
      disk: {
        path: diskPath,
        exists: diskExists,
        writable: diskWritable,
        status: diskExists && diskWritable ? "✅ Mounted and writable" : "❌ Not available",
      },
      database: {
        path: dbPath,
        exists: dbExists,
        size: dbSize,
        sizeFormatted: `${Math.round(dbSize / 1024)} KB`,
        tables: dbTables,
        status: dbExists ? "✅ Exists" : "❌ Not found",
      },
      directories,
      lastInit,
      usingPersistentDisk: dbPath.startsWith("/var/data"),
      warning: !dbPath.startsWith("/var/data") 
        ? "⚠️ Database is NOT on persistent disk - data will be lost on redeploy!"
        : null,
    });
  } catch (error) {
    console.error("Failed to check disk status:", error);
    return NextResponse.json(
      { error: "Failed to check disk status", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

