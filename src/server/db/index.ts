import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync } from "fs";
import { dirname } from "path";

import { env } from "@/env";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
	sqlite: Database.Database | undefined;
};

// Parse the database path - handle both file:// and absolute/relative paths
let dbPath = env.DATABASE_URL;

// Remove file:// or file: prefix if present, but keep the leading slash for absolute paths
if (dbPath.startsWith('file://')) {
	// file:///path -> /path (absolute)
	// file://path -> path (relative)
	dbPath = dbPath.replace(/^file:\/\//, '');
} else if (dbPath.startsWith('file:')) {
	// file:/path -> /path or file:./path -> ./path
	dbPath = dbPath.replace(/^file:/, '');
}

console.log('[DB] Database URL from env:', env.DATABASE_URL);
console.log('[DB] Resolved database path:', dbPath);

// During build, skip database connection
const isBuildPhase = process.argv.includes('build');

let sqlite: Database.Database | null = null;

if (globalForDb.sqlite) {
	console.log('[DB] Using cached database connection');
	sqlite = globalForDb.sqlite;
} else if (isBuildPhase) {
	// During build phase, skip database connection
	console.log('[DB] Build phase detected - skipping database connection');
	sqlite = null;
} else {
	// Runtime - check if database exists and is accessible
	const dbDir = dirname(dbPath);
	const dbExists = existsSync(dbPath);
	const dirExists = dbDir === '.' || dbDir === './' || existsSync(dbDir);

	console.log('[DB] Checking database accessibility:');
	console.log(`  - Directory: ${dbDir}`);
	console.log(`  - Directory exists: ${dirExists}`);
	console.log(`  - Database file exists: ${dbExists}`);
	console.log(`  - Full path: ${dbPath}`);

	if (!dirExists) {
		console.error(`[DB] ERROR: Database directory does not exist: ${dbDir}`);
		console.error('[DB] Make sure the disk is mounted at /var/data on Render');
		throw new Error(`Database directory does not exist: ${dbDir}`);
	}

	if (!dbExists) {
		console.log('[DB] Database file does not exist yet, will be created at:', dbPath);
	}

	try {
		console.log('[DB] Attempting to connect to database at:', dbPath);
		sqlite = new Database(dbPath);
		console.log('[DB] Successfully connected to database');
	} catch (error) {
		console.error('[DB] Failed to connect to database:', error);
		throw error;
	}

	if (env.NODE_ENV !== "production") {
		globalForDb.sqlite = sqlite;
	}
}

export { sqlite };
export const db = sqlite ? drizzle(sqlite, { schema }) : null as any;