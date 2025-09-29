import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    checks: {} as Record<string, any>,
  };

  // Test 1: Check if /var/data exists
  try {
    const exists = fs.existsSync("/var/data");
    results.checks.varDataExists = exists;
    console.log(`[TEST] /var/data exists: ${exists}`);
  } catch (error: any) {
    results.checks.varDataExists = `Error: ${error.message}`;
    console.error(`[TEST] Error checking /var/data:`, error);
  }

  // Test 2: Check permissions on /var/data
  try {
    const stats = fs.statSync("/var/data");
    results.checks.varDataStats = {
      isDirectory: stats.isDirectory(),
      mode: stats.mode.toString(8),
      uid: stats.uid,
      gid: stats.gid,
    };
    console.log(`[TEST] /var/data stats:`, results.checks.varDataStats);
  } catch (error: any) {
    results.checks.varDataStats = `Error: ${error.message}`;
    console.error(`[TEST] Error getting /var/data stats:`, error);
  }

  // Test 3: Try to list contents of /var/data
  try {
    const files = fs.readdirSync("/var/data");
    results.checks.varDataContents = files;
    console.log(`[TEST] /var/data contents:`, files);
  } catch (error: any) {
    results.checks.varDataContents = `Error: ${error.message}`;
    console.error(`[TEST] Error listing /var/data:`, error);
  }

  // Test 4: Try to write a test file
  const testFilePath = "/var/data/test-write.txt";
  try {
    fs.writeFileSync(testFilePath, `Test write at ${new Date().toISOString()}\n`);
    results.checks.writeTest = "Success - file written";
    console.log(`[TEST] Successfully wrote to ${testFilePath}`);

    // Try to read it back
    const content = fs.readFileSync(testFilePath, "utf-8");
    results.checks.readTest = `Success - content: ${content.trim()}`;

    // Clean up
    fs.unlinkSync(testFilePath);
    results.checks.cleanup = "Success - test file removed";
  } catch (error: any) {
    results.checks.writeTest = `Error: ${error.message}`;
    console.error(`[TEST] Error writing to /var/data:`, error);
  }

  // Test 5: Check environment variables
  results.checks.environment = {
    DATABASE_URL: process.env.DATABASE_URL || "not set",
    NODE_ENV: process.env.NODE_ENV || "not set",
    PWD: process.cwd(),
  };

  // Test 6: Check alternative paths
  const alternativePaths = ["/var", "/mnt", "/opt/render/project/src", process.cwd()];
  results.checks.alternativePaths = {};

  for (const altPath of alternativePaths) {
    try {
      const exists = fs.existsSync(altPath);
      const stats = exists ? fs.statSync(altPath) : null;
      results.checks.alternativePaths[altPath] = {
        exists,
        isDirectory: stats?.isDirectory() || false,
        readable: exists && fs.accessSync(altPath, fs.constants.R_OK) === undefined,
        writable: exists && fs.accessSync(altPath, fs.constants.W_OK) === undefined,
      };
    } catch (error: any) {
      results.checks.alternativePaths[altPath] = `Error: ${error.message}`;
    }
  }

  // Test 7: Try to create /var/data if it doesn't exist
  if (!results.checks.varDataExists) {
    try {
      fs.mkdirSync("/var/data", { recursive: true });
      results.checks.createVarData = "Success - directory created";
      console.log(`[TEST] Successfully created /var/data`);
    } catch (error: any) {
      results.checks.createVarData = `Error: ${error.message}`;
      console.error(`[TEST] Error creating /var/data:`, error);
    }
  }

  return NextResponse.json(results, { status: 200 });
}