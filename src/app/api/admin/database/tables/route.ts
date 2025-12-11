import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { sqlite } from "@/server/db";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const isAdmin = await isAdminFromRequest(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!sqlite) {
    return NextResponse.json({ error: "Database not available" }, { status: 500 });
  }

  try {
    if (!sqlite) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    // Get all tables (SQLite)
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as Array<{ name: string }>;

    const tableInfos = tables.map((table) => {
      const tableName = table.name;
      
      // Get row count
      const countResult = sqlite!
        .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
        .get() as { count: number };
      const rowCount = countResult?.count || 0;

      // Get column info
      const columnsResult = sqlite!
        .prepare(`PRAGMA table_info(${tableName})`)
        .all() as Array<{ name: string; type: string; notnull: number }>;
      const columns = columnsResult.map((col) => ({
        name: col.name,
        type: col.type,
        nullable: col.notnull === 0,
      }));

      return {
        name: tableName,
        rowCount: Number(rowCount),
        columns,
      };
    });

    return NextResponse.json(tableInfos);
  } catch (error) {
    console.error("[Admin Database] Failed to fetch tables:", error);
    console.error("[Admin Database] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to fetch tables" },
      { status: 500 }
    );
  }
}

