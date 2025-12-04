import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { account, user as betterAuthUser } from "@/server/db/better-auth-schema";
import { eq, desc } from "drizzle-orm";
import { createExampleBooksForUser } from "@/server/utils/create-example-books";

const handler = toNextJsHandler(auth);

export const POST = async (request: Request) => {
  try {
    // Log the request for debugging
    const url = new URL(request.url);
    const pathname = url.pathname;
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    console.log("🔐 [Better Auth] POST request to:", pathname);
    console.log("🔐 [Better Auth] Request origin:", origin || "none");
    console.log("🔐 [Better Auth] Request referer:", referer || "none");
    
    // Log environment variables for debugging (development only)
    if (process.env.NODE_ENV === "development" && pathname.includes("/sign-in/social")) {
      console.log("🔐 [Better Auth] Environment check:");
      console.log("  - AUTH_GOOGLE_ID:", process.env.AUTH_GOOGLE_ID ? "✅ Set" : "❌ Missing");
      console.log("  - AUTH_GOOGLE_SECRET:", process.env.AUTH_GOOGLE_SECRET ? "✅ Set" : "❌ Missing");
      console.log("  - AUTH_SECRET:", process.env.AUTH_SECRET ? "✅ Set" : "❌ Missing");
      console.log("  - BETTER_AUTH_URL:", process.env.BETTER_AUTH_URL || "Not set (using default)");
      console.log("  - NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL || "Not set (using default)");
      
      // Try to read the request body
      try {
        const body = await request.clone().json();
        console.log("🔐 [Better Auth] Request body:", JSON.stringify(body, null, 2));
      } catch (e) {
        console.log("🔐 [Better Auth] Could not parse request body");
      }
    }
    
    // If it's a sign-in request, log the email being used
    if (pathname.includes("/sign-in") || pathname.includes("/signin")) {
      try {
        const body = await request.clone().json();
        if (body.email) {
          console.log("🔐 [Better Auth] Sign-in attempt for email:", body.email);
        }
        if (body.provider) {
          console.log("🔐 [Better Auth] Social sign-in attempt for provider:", body.provider);
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }
    
    console.log("🔐 [Better Auth] Calling handler.POST...");
    const response = await handler.POST(request);
    console.log("🔐 [Better Auth] Handler returned status:", response.status);
    
    // Log response status for sign-in requests
    if (pathname.includes("/sign-in") || pathname.includes("/signin")) {
      console.log("🔐 [Better Auth] Sign-in response status:", response.status);
      if (response.status !== 200 && response.status !== 302) {
        try {
          const responseClone = response.clone();
          const errorData = await responseClone.json();
          console.log("🔐 [Better Auth] Sign-in error response:", JSON.stringify(errorData, null, 2));
        } catch (e) {
          try {
            const responseClone2 = response.clone();
            const text = await responseClone2.text();
            console.log("🔐 [Better Auth] Sign-in error response (text):", text);
          } catch (e2) {
            console.log("🔐 [Better Auth] Could not read error response");
          }
        }
      }
    }
    
    return response;
  } catch (error: any) {
    console.error("❌ [Better Auth] API POST error:", error);
    console.error("❌ [Better Auth] Error stack:", error?.stack);
    console.error("❌ [Better Auth] Error message:", error?.message);
    console.error("❌ [Better Auth] Error name:", error?.name);
    console.error("❌ [Better Auth] Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    // Check for specific error types
    if (error?.message?.includes("AUTH_SECRET")) {
      console.error("❌ [Better Auth] AUTH_SECRET is missing or invalid!");
    }
    if (error?.message?.includes("google") || error?.message?.includes("Google")) {
      console.error("❌ [Better Auth] Google OAuth configuration issue!");
      console.error("   Check AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET");
    }
    if (error?.message?.includes("database") || error?.message?.includes("Database")) {
      console.error("❌ [Better Auth] Database connection issue!");
      console.error("   Check DATABASE_URL and ensure database is accessible");
    }
    
    // Return proper error response instead of throwing
    return NextResponse.json(
      { 
        error: error?.message || "Authentication error occurred",
        code: error?.code || "INTERNAL_ERROR",
        details: process.env.NODE_ENV === "development" ? error?.stack : undefined,
        hint: process.env.NODE_ENV === "development" 
          ? "Check server console for detailed error logs"
          : undefined
      },
      { status: 500 }
    );
  }
};

export const GET = async (request: Request) => {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Handle Google OAuth callback - create example books asynchronously (non-blocking)
    if (pathname.includes("/callback/google")) {
      console.log("🔐 [Better Auth] Google OAuth callback detected");
      
      // Process the callback first
      const response = await handler.GET(request);
      
      // If the callback was successful (redirect or success status), create example books
      // Better Auth redirects on success, so check for redirect or 2xx status
      if (response.status >= 200 && response.status < 400) {
        console.log("🔐 [Better Auth] Google OAuth callback successful, starting example books creation...");
        
        // Start book creation asynchronously (don't block redirect)
        // The dashboard will poll for books and show a loading state until they appear
        (async () => {
          try {
            // Wait a moment for Better Auth to finish creating the user/account
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Try to get session to identify the user
            let userId: string | null = null;
            try {
              const session = await auth.api.getSession({
                headers: request.headers,
              });
              if (session?.user?.id) {
                userId = session.user.id;
                console.log(`🔐 [Better Auth] Found user from session: ${userId}`);
              }
            } catch (sessionError) {
              console.log("🔐 [Better Auth] Could not get session immediately, will find user from account table");
            }
            
            // If we couldn't get from session, find the most recently created/updated Google account
            if (!userId) {
              // Try multiple times to find the user (they might still be creating)
              for (let attempt = 0; attempt < 3; attempt++) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const recentGoogleAccount = await db
                  .select({
                    userId: account.userId,
                    updatedAt: account.updatedAt,
                  })
                  .from(account)
                  .where(eq(account.providerId, "google"))
                  .orderBy(desc(account.updatedAt))
                  .limit(1);
                
                if (recentGoogleAccount.length > 0) {
                  userId = recentGoogleAccount[0]!.userId;
                  console.log(`🔐 [Better Auth] Found user from account table (attempt ${attempt + 1}): ${userId}`);
                  break;
                }
              }
            }
            
            if (userId) {
              console.log(`🔐 [Better Auth] Creating example books for user ${userId} (this may take a few seconds...)`);
              
              // Create books (this may take a few seconds due to precanned content import)
              const startTime = Date.now();
              try {
                await createExampleBooksForUser(userId);
                const duration = Date.now() - startTime;
                console.log(`✅ [Better Auth] Example books created successfully for user ${userId} (took ${duration}ms)`);
              } catch (error: any) {
                const duration = Date.now() - startTime;
                console.error(`❌ [Better Auth] Failed to create example books for user ${userId} after ${duration}ms:`, error);
                console.error(`❌ [Better Auth] Error details:`, error?.message, error?.stack);
              }
            } else {
              console.warn("🔐 [Better Auth] ⚠️  Could not identify user after multiple attempts - example books will not be created");
            }
          } catch (error: any) {
            console.error("❌ [Better Auth] Unexpected error in example books creation:", error);
            console.error("❌ [Better Auth] Error details:", error?.message, error?.stack);
          }
        })(); // Fire and forget - don't block redirect
      }
      
      return response;
    }
    
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