import { sqlite } from "@/server/db";
import { env } from "@/env";
import Database from "better-sqlite3";
import { NextResponse } from "next/server";
import fs from "fs";

export async function GET() {
  try {
    const results: Record<string, any> = {};
    
    // Get database path from env
    let dbPath = env.DATABASE_URL || "./dev.db";
    if (dbPath.startsWith("file://")) {
      dbPath = dbPath.replace(/^file:\/\//, "");
    } else if (dbPath.startsWith("file:")) {
      dbPath = dbPath.replace(/^file:/, "");
    }
    
    results.env_DatabaseUrl = env.DATABASE_URL;
    results.resolved_DatabasePath = dbPath;
    results.databaseFileExists = fs.existsSync(dbPath);
    
    // Check database directory
    const dbDir = require('path').dirname(dbPath);
    results.databaseDirectory = dbDir;
    results.databaseDirectoryExists = fs.existsSync(dbDir);
    
    // Try to connect to database
    try {
      const dbConnection = sqlite;
      
      // List all tables
      const allTables = dbConnection.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        ORDER BY name
      `).all();
      
      results.tables = allTables;
      
      // Check specifically for Better Auth tables
      const sessionTable = dbConnection.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='getlostportal_session'
      `).get();
      
      const userTable = dbConnection.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='getlostportal_user'
      `).get();
      
      const accountTable = dbConnection.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='getlostportal_account'
      `).get();
      
      results.betterAuthTables = {
        session: sessionTable ? "EXISTS" : "MISSING",
        user: userTable ? "EXISTS" : "MISSING",
        account: accountTable ? "EXISTS" : "MISSING",
      };
      
      // If session table exists, show its schema
      if (sessionTable) {
        const sessionColumns = dbConnection.prepare("PRAGMA table_info(getlostportal_session)").all();
        results.sessionTableSchema = sessionColumns;
      }
      
      // Try to query the session table
      try {
        const sessionCount = dbConnection.prepare("SELECT COUNT(*) as count FROM getlostportal_session").get();
        results.sessionTableQueryable = true;
        results.sessionCount = sessionCount;
      } catch (queryError: any) {
        results.sessionTableQueryable = false;
        results.sessionTableQueryError = queryError.message;
      }
      
    } catch (dbError: any) {
      results.databaseConnectionError = dbError.message;
      results.databaseConnectionStack = dbError.stack;
    }
    
    // Also check if we can connect directly with the path
    try {
      const directDb = new Database(dbPath);
      const directTables = directDb.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        ORDER BY name
      `).all();
      results.directConnectionTables = directTables;
      directDb.close();
    } catch (directError: any) {
      results.directConnectionError = directError.message;
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      ...results
    }, { status: 200 });
    
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

