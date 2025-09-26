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

// Remove the file:// prefix if present
const dbPath = env.DATABASE_URL.replace(/^file:\/+/, '');

// Check if database directory exists (for build-time safety)
const dbDir = dirname(dbPath);
const dbExists = existsSync(dbPath);
const dirExists = dbDir === '.' || existsSync(dbDir);

if (!dirExists && !dbExists) {
	console.warn(`Database directory ${dbDir} does not exist. Using in-memory database for build.`);
}

export const sqlite =
	globalForDb.sqlite ?? (dirExists || dbExists ? new Database(dbPath) : new Database(':memory:'));
if (env.NODE_ENV !== "production") globalForDb.sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
