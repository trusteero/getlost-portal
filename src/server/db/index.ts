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

// Check if we're in a build phase or if the production disk is unavailable
const isBuildPhase = process.argv.includes('build') ||
	process.env.NEXT_PHASE === 'phase-production-build' ||
	process.env.VERCEL_ENV === 'production' ||
	process.env.RENDER === 'true';

let sqlite: Database.Database | null = null;
let dbFallbackPath = dbPath;

// For production paths that don't exist, use a temporary build database
if (dbPath.startsWith('/var/') || dbPath.startsWith('/mnt/')) {
	const dbDir = dirname(dbPath);
	const dirExists = existsSync(dbDir);

	if (!dirExists) {
		console.log(`[DB] Production directory ${dbDir} not available (expected during build on Render)`);
		console.log('[DB] Using temporary build database at ./build-db.sqlite');
		dbFallbackPath = './build-db.sqlite';
	}
}

if (globalForDb.sqlite) {
	// Check if cached connection is still valid
	try {
		globalForDb.sqlite.prepare('SELECT 1').get();
		console.log('[DB] Using cached database connection');
		sqlite = globalForDb.sqlite;
	} catch (error) {
		// Cached connection is stale, create a new one
		console.log('[DB] Cached connection is stale, creating new connection');
		globalForDb.sqlite = undefined;
		sqlite = null;
	}
} else if (isBuildPhase && dbFallbackPath !== dbPath) {
	// During build phase with missing production directory, use fallback
	console.log('[DB] Build phase detected with missing production directory');
	console.log('[DB] Creating temporary build database for Next.js compilation');
	try {
		sqlite = new Database(dbFallbackPath, { readonly: false });
		sqlite.pragma('journal_mode = WAL');
		console.log('[DB] Temporary build database created successfully');
	} catch (error) {
		console.error('[DB] Failed to create build database:', error);
		// Don't throw - let the build continue without a database
		sqlite = null;
	}
} else {
	// Runtime - use the actual database path
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
		console.error('[DB] This error at runtime indicates the disk is not properly mounted');
		throw new Error(`Database directory does not exist: ${dbDir}`);
	}

	if (!dbExists) {
		console.log('[DB] Database file does not exist yet, will be created at:', dbPath);
	}

	try {
		console.log('[DB] Attempting to connect to database at:', dbPath);
		sqlite = new Database(dbPath, { 
			readonly: false,
			// Enable WAL mode for better concurrency
			// This helps prevent locking issues
		});
		// Enable WAL mode for better concurrency
		sqlite.pragma('journal_mode = WAL');
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
export const db = sqlite ? drizzle(sqlite, { schema }) : drizzle({} as any, { schema });