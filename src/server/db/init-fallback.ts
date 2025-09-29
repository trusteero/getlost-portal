import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

import { env } from "@/env";
import * as schema from "./schema";

/**
 * Smart database initialization with fallback options
 */
export function initializeDatabase() {
	// Parse the database path
	let primaryDbPath = env.DATABASE_URL;

	// Remove file:// or file: prefix if present
	if (primaryDbPath.startsWith('file://')) {
		primaryDbPath = primaryDbPath.replace(/^file:\/\//, '');
	} else if (primaryDbPath.startsWith('file:')) {
		primaryDbPath = primaryDbPath.replace(/^file:/, '');
	}

	console.log('[DB] Attempting to initialize database...');
	console.log('[DB] Primary path from DATABASE_URL:', primaryDbPath);

	// Try primary path first
	const primaryDir = dirname(primaryDbPath);
	const primaryDirExists = primaryDir === '.' || primaryDir === './' || existsSync(primaryDir);

	if (primaryDirExists) {
		console.log('[DB] Primary directory exists:', primaryDir);
		try {
			const sqlite = new Database(primaryDbPath);
			console.log('[DB] Successfully connected to primary database at:', primaryDbPath);
			return { db: drizzle(sqlite, { schema }), sqlite, path: primaryDbPath };
		} catch (error: any) {
			console.error('[DB] Failed to connect to primary database:', error.message);
		}
	} else {
		console.log('[DB] Primary directory does not exist:', primaryDir);

		// Try to create the directory if it's /var/data
		if (primaryDir.startsWith('/var/')) {
			console.log('[DB] Attempting to create directory:', primaryDir);
			try {
				mkdirSync(primaryDir, { recursive: true });
				console.log('[DB] Successfully created directory:', primaryDir);

				// Try connecting again
				const sqlite = new Database(primaryDbPath);
				console.log('[DB] Successfully connected to database at:', primaryDbPath);
				return { db: drizzle(sqlite, { schema }), sqlite, path: primaryDbPath };
			} catch (error: any) {
				console.error('[DB] Could not create directory or connect:', error.message);
			}
		}
	}

	// Fallback to local database
	const fallbackPath = './db.sqlite';
	console.log('[DB] Falling back to local database at:', fallbackPath);

	try {
		const sqlite = new Database(fallbackPath);
		console.log('[DB] Successfully connected to fallback database at:', fallbackPath);
		console.warn('[DB] WARNING: Using local database. Data will not persist on Render!');
		return { db: drizzle(sqlite, { schema }), sqlite, path: fallbackPath };
	} catch (error: any) {
		console.error('[DB] Failed to connect to fallback database:', error.message);
		throw new Error(`Could not initialize any database. Primary: ${primaryDbPath}, Fallback: ${fallbackPath}`);
	}
}