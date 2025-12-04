#!/usr/bin/env node

/**
 * Create all database tables if they don't exist
 * This is a fallback if migrations don't run automatically
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Get database path
let dbPath = process.env.DATABASE_URL || './dev.db';
if (dbPath.startsWith('file://')) {
  dbPath = dbPath.replace(/^file:\/\//, '');
} else if (dbPath.startsWith('file:')) {
  dbPath = dbPath.replace(/^file:/, '');
}

if (!path.isAbsolute(dbPath)) {
  dbPath = path.resolve(process.cwd(), dbPath);
}

console.log('📦 Creating all database tables...');
console.log('   Database path:', dbPath);

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('   Created database directory:', dbDir);
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

try {
  // Check what tables exist
  const existingTables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'getlostportal_%'")
    .all()
    .map((t: any) => t.name);
  
  console.log('   Existing tables:', existingTables.length > 0 ? existingTables.join(', ') : 'none');

  // Read and execute all migration files
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  if (!fs.existsSync(migrationsFolder)) {
    console.error('❌ Migrations folder not found:', migrationsFolder);
    process.exit(1);
  }

  const migrationFiles = fs.readdirSync(migrationsFolder)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`   Found ${migrationFiles.length} migration files`);

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsFolder, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    
    // Split by statement-breakpoint and execute each statement
    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s.length > 0);
    
    for (const statement of statements) {
      if (statement.trim().length === 0) continue;
      
      try {
        sqlite.exec(statement);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          // Table/index already exists, that's okay
          continue;
        }
        console.warn(`   ⚠️  Warning executing statement from ${file}:`, error.message);
      }
    }
  }

  // Verify tables were created
  const finalTables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'getlostportal_%'")
    .all()
    .map((t: any) => t.name);
  
  console.log('\n✅ Tables after migration:', finalTables.join(', '));
  console.log(`   Total: ${finalTables.length} tables`);
  
  // Check specifically for book table
  if (finalTables.includes('getlostportal_book')) {
    console.log('✅ getlostportal_book table exists!');
  } else {
    console.error('❌ getlostportal_book table NOT found!');
  }

  sqlite.close();
  console.log('\n✅ Database setup complete!');
} catch (error: any) {
  console.error('❌ Error:', error.message);
  console.error('   Stack:', error.stack);
  sqlite.close();
  process.exit(1);
}

