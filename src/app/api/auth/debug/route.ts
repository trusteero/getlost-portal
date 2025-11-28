import { NextResponse } from "next/server";

/**
 * Debug endpoint to check Better Auth configuration
 * GET /api/auth/debug
 */
export async function GET() {
  const config = {
    environment: process.env.NODE_ENV,
    hasAuthSecret: !!(process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET),
    hasGoogleId: !!process.env.AUTH_GOOGLE_ID,
    hasGoogleSecret: !!process.env.AUTH_GOOGLE_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    databaseUrl: process.env.DATABASE_URL ? "Set" : "Not set",
    googleConfigured: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  };

  return NextResponse.json({
    message: "Better Auth Configuration Check",
    config,
    recommendations: [
      !config.hasAuthSecret && "⚠️  AUTH_SECRET is missing. Set it in your .env file.",
      !config.hasGoogleId && "⚠️  AUTH_GOOGLE_ID is missing. Google OAuth will not work.",
      !config.hasGoogleSecret && "⚠️  AUTH_GOOGLE_SECRET is missing. Google OAuth will not work.",
      config.googleConfigured && "✅ Google OAuth is configured correctly.",
    ].filter(Boolean),
  });
}

