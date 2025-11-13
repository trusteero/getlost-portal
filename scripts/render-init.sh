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

if (!fs.existsSync(migrationsFolder)) {
  console.log('⚠️  No migrations folder found at:', migrationsFolder);
  process.exit(0);
}

try {
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder });
  sqlite.close();
  console.log('✅ Database migrations completed');
} catch (error) {
  console.error('⚠️  Migration error:', error.message);
  // Don't fail - migrations might already be applied
  process.exit(0);
}
" || echo "⚠️  Could not run migrations (this is okay if database doesn't exist yet)"

# Write a marker file to verify disk persistence
echo "$(date -u +"%Y-%m-%d %H:%M:%S UTC")" > /var/data/.last-init
echo "✅ Initialization complete! Marker written to /var/data/.last-init"

