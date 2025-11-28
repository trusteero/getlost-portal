#!/usr/bin/env node

/**
 * Manual migration script for Render
 * Run this if migrations didn't run automatically
 * 
 * Usage: node scripts/run-migrations.js
 */

const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace(/^file:/, '').replace(/^file:\/\//, '')
  : '/var/data/db.sqlite';

const migrationsFolder = path.join(process.cwd(), 'drizzle');

console.log('📦 Migration script starting...');
console.log('   Database path:', dbPath);
console.log('   Migrations folder:', migrationsFolder);
console.log('   Database exists:', fs.existsSync(dbPath));
console.log('   Migrations folder exists:', fs.existsSync(migrationsFolder));

if (!fs.existsSync(migrationsFolder)) {
  console.error('❌ No migrations folder found at:', migrationsFolder);
  process.exit(1);
}

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  console.log('📁 Creating database directory:', dbDir);
  fs.mkdirSync(dbDir, { recursive: true });
}

try {
  // Run migrations
  console.log('🔄 Running Drizzle migrations...');
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  
  migrate(db, { migrationsFolder });
  
  sqlite.close();
  console.log('✅ Database migrations completed successfully!');
  
  // Verify columns were added
  const verifyDb = new Database(dbPath);
  const columns = verifyDb.prepare("PRAGMA table_info(getlostportal_book)").all();
  const columnNames = columns.map(col => col.name);
  
  console.log('\n📋 Current columns in getlostportal_book:');
  console.log('   ', columnNames.join(', '));
  
  const hasAuthorName = columnNames.includes('authorName');
  const hasAuthorBio = columnNames.includes('authorBio');
  const hasManuscriptStatus = columnNames.includes('manuscriptStatus');
  
  console.log('\n✅ Verification:');
  console.log('   authorName:', hasAuthorName ? '✅' : '❌');
  console.log('   authorBio:', hasAuthorBio ? '✅' : '❌');
  console.log('   manuscriptStatus:', hasManuscriptStatus ? '✅' : '❌');
  
  if (!hasAuthorName || !hasAuthorBio || !hasManuscriptStatus) {
    console.error('\n❌ Some columns are missing! Migrations may have failed.');
    process.exit(1);
  }
  
  verifyDb.close();
  console.log('\n✅ All migrations verified successfully!');
} catch (error) {
  console.error('❌ Migration error:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}

