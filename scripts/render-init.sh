#!/bin/bash
set -e

echo "🚀 Render initialization script starting..."

# Verify persistent disk is mounted
echo "🔍 Verifying persistent disk is mounted..."
if [ ! -d "/var/data" ]; then
  echo "❌ ERROR: Persistent disk not mounted at /var/data"
  echo "   Please check Render dashboard:"
  echo "   1. Go to your service → Disks"
  echo "   2. Ensure disk 'getlostportal-uploads' is attached"
  echo "   3. Verify mount path is '/var/data'"
  echo "   4. Restart the service if needed"
  exit 1
fi

# Check if we can write to the disk
if [ ! -w "/var/data" ]; then
  echo "❌ ERROR: Cannot write to /var/data (permission denied)"
  echo "   The disk may not be properly mounted or has wrong permissions"
  exit 1
fi

echo "✅ Persistent disk verified at /var/data"

# Check if database exists (to verify persistence)
if [ -f "/var/data/db.sqlite" ]; then
  DB_SIZE=$(stat -f%z /var/data/db.sqlite 2>/dev/null || stat -c%s /var/data/db.sqlite 2>/dev/null || echo "0")
  echo "📊 Existing database found: $(numfmt --to=iec-i --suffix=B $DB_SIZE 2>/dev/null || echo "${DB_SIZE} bytes")"
  
  # Check if database has data
  if command -v sqlite3 &> /dev/null; then
    # Check Better Auth 'user' table (new schema)
    USER_COUNT=$(sqlite3 /var/data/db.sqlite "SELECT COUNT(*) FROM user;" 2>/dev/null || echo "0")
    # Check old 'getlostportal_user' table (legacy schema)
    OLD_USER_COUNT=$(sqlite3 /var/data/db.sqlite "SELECT COUNT(*) FROM getlostportal_user;" 2>/dev/null || echo "0")
    BOOK_COUNT=$(sqlite3 /var/data/db.sqlite "SELECT COUNT(*) FROM getlostportal_book;" 2>/dev/null || echo "0")
    
    TOTAL_USERS=$((USER_COUNT + OLD_USER_COUNT))
    echo "   Users (Better Auth): $USER_COUNT"
    if [ "$OLD_USER_COUNT" -gt 0 ]; then
      echo "   Users (Legacy): $OLD_USER_COUNT"
    fi
    echo "   Total Users: $TOTAL_USERS, Books: $BOOK_COUNT"
    
    # Check for specific user if SUPER_ADMIN_EMAILS is set
    if [ -n "$SUPER_ADMIN_EMAILS" ]; then
      FIRST_EMAIL=$(echo "$SUPER_ADMIN_EMAILS" | cut -d',' -f1 | tr -d ' ')
      if [ -n "$FIRST_EMAIL" ]; then
        USER_EXISTS=$(sqlite3 /var/data/db.sqlite "SELECT COUNT(*) FROM user WHERE email='$FIRST_EMAIL';" 2>/dev/null || echo "0")
        if [ "$USER_EXISTS" -eq 0 ]; then
          OLD_USER_EXISTS=$(sqlite3 /var/data/db.sqlite "SELECT COUNT(*) FROM getlostportal_user WHERE email='$FIRST_EMAIL';" 2>/dev/null || echo "0")
          if [ "$OLD_USER_EXISTS" -eq 0 ]; then
            echo "   ⚠️  WARNING: User '$FIRST_EMAIL' not found in database!"
            echo "   💡 Run: npm run create-user $FIRST_EMAIL <password> \"<name>\""
          fi
        fi
      fi
    fi
  fi
else
  echo "📊 No existing database found - will be created on first run"
  echo "   ⚠️  NOTE: If this is a redeploy, the database should already exist!"
  echo "   💡 Check that the persistent disk is properly mounted at /var/data"
fi

# Create necessary directories on persistent disk
echo "📁 Creating directories on persistent disk..."
mkdir -p /var/data/book-reports
mkdir -p /var/data/reports
mkdir -p /var/data/uploads
mkdir -p /var/data/books
mkdir -p /var/data/covers

