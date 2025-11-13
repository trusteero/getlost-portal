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
function getDbPath(): string {
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

	return dbPath;
}

// Check if we're in a build phase - be more specific
const isBuildPhase = process.argv.includes('build') || 
	process.env.NEXT_PHASE === 'phase-production-build';

// Create a type-check drizzle instance for TypeScript
// This is only used for type inference, not at runtime
const typeCheckDb = new Database(':memory:');
const typeCheckDbInstance = drizzle(typeCheckDb, { schema });

/**
 * Get or create database connection (lazy initialization)
 * Only connects when actually needed, not at module load time
 */
function getDatabase(): Database.Database {
	// During build phase, don't connect to database
	if (isBuildPhase) {
		throw new Error('Database connection not available during build phase');
	}

	// Return cached connection if available
	if (globalForDb.sqlite) {
		try {
			globalForDb.sqlite.prepare('SELECT 1').get();
			return globalForDb.sqlite;
		} catch (error) {
			// Cached connection is stale
			globalForDb.sqlite = undefined;
		}
	}

	// Runtime - connect to actual database
	const dbPath = getDbPath();
	console.log('[DB] Database URL from env:', env.DATABASE_URL);
	console.log('[DB] Resolved database path:', dbPath);
	
	const dbDir = dirname(dbPath);
	const dbExists = existsSync(dbPath);
	const dirExists = dbDir === '.' || dbDir === './' || existsSync(dbDir);

	console.log('[DB] Lazy connection - checking database accessibility:');
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
	} else {
		// Verify we're using the persistent disk
		if (dbPath.startsWith('/var/data')) {
			const stats = require('fs').statSync(dbPath);
			const sizeKB = Math.round(stats.size / 1024);
			console.log(`[DB] Using persistent disk database (${sizeKB} KB)`);
		}
	}

	try {
		console.log('[DB] Connecting to database at:', dbPath);
		const dbConnection = new Database(dbPath, { 
			readonly: false,
		});
		dbConnection.pragma('journal_mode = WAL');
		console.log('[DB] Successfully connected to database');
		
		if (dbPath.startsWith('/var/data')) {
			console.log('[DB] ✅ Using persistent disk - data will persist across redeploys');
		} else {
			console.warn('[DB] ⚠️  WARNING: Not using persistent disk path!');
			console.warn(`[DB] Expected: /var/data/db.sqlite, Got: ${dbPath}`);
		}

		// Cache connection in development
		if (env.NODE_ENV !== "production") {
			globalForDb.sqlite = dbConnection;
		}

		return dbConnection;
	} catch (error) {
		console.error('[DB] Failed to connect to database:', error);
		throw error;
	}
}

// Lazy getter for sqlite - only connects when accessed
let sqliteInstance: Database.Database | null = null;

function getSqlite(): Database.Database {
	if (!sqliteInstance) {
		sqliteInstance = getDatabase();
	}
	return sqliteInstance;
}

export const sqlite = new Proxy({} as Database.Database, {
	get(target, prop) {
		const db = getSqlite();
		return (db as any)[prop];
	}
}) as Database.Database;

// Lazy getter for db - only connects when accessed
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getDbInstance(): ReturnType<typeof drizzle> {
	if (!dbInstance) {
		// During build phase, return the type-check instance (won't be used)
		if (isBuildPhase) {
			return typeCheckDbInstance;
		}
		// Runtime - use actual database
		const dbConn = getSqlite();
		dbInstance = drizzle(dbConn, { schema });
	}
	return dbInstance;
}

// Export db - use the type-check instance type
// At runtime, the proxy will return the actual database instance
export const db = typeCheckDbInstance;