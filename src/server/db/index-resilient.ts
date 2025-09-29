import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync, mkdirSync } from "fs";
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
	dbPath = dbPath.replace(/^file:\/\//, '');
} else if (dbPath.startsWith('file:')) {
	dbPath = dbPath.replace(/^file:/, '');
}

console.log('[DB] Database URL from env:', env.DATABASE_URL);
console.log('[DB] Resolved database path:', dbPath);

// During build, skip database connection
const isBuildPhase = process.argv.includes('build') || process.env.NEXT_PHASE === 'phase-production-build';

let sqlite: Database.Database | null = null;

if (globalForDb.sqlite) {
	console.log('[DB] Using cached database connection');
	sqlite = globalForDb.sqlite;
} else if (isBuildPhase) {
	// During build phase, skip database connection
	console.log('[DB] Build phase detected - skipping database connection');
	sqlite = null;
} else {
	// Runtime - try to establish database connection
	const dbDir = dirname(dbPath);
	const dbExists = existsSync(dbPath);
	let dirExists = dbDir === '.' || dbDir === './' || existsSync(dbDir);

	console.log('[DB] Checking database accessibility:');
	console.log(`  - Directory: ${dbDir}`);
	console.log(`  - Directory exists: ${dirExists}`);
	console.log(`  - Database file exists: ${dbExists}`);
	console.log(`  - Full path: ${dbPath}`);

	// If directory doesn't exist, try to create it
	if (!dirExists) {
		console.log(`[DB] Directory does not exist, attempting to create: ${dbDir}`);
		try {
			mkdirSync(dbDir, { recursive: true });
			dirExists = true;
			console.log(`[DB] Successfully created directory: ${dbDir}`);
		} catch (mkdirError: any) {
			console.error(`[DB] Could not create directory: ${mkdirError.message}`);

			// If we can't create the production directory, use a fallback
			if (dbDir.startsWith('/var/') || dbDir.startsWith('/mnt/')) {
				console.warn('[DB] WARNING: Production directory not accessible.');
				console.warn('[DB] This may be a build-time issue that resolves at runtime.');
				console.warn('[DB] Falling back to local database for now.');

				// Use local fallback
				dbPath = './db-fallback.sqlite';
				console.log('[DB] Using fallback database at:', dbPath);
			} else {
				throw new Error(`Database directory does not exist and could not be created: ${dbDir}`);
			}
		}
	}

	if (!dbExists) {
		console.log('[DB] Database file does not exist yet, will be created at:', dbPath);
	}

	try {
		console.log('[DB] Attempting to connect to database at:', dbPath);
		sqlite = new Database(dbPath);
		console.log('[DB] Successfully connected to database');

		// For development, cache the connection
		if (env.NODE_ENV !== "production") {
			globalForDb.sqlite = sqlite;
		}
	} catch (error: any) {
		console.error('[DB] Failed to connect to database:', error.message);

		// Last resort fallback
		if (dbPath.startsWith('/var/') || dbPath.startsWith('/mnt/')) {
			console.warn('[DB] Trying local fallback database...');
			const fallbackPath = './db-fallback.sqlite';

			try {
				sqlite = new Database(fallbackPath);
				console.warn('[DB] Connected to fallback database. WARNING: Data may not persist!');
			} catch (fallbackError: any) {
				console.error('[DB] Failed to connect to fallback database:', fallbackError.message);
				throw new Error(`Could not connect to any database`);
			}
		} else {
			throw error;
		}
	}
}

// Export the database connection
// During build phase, export a dummy object that won't be used
export const db = sqlite ? drizzle(sqlite, { schema }) : {} as any;

// Export a function to check if database is available
export function isDatabaseAvailable(): boolean {
	return sqlite !== null;
}