# Verify directories were created
for dir in /var/data/book-reports /var/data/reports /var/data/uploads /var/data/books /var/data/covers; do
  if [ -d "$dir" ] && [ -w "$dir" ]; then
    echo "   ✅ $dir"
  else
    echo "   ❌ Failed to create or write to $dir"
    exit 1
  fi
done

# Copy book-reports from repo to persistent disk (if they exist in repo)
if [ -d "/opt/render/project/src/book-reports" ]; then
  echo "📦 Copying book-reports from repo to persistent disk..."
  cp -r /opt/render/project/src/book-reports/* /var/data/book-reports/ 2>/dev/null || echo "⚠️  No book-reports found in repo"
  echo "✅ Book-reports copied to /var/data/book-reports"
else
  echo "ℹ️  Book-reports not found in repo at /opt/render/project/src/book-reports"
  echo "   They will need to be uploaded separately or added to the repo"
fi

# Run database migrations if database exists or will be created
echo "📦 Running database migrations..."
if [ -f "/var/data/db.sqlite" ]; then
  echo "   Database exists, applying migrations..."
else
  echo "   Database will be created, migrations will run on first connection..."
fi

# Run migrations using Node.js script
node -e "
const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = '/var/data/db.sqlite';
const migrationsFolder = path.join(process.cwd(), 'drizzle');

console.log('📦 Migration script starting...');
console.log('   Database path:', dbPath);
console.log('   Migrations folder:', migrationsFolder);
console.log('   Database exists:', fs.existsSync(dbPath));
console.log('   Migrations folder exists:', fs.existsSync(migrationsFolder));

if (!fs.existsSync(migrationsFolder)) {
  console.log('⚠️  No migrations folder found at:', migrationsFolder);
  process.exit(0);
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
  
  // Run migrations with error handling
  try {
    migrate(db, { migrationsFolder });
    console.log('✅ Database migrations completed');
    
    // Verify migrations were applied by checking for new columns
    const verifyColumns = sqlite.prepare("PRAGMA table_info(getlostportal_book)").all();
    const columnNames = verifyColumns.map(col => col.name);
    console.log('📋 Current columns in getlostportal_book:', columnNames.join(', '));
    
    const hasAuthorName = columnNames.includes('authorName');
    const hasAuthorBio = columnNames.includes('authorBio');
    const hasManuscriptStatus = columnNames.includes('manuscriptStatus');
    
    if (!hasAuthorName || !hasAuthorBio || !hasManuscriptStatus) {
      console.warn('⚠️  WARNING: Some expected columns are missing!');
      console.warn('   authorName:', hasAuthorName ? '✅' : '❌ MISSING');
      console.warn('   authorBio:', hasAuthorBio ? '✅' : '❌ MISSING');
      console.warn('   manuscriptStatus:', hasManuscriptStatus ? '✅' : '❌ MISSING');
      console.warn('   Run: node scripts/run-migrations.js to apply missing migrations');
    } else {
      console.log('✅ All expected columns verified');
    }
  } catch (migrateError) {
    console.error('❌ Migration failed:', migrateError.message);
    console.error('   This might be okay if migrations were already applied');
    // Don't throw - continue with other initialization
  }
  
  sqlite.close();
  
  // Now ensure Better Auth session table has correct schema
  console.log('🔍 Checking Better Auth session table...');
  const sqlite2 = new Database(dbPath);
  
  // Check if session table exists
  const sessionTable = sqlite2.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_session'\").get();
  
  if (sessionTable) {
    console.log('   Session table exists, checking schema...');
    const columns = sqlite2.prepare(\"PRAGMA table_info(getlostportal_session)\").all();
    const columnNames = columns.map(col => col.name);
    console.log('   Current columns:', columnNames.join(', '));
    
    const hasId = columnNames.includes('id');
    const hasSessionToken = columnNames.includes('sessionToken');
    const hasToken = columnNames.includes('token');
    const hasExpiresAt = columnNames.includes('expires_at');
    
    // If old schema (has sessionToken but no id), migrate it
    if (hasSessionToken && !hasId) {
      console.log('🔄 Migrating session table from NextAuth to Better Auth schema...');
      sqlite2.exec(\`
        CREATE TABLE IF NOT EXISTS getlostportal_session_new (
          id TEXT PRIMARY KEY,
          expires_at INTEGER NOT NULL,
          token TEXT NOT NULL UNIQUE,
          created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
          updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          user_id TEXT NOT NULL REFERENCES getlostportal_user(id) ON DELETE CASCADE
        )
      \`);
      
      // Migrate old sessions if any exist
      const oldSessions = sqlite2.prepare(\"SELECT sessionToken, userId, expires FROM getlostportal_session\").all();
      if (oldSessions.length > 0) {
        const insert = sqlite2.prepare(\`
          INSERT INTO getlostportal_session_new (id, expires_at, token, user_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        \`);
        const crypto = require('crypto');
        for (const session of oldSessions) {
          insert.run(
            crypto.randomUUID(),
            session.expires,
            session.sessionToken,
            session.userId,
            Math.floor(Date.now() / 1000),
            Math.floor(Date.now() / 1000)
          );
        }
        console.log(\`   Migrated \${oldSessions.length} session(s)\`);
      }
      
      // Replace old table with new one
      sqlite2.exec(\`
        DROP TABLE getlostportal_session;
        ALTER TABLE getlostportal_session_new RENAME TO getlostportal_session;
      \`);
      console.log('✅ Session table migrated to Better Auth schema');
    } else if (!hasId || !hasToken || !hasExpiresAt) {
      // Table exists but doesn't have required Better Auth columns - recreate it
      console.log('🔄 Recreating session table with Better Auth schema...');
      sqlite2.exec(\`
        DROP TABLE IF EXISTS getlostportal_session;
        CREATE TABLE getlostportal_session (
          id TEXT PRIMARY KEY,
          expires_at INTEGER NOT NULL,
          token TEXT NOT NULL UNIQUE,
          created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
          updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          user_id TEXT NOT NULL REFERENCES getlostportal_user(id) ON DELETE CASCADE
        )
      \`);
      console.log('✅ Session table recreated with Better Auth schema');
    } else {
      console.log('✅ Session table already has correct Better Auth schema');
    }
  } else {
    // Table doesn't exist - create it with Better Auth schema
    console.log('🔄 Creating session table with Better Auth schema (table does not exist)...');
    sqlite2.exec(\`
      CREATE TABLE getlostportal_session (
        id TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        user_id TEXT NOT NULL REFERENCES getlostportal_user(id) ON DELETE CASCADE
      )
    \`);
    console.log('✅ Session table created with Better Auth schema');
  }
  
  // Verify table was created
  const verifyTable = sqlite2.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name='getlostportal_session'\").get();
  if (verifyTable) {
    const verifyColumns = sqlite2.prepare(\"PRAGMA table_info(getlostportal_session)\").all();
    console.log('✅ Verified: Session table exists with', verifyColumns.length, 'columns');
  } else {
    console.error('❌ ERROR: Session table was not created!');
  }
  
  const tables = sqlite2.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'getlostportal_%'\").all();
  console.log('📋 Found', tables.length, 'getlostportal tables:', tables.map(t => t.name).join(', '));
  sqlite2.close();
} catch (error) {
  console.error('❌ Migration error:', error.message);
  console.error('   Stack:', error.stack);
  // Don't fail - migrations might already be applied
  process.exit(0);
}
" || echo "⚠️  Could not run migrations (this is okay if database doesn't exist yet)"

# Write a marker file to verify disk persistence
echo "$(date -u +"%Y-%m-%d %H:%M:%S UTC")" > /var/data/.last-init
echo "✅ Initialization complete! Marker written to /var/data/.last-init"

