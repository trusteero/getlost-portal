import { NextResponse } from "next/server";

/**
 * API endpoint to check which authentication providers are available
 * This allows the frontend to conditionally show/hide provider buttons
 */
export async function GET() {
  const hasGoogleCredentials = !!(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
  );

  return NextResponse.json({
    providers: {
      google: hasGoogleCredentials,
      email: true, // Email/password is always available
    },
  });
}

