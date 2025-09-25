import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Initializing database...');

try {
  // Create database connection
  const sqlite = new Database('db.sqlite');
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