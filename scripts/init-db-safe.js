import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Checking database...');

try {
  const dbPath = 'db.sqlite';
  const dbExists = fs.existsSync(dbPath);

  if (dbExists) {
    console.log('📦 Database already exists, checking for pending migrations...');
  } else {
    console.log('📦 Database does not exist, creating new database...');
  }

  // Create database connection (will create file if doesn't exist)
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);

  // Run migrations (will only apply new ones if database exists)
  console.log('📦 Running database migrations...');
  migrate(db, { migrationsFolder: path.join(__dirname, '../drizzle') });

  console.log('✅ Database ready!');

  // Close connection
  sqlite.close();
  process.exit(0);
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
}