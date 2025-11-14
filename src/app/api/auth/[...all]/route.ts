import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { sqlite } from "@/server/db";
import { env } from "@/env";

const handler = toNextJsHandler(auth);

// Runtime fallback: Create missing Better Auth tables if they don't exist
// Uses the SAME database connection that Better Auth uses
function ensureBetterAuthTables() {
  try {
    console.log("🔧 [Better Auth Runtime] Ensuring tables exist using the same DB connection...");
    
    // Use the same sqlite instance that Better Auth uses
    const dbConnection = sqlite;
    
    // Check if session table exists
    const sessionTable = dbConnection.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='getlostportal_session'
    `).get();
    
    if (!sessionTable) {
      console.log("🚨 [Better Auth Runtime] Session table missing, creating now in the same DB Better Auth uses...");
      
      // Ensure user table exists first
      const userTable = dbConnection.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='getlostportal_user'
      `).get();
      
      if (!userTable) {
        dbConnection.exec(`
          CREATE TABLE IF NOT EXISTS getlostportal_user (
            id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT NOT NULL UNIQUE,
            emailVerified INTEGER DEFAULT 0,
            image TEXT,
            role TEXT DEFAULT 'user' NOT NULL,
            createdAt INTEGER DEFAULT (unixepoch()) NOT NULL,
            updatedAt INTEGER DEFAULT (unixepoch()) NOT NULL
          )
        `);
        console.log("✅ [Better Auth Runtime] User table created");
      }
      
      // Create session table
      dbConnection.exec(`
        CREATE TABLE getlostportal_session (
          id TEXT PRIMARY KEY,
          expires_at INTEGER NOT NULL,
          token TEXT NOT NULL UNIQUE,
          created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
          updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          user_id TEXT NOT NULL REFERENCES getlostportal_user(id) ON DELETE CASCADE
        )
      `);
      console.log("✅ [Better Auth Runtime] Session table created in the same database Better Auth uses");
      
      // Verify it's accessible
      dbConnection.prepare("SELECT COUNT(*) as count FROM getlostportal_session").get();
      console.log("✅ [Better Auth Runtime] Session table verified and accessible");
    } else {
      console.log("✅ [Better Auth Runtime] Session table already exists");
    }
  } catch (error: any) {
    console.error("❌ [Better Auth Runtime] Failed to ensure tables:", error?.message);
    console.error("   Stack:", error?.stack);
    throw error; // Re-throw so we know it failed
  }
}

// Helper to check if error is about missing session table
function isSessionTableError(error: any, response?: Response): boolean {
  const errorMessage = error?.message || "";
  const errorCode = error?.code || "";
  const errorString = JSON.stringify(error || {}).toLowerCase();
  
  // Check thrown error
  if (errorMessage.includes("no such table") && errorMessage.includes("getlostportal_session")) {
    return true;
  }
  if (errorCode === "SQLITE_ERROR" && errorMessage.includes("getlostportal_session")) {
    return true;
  }
  if (errorString.includes("no such table") && errorString.includes("getlostportal_session")) {
    return true;
  }
  
  // Check response body if available
  if (response && response.status === 500) {
    // Try to parse response body for error
    try {
      // We'll check this after cloning
      return false;
    } catch {
      // Ignore
    }
  }
  
  return false;
}

