#!/bin/bash
set -e

echo "🚀 Render initialization script starting..."

# Create necessary directories on persistent disk
echo "📁 Creating directories on persistent disk..."
mkdir -p /var/data/book-reports
mkdir -p /var/data/reports
mkdir -p /var/data/uploads
mkdir -p /var/data/books
mkdir -p /var/data/covers

# Copy book-reports from repo to persistent disk (if they exist in repo)
if [ -d "/opt/render/project/src/book-reports" ]; then
  echo "📦 Copying book-reports from repo to persistent disk..."
  cp -r /opt/render/project/src/book-reports/* /var/data/book-reports/ 2>/dev/null || echo "⚠️  No book-reports found in repo"
  echo "✅ Book-reports copied to /var/data/book-reports"
else
  echo "ℹ️  Book-reports not found in repo at /opt/render/project/src/book-reports"
  echo "   They will need to be uploaded separately or added to the repo"
fi

echo "✅ Initialization complete!"

