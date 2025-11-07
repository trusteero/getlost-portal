import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

const handler = toNextJsHandler(auth);

export const POST = async (request: Request) => {
  try {
    // Log the request for debugging
    const url = new URL(request.url);
    const pathname = url.pathname;
    console.log("🔐 [Better Auth] POST request to:", pathname);
    
    // If it's a sign-in request, log the email being used
    if (pathname.includes("/sign-in") || pathname.includes("/signin")) {
      try {
        const body = await request.clone().json();
        if (body.email) {
          console.log("🔐 [Better Auth] Sign-in attempt for email:", body.email);
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }
    
    return await handler.POST(request);
  } catch (error: any) {
    console.error("Better Auth API POST error:", error);
    console.error("Error stack:", error?.stack);
    console.error("Error details:", JSON.stringify(error, null, 2));
    // Return proper error response instead of throwing
    return NextResponse.json(
      { 
        error: error?.message || "Authentication error occurred",
        code: error?.code || "INTERNAL_ERROR",
        details: process.env.NODE_ENV === "development" ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
};

export const GET = async (request: Request) => {
  try {
    return await handler.GET(request);
  } catch (error: any) {
    console.error("Better Auth API GET error:", error);
    console.error("Error stack:", error?.stack);
    console.error("Error details:", JSON.stringify(error, null, 2));
    // Return proper error response instead of throwing
    return NextResponse.json(
      { 
        error: error?.message || "Authentication error occurred",
        code: error?.code || "INTERNAL_ERROR",
        details: process.env.NODE_ENV === "development" ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
};