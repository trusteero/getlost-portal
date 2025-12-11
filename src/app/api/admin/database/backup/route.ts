import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { env } from "@/env";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/database/backup
 * Download a backup of the database file
 */
export async function GET(request: NextRequest) {
  const isAdmin = await isAdminFromRequest(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get database path
    let dbPath = env.DATABASE_URL;
    if (dbPath.startsWith("file://")) {
      dbPath = dbPath.replace(/^file:\/\//, "");
    } else if (dbPath.startsWith("file:")) {
      dbPath = dbPath.replace(/^file:/, "");
    }
    
    // Resolve to absolute path
    if (!path.isAbsolute(dbPath)) {
      dbPath = path.resolve(process.cwd(), dbPath);
    }

    // Check if database exists
    if (!existsSync(dbPath)) {
      return NextResponse.json(
        { error: "Database file not found" },
        { status: 404 }
      );
    }

    // Read database file
    const dbBuffer = readFileSync(dbPath);
    const stats = statSync(dbPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `db-backup-${timestamp}.sqlite`;

    // Return file as download
    return new NextResponse(dbBuffer, {
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": stats.size.toString(),
      },
    });
  } catch (error) {
    console.error("[Admin Backup] Failed to create backup:", error);
    console.error("[Admin Backup] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to create backup" },
      { status: 500 }
    );
  }
}

