#!/usr/bin/env node
/**
 * Database Backup Script
 * 
 * Creates a backup of the SQLite database with timestamp.
 * Can be run manually or scheduled via cron/Render scheduled jobs.
 * 
 * Usage:
 *   node scripts/backup-database.js [output-dir]
 * 
 * Examples:
 *   node scripts/backup-database.js                    # Backup to ./backups/
 *   node scripts/backup-database.js /var/data/backups   # Backup to specific directory
 *   node scripts/backup-database.js s3://bucket/path   # Upload to S3 (if AWS CLI configured)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get database path from environment
const dbPath = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace(/^file:\/\//, '').replace(/^file:/, '')
  : './dev.db';

// Resolve to absolute path
const resolvedDbPath = path.isAbsolute(dbPath) 
  ? dbPath 
  : path.resolve(process.cwd(), dbPath);

// Output directory (default: ./backups)
const outputDir = process.argv[2] || path.join(process.cwd(), 'backups');

// Create timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const filename = `db-backup-${timestamp}.sqlite`;
const backupPath = path.join(outputDir, filename);

console.log('📦 Database Backup Script');
console.log('========================');
console.log(`Database: ${resolvedDbPath}`);
console.log(`Output: ${backupPath}`);
console.log('');

// Check if database exists
if (!fs.existsSync(resolvedDbPath)) {
  console.error(`❌ Error: Database not found at ${resolvedDbPath}`);
  process.exit(1);
}

// Get database size
const stats = fs.statSync(resolvedDbPath);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
console.log(`Database size: ${sizeMB} MB`);
console.log('');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  console.log(`Creating backup directory: ${outputDir}`);
  fs.mkdirSync(outputDir, { recursive: true });
}

// Check if output is S3 path
if (outputDir.startsWith('s3://')) {
  console.log('☁️  Uploading to S3...');
  try {
    // Create temporary local backup first
    const tempBackup = path.join(process.cwd(), filename);
    fs.copyFileSync(resolvedDbPath, tempBackup);
    
    // Upload to S3
    execSync(`aws s3 cp "${tempBackup}" "${outputDir}/${filename}"`, { stdio: 'inherit' });
    
    // Clean up temp file
    fs.unlinkSync(tempBackup);
    
    console.log(`✅ Backup uploaded to S3: ${outputDir}/${filename}`);
  } catch (error) {
    console.error('❌ Failed to upload to S3:', error.message);
    console.error('   Make sure AWS CLI is configured with proper credentials');
    process.exit(1);
  }
} else {
  // Local backup
  console.log('💾 Creating backup...');
  try {
    fs.copyFileSync(resolvedDbPath, backupPath);
    const backupStats = fs.statSync(backupPath);
    const backupSizeMB = (backupStats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`✅ Backup created: ${backupPath}`);
    console.log(`   Size: ${backupSizeMB} MB`);
    
    // Clean up old backups (keep last 30 days)
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir)
        .filter(f => f.startsWith('db-backup-') && f.endsWith('.sqlite'))
        .map(f => ({
          name: f,
          path: path.join(outputDir, f),
          time: fs.statSync(path.join(outputDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);
      
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const oldBackups = files.filter(f => f.time < thirtyDaysAgo);
      
      if (oldBackups.length > 0) {
        console.log(`\n🧹 Cleaning up ${oldBackups.length} old backup(s)...`);
        oldBackups.forEach(backup => {
          fs.unlinkSync(backup.path);
          console.log(`   Deleted: ${backup.name}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Failed to create backup:', error.message);
    process.exit(1);
  }
}

console.log('');
console.log('✅ Backup completed successfully!');

