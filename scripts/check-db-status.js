#!/usr/bin/env node
/**
 * Script to check database status and user accounts
 * Usage: node scripts/check-db-status.js
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace(/^file:\/\//, '').replace(/^file:/, '')
  : './dev.db';

console.log('📊 Database Status Check');
console.log('=' .repeat(60));
console.log(`Database path: ${dbPath}`);
console.log(`Database exists: ${fs.existsSync(dbPath) ? '✅ Yes' : '❌ No'}`);

if (!fs.existsSync(dbPath)) {
  console.log('\n⚠️  Database file does not exist!');
  console.log('   This means the database will be created on first use.');
  console.log('   All existing users will need to be recreated.');
  process.exit(1);
}

try {
  const db = new Database(dbPath);
  
  // Check if user table exists
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name LIKE 'getlostportal_%'
  `).all();
  
  console.log(`\n📋 Found ${tables.length} tables:`);
  tables.forEach(t => console.log(`   - ${t.name}`));
  
  // Check user count
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM getlostportal_user').get();
    console.log(`\n👥 Users in database: ${userCount.count}`);
    
    if (userCount.count > 0) {
      const users = db.prepare('SELECT id, email, name, role, emailVerified FROM getlostportal_user LIMIT 10').all();
      console.log('\n📋 User list:');
      users.forEach(u => {
        console.log(`   - ${u.email} (${u.name || 'No name'}) - Role: ${u.role} - Verified: ${u.emailVerified ? 'Yes' : 'No'}`);
      });
    }
  } catch (e) {
    console.log('\n⚠️  Could not query user table:', e.message);
  }
  
  // Check account count (Better Auth)
  try {
    const accountCount = db.prepare('SELECT COUNT(*) as count FROM getlostportal_account').get();
    console.log(`\n🔐 Accounts in database: ${accountCount.count}`);
    
    if (accountCount.count > 0) {
      const accounts = db.prepare('SELECT id, account_id, provider_id, user_id FROM getlostportal_account LIMIT 10').all();
      console.log('\n📋 Account list:');
      accounts.forEach(a => {
        console.log(`   - ${a.account_id} (${a.provider_id}) - User: ${a.user_id}`);
      });
    }
  } catch (e) {
    console.log('\n⚠️  Could not query account table:', e.message);
  }
  
  db.close();
  console.log('\n✅ Database check complete');
} catch (error) {
  console.error('\n❌ Error checking database:', error.message);
  process.exit(1);
}