export const POST = async (request: Request) => {
  // Log immediately when route handler is called
  console.log("🚨 [Better Auth Route] POST handler called");
  
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
    
    try {
      console.log("🔐 [Better Auth Route] Calling handler.POST...");
      const response = await handler.POST(request);
      console.log("🔐 [Better Auth Route] Handler returned, status:", response.status);
    
      // Check response status - Better Auth might return 500 with error in body
      if (response.status === 500) {
        console.log("⚠️ [Better Auth Route] Got 500 response, checking error body...");
        try {
          const responseClone = response.clone();
          const errorData = await responseClone.json();
          const errorString = JSON.stringify(errorData).toLowerCase();
          
          // Check if the error is about missing session table
          console.log("🔍 [Better Auth Route] Checking error string for session table error...");
          console.log("   Error string contains 'no such table':", errorString.includes("no such table"));
          console.log("   Error string contains 'getlostportal_session':", errorString.includes("getlostportal_session"));
          
          if (errorString.includes("no such table") && errorString.includes("getlostportal_session")) {
            console.error("🚨🚨🚨 [Better Auth] Session table missing error detected in response body, attempting to create it...");
            console.error("   Error data:", JSON.stringify(errorData, null, 2));
            ensureBetterAuthTables();
            
            // Retry the request once after creating the table
            try {
              const retryResponse = await handler.POST(request);
              console.log("✅ [Better Auth] POST request succeeded after creating missing table");
              return retryResponse;
            } catch (retryError: any) {
              console.error("❌ [Better Auth] POST request still failed after creating table:", retryError?.message);
              throw retryError;
            }
          }
        } catch (parseError) {
          // Couldn't parse response, continue with original response
        }
      }
    
      // Log response status for sign-in requests
      if (pathname.includes("/sign-in") || pathname.includes("/signin")) {
        console.log("🔐 [Better Auth] Sign-in response status:", response.status);
        if (response.status !== 200) {
          try {
            const responseClone = response.clone();
            const errorData = await responseClone.json();
            console.log("🔐 [Better Auth] Sign-in error response:", JSON.stringify(errorData, null, 2));
          } catch (e) {
            console.log("🔐 [Better Auth] Could not parse error response");
          }
        }
      }
      
      return response;
    } catch (handlerError: any) {
      // Check if it's a "no such table" error
      if (isSessionTableError(handlerError)) {
        console.error("❌ [Better Auth] Session table missing error detected (thrown), attempting to create it...");
        console.error("   Error:", handlerError?.message);
        ensureBetterAuthTables();
        
        // Retry the request once after creating the table
        try {
          const retryResponse = await handler.POST(request);
          console.log("✅ [Better Auth] POST request succeeded after creating missing table");
          return retryResponse;
        } catch (retryError: any) {
          console.error("❌ [Better Auth] POST request still failed after creating table:", retryError?.message);
          throw retryError;
        }
      }
      
      // If it's not a table missing error, throw it
      throw handlerError;
    }
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
    try {
      const response = await handler.GET(request);
      
      // Check response status - Better Auth might return 500 with error in body
      if (response.status === 500) {
        try {
          const responseClone = response.clone();
          const errorData = await responseClone.json();
          const errorString = JSON.stringify(errorData).toLowerCase();
          
          // Check if the error is about missing session table
          if (errorString.includes("no such table") && errorString.includes("getlostportal_session")) {
            console.error("❌ [Better Auth] Session table missing error detected in GET response, attempting to create it...");
            ensureBetterAuthTables();
            
            // Retry the request once after creating the table
            try {
              const retryResponse = await handler.GET(request);
              console.log("✅ [Better Auth] GET request succeeded after creating missing table");
              return retryResponse;
            } catch (retryError: any) {
              console.error("❌ [Better Auth] GET request still failed after creating table:", retryError?.message);
              throw retryError;
            }
          }
        } catch (parseError) {
          // Couldn't parse response, continue with original response
        }
      }
      
      return response;
    } catch (handlerError: any) {
      // Check if it's a "no such table" error
      if (isSessionTableError(handlerError)) {
        console.error("❌ [Better Auth] Session table missing error detected (thrown), attempting to create it...");
        console.error("   Error:", handlerError?.message);
        ensureBetterAuthTables();
        
        // Retry the request once after creating the table
        try {
          const retryResponse = await handler.GET(request);
          console.log("✅ [Better Auth] GET request succeeded after creating missing table");
          return retryResponse;
        } catch (retryError: any) {
          console.error("❌ [Better Auth] GET request still failed after creating table:", retryError?.message);
          throw retryError;
        }
      }
      
      // If it's not a table missing error, throw it
      throw handlerError;
    }
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