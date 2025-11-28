import { NextResponse } from "next/server";
import { sqlite } from "@/server/db";
import { ensureBooksTableColumns } from "@/server/db/migrations";

/**
 * Health check endpoint that also ensures migrations are run
 * This is called on startup and ensures the database is ready
 */
export async function GET() {
  try {
    // Ensure migrations are run
    if (sqlite) {
      ensureBooksTableColumns();
    }

    return NextResponse.json({
      status: "ok",
      database: sqlite ? "connected" : "not connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

