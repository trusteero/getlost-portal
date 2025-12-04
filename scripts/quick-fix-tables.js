const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = './dev.db';
console.log('Checking database:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.log('Database does not exist, creating...');
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

// Check existing tables
const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('All tables:', tables.map(t => t.name).join(', '));

// Check if book table exists
const bookTable = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_book'").get();
console.log('Book table exists:', !!bookTable);

if (!bookTable) {
  console.log('Creating getlostportal_book table...');
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS getlostportal_book (
      id text(255) PRIMARY KEY NOT NULL,
      userId text(255) NOT NULL,
      title text(500) NOT NULL,
      description text,
      coverImageUrl text(1000),
      createdAt integer DEFAULT (unixepoch()) NOT NULL,
      updatedAt integer,
      FOREIGN KEY (userId) REFERENCES getlostportal_user(id)
    )
  `);
  console.log('✅ Book table created');
}

sqlite.close();
console.log('Done');

