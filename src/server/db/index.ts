import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

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

export const sqlite =
	globalForDb.sqlite ?? new Database(dbPath);
if (env.NODE_ENV !== "production") globalForDb.sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
