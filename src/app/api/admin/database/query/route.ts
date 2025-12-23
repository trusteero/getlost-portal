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

    // Security: Block dangerous operations that could damage the database
    const upperQuery = query.toUpperCase().trim();
    
    // Block dangerous keywords that could damage the database structure
    const dangerousKeywords = [
      "DROP",
      "ALTER",
      "CREATE",
      "TRUNCATE",
      "EXEC",
      "EXECUTE",
      "ATTACH",
      "DETACH",
      "VACUUM",
    ];

    for (const keyword of dangerousKeywords) {
      if (upperQuery.includes(keyword)) {
        return NextResponse.json(
          { error: `Query contains forbidden keyword: ${keyword}. This operation could damage the database.` },
          { status: 400 }
        );
      }
    }

    // Allow: SELECT, UPDATE, INSERT, DELETE (with WHERE clause for safety)
    const allowedOperations = ["SELECT", "UPDATE", "INSERT", "DELETE"];
    const queryParts = upperQuery.split(/\s+/);
    const queryType = queryParts[0];
    
    if (!queryType || !allowedOperations.includes(queryType)) {
      return NextResponse.json(
        { error: `Query type "${queryType || 'unknown'}" is not allowed. Only SELECT, UPDATE, INSERT, and DELETE are permitted.` },
        { status: 400 }
      );
    }

    // Safety: Require WHERE clause for UPDATE and DELETE to prevent accidental mass updates
    if ((queryType === "UPDATE" || queryType === "DELETE") && !upperQuery.includes("WHERE")) {
      return NextResponse.json(
        { error: `${queryType} queries must include a WHERE clause for safety.` },
        { status: 400 }
      );
    }

    // Execute query with error handling
    const isSelectQuery = queryType === "SELECT";
    let rows: Record<string, unknown>[] = [];
    let changes = 0;
    let lastInsertRowid: number | bigint | null = null;

    try {
      if (isSelectQuery) {
        // Memory safety: Enforce maximum result size for SELECT queries
        const MAX_ROWS = 10000;
        
        // Check if query already has LIMIT clause
        const hasLimit = /LIMIT\s+\d+/i.test(query);
        
        let finalQuery = query;
        if (!hasLimit) {
          // Add LIMIT if not present
          finalQuery = `${query} LIMIT ${MAX_ROWS}`;
        } else {
          // Extract existing LIMIT value and enforce max
          const limitMatch = query.match(/LIMIT\s+(\d+)/i);
          if (limitMatch) {
            const limitValue = parseInt(limitMatch[1]!, 10);
            if (limitValue > MAX_ROWS) {
              finalQuery = query.replace(/LIMIT\s+\d+/i, `LIMIT ${MAX_ROWS}`);
            }
          }
        }

        const stmt = sqlite.prepare(finalQuery);
        rows = stmt.all() as Record<string, unknown>[];

        // Additional safety: Check result size
        if (rows.length > MAX_ROWS) {
          return NextResponse.json(
            {
              error: `Query result exceeds maximum allowed size (${MAX_ROWS} rows). Please add a LIMIT clause.`,
              columns: [],
              rows: [],
            },
            { status: 400 }
          );
        }
      } else {
        // For UPDATE, INSERT, DELETE: use run() to get changes count
        const stmt = sqlite.prepare(query);
        const result = stmt.run() as { changes: number; lastInsertRowid: number | bigint | null };
        changes = result.changes;
        lastInsertRowid = result.lastInsertRowid;
      }
    } catch (sqlError) {
      console.error("[Admin Database] SQL execution error:", sqlError);
      return NextResponse.json(
        {
          error: sqlError instanceof Error ? sqlError.message : "SQL query execution failed",
          columns: [],
          rows: [],
        },
        { status: 400 }
      );
    }

    // Return appropriate response based on query type
    if (isSelectQuery) {
      // Convert result to array format for SELECT
      const columns = rows.length > 0 && rows[0] ? Object.keys(rows[0]) : [];
      const hasLimit = /LIMIT\s+\d+/i.test(query);
      const MAX_ROWS = 10000;

      return NextResponse.json({
        columns,
        rows: rows.map((row) => columns.map((col) => (row && typeof row === 'object' && col in row ? row[col] : null))),
        truncated: rows.length === MAX_ROWS && !hasLimit,
        queryType: "SELECT",
      });
    } else {
      // Return changes count for write operations
      return NextResponse.json({
        columns: [],
        rows: [],
        queryType,
        changes,
        lastInsertRowid: lastInsertRowid !== null ? Number(lastInsertRowid) : null,
        message: queryType === "UPDATE" 
          ? `Updated ${changes} row(s)`
          : queryType === "INSERT"
          ? `Inserted 1 row (ID: ${lastInsertRowid})`
          : `Deleted ${changes} row(s)`,
      });
    }
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

