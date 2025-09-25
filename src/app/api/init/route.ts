import { NextResponse } from "next/server";
import { initializeDatabase } from "@/server/db/init";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await initializeDatabase();
    return NextResponse.json({ status: "Database initialized successfully" });
  } catch (error) {
    console.error("Database initialization failed:", error);
    return NextResponse.json(
      { error: "Database initialization failed", details: error },
      { status: 500 }
    );
  }
}