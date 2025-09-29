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

  // Check the database directory
  const dbDir = path.dirname(dbPath);

  console.log(`📁 Database path: ${dbPath}`);
  console.log(`📁 Database directory: ${dbDir}`);

  // For production paths like /var/data, we don't create them - they should be mounted
  if (dbDir.startsWith('/var/') || dbDir.startsWith('/mnt/') || dbDir.startsWith('/opt/')) {
    console.log(`📁 Production path detected - assuming mounted disk at ${dbDir}`);
    // Don't try to create production directories
  } else if (!fs.existsSync(dbDir) && dbDir !== '.' && dbDir !== '/') {
    // Only try to create local directories
    console.log(`📁 Creating local directory: ${dbDir}`);
    try {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`✅ Created directory: ${dbDir}`);
    } catch (mkdirError) {
      console.log(`⚠️ Could not create ${dbDir}: ${mkdirError instanceof Error ? mkdirError.message : 'Unknown error'}`);
      dbPath = 'db.sqlite';
    }
  }

  // Create database connection
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);

  // Run migrations
  const migrationsFolder = process.env.DRIZZLE_MIGRATIONS_FOLDER || path.join(__dirname, '../drizzle');
  console.log(`📦 Running database migrations from: ${migrationsFolder}`);

  try {
    migrate(db, { migrationsFolder });
  } catch (migrateError) {
    console.error('Migration error:', migrateError instanceof Error ? migrateError.message : 'Unknown error');
    throw migrateError;
  }

  console.log('✅ Database initialized successfully!');

  // Close connection
  sqlite.close();
  process.exit(0);
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
}