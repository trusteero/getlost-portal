import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { runPendingMigrations } from "@/server/db/migrations";

/**
 * Admin-only endpoint to fix missing database columns
 * This can be called via HTTP to fix the database without shell access
 */
export async function POST(request: NextRequest) {
  const isAdmin = await isAdminFromRequest(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Use the safe migration system
    const result = await runPendingMigrations();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.changesMade
          ? "Database columns added successfully"
          : "All columns already exist",
        changesMade: result.changesMade,
        errors: result.errors,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to run migrations",
          errors: result.errors,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Failed to fix database:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fix database",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

