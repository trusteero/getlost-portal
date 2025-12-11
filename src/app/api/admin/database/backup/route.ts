import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { createReadStream, existsSync, statSync } from "fs";
import path from "path";
import { env } from "@/env";
import { Readable } from "stream";

export const dynamic = 'force-dynamic';

/**
 * Convert a Node.js Readable stream to a Web ReadableStream
 */
function nodeStreamToWebStream(nodeStream: Readable): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => {
        controller.enqueue(chunk);
      });
      nodeStream.on('end', () => {
        controller.close();
      });
      nodeStream.on('error', (error) => {
        controller.error(error);
      });
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

/**
 * GET /api/admin/database/backup
 * Download a backup of the database file (streaming to avoid memory issues)
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

    // Get file stats for Content-Length header
    const stats = statSync(dbPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `db-backup-${timestamp}.sqlite`;

    // Create a readable stream from the file (doesn't load entire file into memory)
    const fileStream = createReadStream(dbPath);
    const webStream = nodeStreamToWebStream(fileStream);

    // Return file as streaming download
    return new NextResponse(webStream, {
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

