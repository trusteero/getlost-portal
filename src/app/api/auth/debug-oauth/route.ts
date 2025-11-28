import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Debug endpoint to check OAuth configuration
 * Shows what redirect URIs Better Auth is using
 */
export async function GET() {
  const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  
  // Better Auth uses this format for Google OAuth callback
  const googleCallbackURL = `${baseURL}/api/auth/callback/google`;
  
  const config = {
    baseURL,
    googleCallbackURL,
    environment: {
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "NOT SET",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "NOT SET",
      NODE_ENV: process.env.NODE_ENV || "NOT SET",
    },
    googleOAuth: {
      clientId: process.env.AUTH_GOOGLE_ID ? `${process.env.AUTH_GOOGLE_ID.substring(0, 20)}...` : "NOT SET",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ? "SET" : "NOT SET",
    },
    instructions: {
      step1: "Go to Google Cloud Console → APIs & Services → Credentials",
      step2: "Click on your OAuth 2.0 Client ID",
      step3: `Add this EXACT URL to "Authorized redirect URIs":`,
      exactURL: googleCallbackURL,
      step4: "Click SAVE and wait 2-5 minutes",
      step5: "Try signing in again",
    },
  };

  return NextResponse.json(config, { status: 200 });
}

