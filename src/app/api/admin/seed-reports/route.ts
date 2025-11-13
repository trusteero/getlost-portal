import { NextRequest, NextResponse } from "next/server";
import { isAdminFromRequest } from "@/server/auth";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * POST /api/admin/seed-reports
 * Run the seed-reports-only.js script to create system book and seed reports
 */
export async function POST(request: NextRequest) {
  const isAdmin = await isAdminFromRequest(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    console.log("[Seed Reports] Starting seed script...");
    
    const scriptPath = "scripts/seed-reports-only.js";
    const cwd = process.cwd();
    
    // Set environment variables for the script
    const env = {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || "file:/var/data/db.sqlite",
      BOOK_REPORTS_PATH: process.env.BOOK_REPORTS_PATH || "/var/data/book-reports",
      NODE_ENV: process.env.NODE_ENV || "production",
    };

    console.log("[Seed Reports] Environment:", {
      DATABASE_URL: env.DATABASE_URL,
      BOOK_REPORTS_PATH: env.BOOK_REPORTS_PATH,
    });

    // Run the seed script
    const { stdout, stderr } = await execAsync(`node ${scriptPath}`, {
      cwd,
      env,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large output
    });

    console.log("[Seed Reports] Script output:", stdout);
    if (stderr) {
      console.warn("[Seed Reports] Script warnings:", stderr);
    }

    // Parse output to get summary
    const seededMatch = stdout.match(/✅ Seeded: (\d+) report\(s\)/);
    const errorsMatch = stdout.match(/❌ Errors: (\d+) report\(s\)/);
    
    const seeded = seededMatch ? parseInt(seededMatch[1], 10) : 0;
    const errors = errorsMatch ? parseInt(errorsMatch[1], 10) : 0;

    return NextResponse.json({
      success: true,
      message: `Seed script completed. Seeded: ${seeded}, Errors: ${errors}`,
      seeded,
      errors,
      output: stdout,
      warnings: stderr || null,
    });
  } catch (error: any) {
    console.error("[Seed Reports] Failed to run seed script:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to run seed script",
        details: error.message || String(error),
        stdout: error.stdout || null,
        stderr: error.stderr || null,
      },
      { status: 500 }
    );
  }
}

