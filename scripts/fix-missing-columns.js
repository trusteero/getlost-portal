#!/usr/bin/env node

/**
 * Quick fix script to add missing columns to the database
 * Run this on Render if migrations didn't apply correctly
 * 
 * Usage: node scripts/fix-missing-columns.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace(/^file:/, '').replace(/^file:\/\//, '')
  : '/var/data/db.sqlite';

console.log('🔧 Fixing missing columns...');
console.log('   Database path:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('❌ Database file does not exist:', dbPath);
  process.exit(1);
}

try {
  const sqlite = new Database(dbPath);
  
  // Check current columns
  const columns = sqlite.prepare("PRAGMA table_info(getlostportal_book)").all();
  const columnNames = columns.map(col => col.name);
  
  console.log('\n📋 Current columns:', columnNames.join(', '));
  
  // Add missing columns
  let changesMade = false;
  
  if (!columnNames.includes('authorName')) {
    console.log('\n➕ Adding authorName column...');
    sqlite.exec("ALTER TABLE getlostportal_book ADD COLUMN authorName text(500);");
    changesMade = true;
    console.log('   ✅ authorName added');
  } else {
    console.log('   ✅ authorName already exists');
  }
  
  if (!columnNames.includes('authorBio')) {
    console.log('\n➕ Adding authorBio column...');
    sqlite.exec("ALTER TABLE getlostportal_book ADD COLUMN authorBio text;");
    changesMade = true;
    console.log('   ✅ authorBio added');
  } else {
    console.log('   ✅ authorBio already exists');
  }
  
  if (!columnNames.includes('manuscriptStatus')) {
    console.log('\n➕ Adding manuscriptStatus column...');
    sqlite.exec("ALTER TABLE getlostportal_book ADD COLUMN manuscriptStatus text(50) DEFAULT 'queued';");
    changesMade = true;
    console.log('   ✅ manuscriptStatus added');
  } else {
    console.log('   ✅ manuscriptStatus already exists');
  }
  
  // Verify
  const newColumns = sqlite.prepare("PRAGMA table_info(getlostportal_book)").all();
  const newColumnNames = newColumns.map(col => col.name);
  
  console.log('\n📋 Updated columns:', newColumnNames.join(', '));
  
  const hasAll = newColumnNames.includes('authorName') && 
                 newColumnNames.includes('authorBio') && 
                 newColumnNames.includes('manuscriptStatus');
  
  if (hasAll) {
    console.log('\n✅ All required columns are now present!');
    if (changesMade) {
      console.log('   Database has been updated successfully.');
    } else {
      console.log('   No changes needed - all columns already exist.');
    }
  } else {
    console.error('\n❌ Some columns are still missing!');
    process.exit(1);
  }
  
  sqlite.close();
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}

