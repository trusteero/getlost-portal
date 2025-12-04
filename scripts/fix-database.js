const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace(/^file:/, '').replace(/^file:\/\//, '')
  : './dev.db';

if (!path.isAbsolute(dbPath)) {
  const fullPath = path.resolve(process.cwd(), dbPath);
  console.log('Using database:', fullPath);
} else {
  console.log('Using database:', dbPath);
}

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

try {
  // Read the first migration file which has all the table definitions
  const migrationFile = path.join(process.cwd(), 'drizzle', '0000_talented_shatterstar.sql');
  
  if (!fs.existsSync(migrationFile)) {
    console.error('Migration file not found:', migrationFile);
    process.exit(1);
  }
  
  const sql = fs.readFileSync(migrationFile, 'utf-8');
  
  // Split by statement-breakpoint
  const statements = sql.split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('CREATE INDEX') || s.includes('CREATE TABLE'));
  
  console.log('Executing migration statements...');
  
  for (const statement of statements) {
    if (statement.trim().length === 0) continue;
    
    try {
      sqlite.exec(statement);
      if (statement.includes('CREATE TABLE')) {
        const tableMatch = statement.match(/CREATE TABLE[^`]*`([^`]+)`/);
        if (tableMatch) {
          console.log('✅ Created table:', tableMatch[1]);
        }
      }
    } catch (error) {
      if (error.message?.includes('already exists')) {
        // Table already exists, that's okay
        continue;
      }
      console.warn('Warning:', error.message);
    }
  }
  
  // Now create indexes
  const indexStatements = sql.split('--> statement-breakpoint')
    .filter(s => s.includes('CREATE INDEX'));
  
  for (const statement of indexStatements) {
    try {
      sqlite.exec(statement);
    } catch (error) {
      if (error.message?.includes('already exists')) {
        continue;
      }
      console.warn('Index warning:', error.message);
    }
  }
  
  // Verify
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'getlostportal_%'").all();
  console.log('\n✅ All tables:', tables.map(t => t.name).join(', '));
  
  const hasBook = tables.some(t => t.name === 'getlostportal_book');
  console.log('Book table exists:', hasBook ? '✅' : '❌');
  
  sqlite.close();
  console.log('\n✅ Database setup complete!');
} catch (error) {
  console.error('Error:', error);
  sqlite.close();
  process.exit(1);
}

