import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { sqlite } from "@/server/db";

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
    const body = await request.json();
    const { query: rawQuery } = body;

    if (!rawQuery || typeof rawQuery !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const query = rawQuery.trim();

    // Security: Only allow SELECT statements (read-only)
    const upperQuery = query.toUpperCase().trim();
    if (!upperQuery.startsWith("SELECT")) {
      return NextResponse.json(
        { error: "Only SELECT queries are allowed for safety" },
        { status: 400 }
      );
    }

    // Additional safety: Block dangerous keywords
    const dangerousKeywords = [
      "DROP",
      "DELETE",
      "UPDATE",
      "INSERT",
      "ALTER",
      "CREATE",
      "TRUNCATE",
      "EXEC",
      "EXECUTE",
    ];

    for (const keyword of dangerousKeywords) {
      if (upperQuery.includes(keyword)) {
        return NextResponse.json(
          { error: `Query contains forbidden keyword: ${keyword}` },
          { status: 400 }
        );
      }
    }

    // Execute query
    const rows = sqlite.prepare(query).all() as any[];

    // Convert result to array format
    const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];

    return NextResponse.json({
      columns,
      rows: rows.map((row) => columns.map((col) => row[col])),
    });
  } catch (error) {
    console.error("[Admin Database] Query execution failed:", error);
    console.error("[Admin Database] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Query execution failed",
        columns: [],
        rows: [],
      },
      { status: 500 }
    );
  }
}

