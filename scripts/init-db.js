import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Initializing database...');

try {
  // Get database path from DATABASE_URL or use default
  let dbPath = 'db.sqlite';

  if (process.env.DATABASE_URL) {
    // DATABASE_URL might be like "file:./db.sqlite" or "file:/var/data/db.sqlite"
    dbPath = process.env.DATABASE_URL.replace('file:', '');
  }

  // Ensure the database directory exists
  const dbDir = path.dirname(dbPath);

  // Create directory if it doesn't exist and it's not the current directory
  if (dbDir !== '.' && dbDir !== '/' && !fs.existsSync(dbDir)) {
    console.log(`📁 Attempting to create database directory: ${dbDir}`);
    try {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`✅ Created directory: ${dbDir}`);
    } catch (mkdirError) {
      console.log(`⚠️ Could not create ${dbDir}, using current directory instead`);
      dbPath = 'db.sqlite';
    }
  }

  // Create database connection
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);

  // Run migrations
  console.log('📦 Running database migrations...');
  migrate(db, { migrationsFolder: path.join(__dirname, '../drizzle') });

  console.log('✅ Database initialized successfully!');

  // Close connection
  sqlite.close();
  process.exit(0);
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
}