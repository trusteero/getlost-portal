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
    USER_COUNT=$(sqlite3 /var/data/db.sqlite "SELECT COUNT(*) FROM getlostportal_user;" 2>/dev/null || echo "0")
    BOOK_COUNT=$(sqlite3 /var/data/db.sqlite "SELECT COUNT(*) FROM getlostportal_book;" 2>/dev/null || echo "0")
    echo "   Users: $USER_COUNT, Books: $BOOK_COUNT"
  fi
else
  echo "📊 No existing database found - will be created on first run"
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

# Write a marker file to verify disk persistence
echo "$(date -u +"%Y-%m-%d %H:%M:%S UTC")" > /var/data/.last-init
echo "✅ Initialization complete! Marker written to /var/data/.last-init"

