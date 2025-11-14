import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import { env } from "@/env";
import fs from "fs";

const handler = toNextJsHandler(auth);

// Runtime fallback: Create missing Better Auth tables if they don't exist
function ensureBetterAuthTables() {
  try {
    let dbPath = env.DATABASE_URL || "./dev.db";
    if (dbPath.startsWith("file://")) {
      dbPath = dbPath.replace(/^file:\/\//, "");
    } else if (dbPath.startsWith("file:")) {
      dbPath = dbPath.replace(/^file:/, "");
    }
    
    const dbDir = require('path').dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    const sqlite = new Database(dbPath);
    try {
      // Check if session table exists
      const sessionTable = sqlite.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='getlostportal_session'
      `).get();
      
      if (!sessionTable) {
        console.log("⚠️  [Better Auth Runtime] Session table missing, creating now...");
        
        // Ensure user table exists first
        const userTable = sqlite.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name='getlostportal_user'
        `).get();
        
        if (!userTable) {
          sqlite.exec(`
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
        sqlite.exec(`
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
        console.log("✅ [Better Auth Runtime] Session table created");
      }
    } finally {
      sqlite.close();
    }
  } catch (error: any) {
    console.error("⚠️  [Better Auth Runtime] Failed to ensure tables:", error?.message);
  }
}

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
    
    try {
      const response = await handler.POST(request);
    
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
      const errorMessage = handlerError?.message || "";
      const errorCode = handlerError?.code || "";
      
      if (errorMessage.includes("no such table") && errorMessage.includes("getlostportal_session") ||
          errorCode === "SQLITE_ERROR" && errorMessage.includes("getlostportal_session")) {
        console.error("❌ [Better Auth] Session table missing error detected, attempting to create it...");
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
      return await handler.GET(request);
    } catch (handlerError: any) {
      // Check if it's a "no such table" error
      const errorMessage = handlerError?.message || "";
      const errorCode = handlerError?.code || "";
      
      if (errorMessage.includes("no such table") && errorMessage.includes("getlostportal_session") ||
          errorCode === "SQLITE_ERROR" && errorMessage.includes("getlostportal_session")) {
        console.error("❌ [Better Auth] Session table missing error detected, attempting to create it...");
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