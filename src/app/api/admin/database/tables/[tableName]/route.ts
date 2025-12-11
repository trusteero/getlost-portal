import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { sqlite } from "@/server/db";

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tableName: string }> }
) {
  const isAdmin = await isAdminFromRequest(request);
  const { tableName } = await params;

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!sqlite) {
    return NextResponse.json({ error: "Database not available" }, { status: 500 });
  }

  try {
    // Sanitize table name to prevent SQL injection
    // Only allow alphanumeric, underscore, and dash
    if (!/^[a-zA-Z0-9_-]+$/.test(tableName)) {
      return NextResponse.json(
        { error: "Invalid table name" },
        { status: 400 }
      );
    }

    // Get table data (limit to 1000 rows for performance)
    const rows = sqlite
      .prepare(`SELECT * FROM ${tableName} LIMIT 1000`)
      .all();

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("[Admin Database] Failed to fetch table data:", error);
    console.error("[Admin Database] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      tableName,
    });
    return NextResponse.json(
      { error: "Failed to fetch table data" },
      { status: 500 }
    );
  }
}

