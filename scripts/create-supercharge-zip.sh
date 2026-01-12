#!/bin/bash
# Create ZIP file for Supercharge book upload
# This script generates HTML and creates a ZIP with covers and videos

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GETLOST_BOOKS="/Users/eerogetlost/GetLostBooks"
SUPERCHARGE_DIR="$GETLOST_BOOKS/supercharge"
OUTPUT_DIR="$SUPERCHARGE_DIR"

echo "📚 Creating Supercharge assets ZIP for portal upload..."
echo ""

# Check if directories exist
if [ ! -d "$SUPERCHARGE_DIR/covers" ]; then
    echo "❌ Error: Covers directory not found: $SUPERCHARGE_DIR/covers"
    exit 1
fi

if [ ! -d "$SUPERCHARGE_DIR/videos" ]; then
    echo "❌ Error: Videos directory not found: $SUPERCHARGE_DIR/videos"
    exit 1
fi

# Generate HTML
echo "📄 Generating HTML file..."
HTML_FILE="$OUTPUT_DIR/supercharge-assets.html"

if [ -f "$SCRIPT_DIR/supercharge-example.json" ]; then
    python3 "$SCRIPT_DIR/generate-supercharge-html.py" "$HTML_FILE" "$SCRIPT_DIR/supercharge-example.json"
else
    python3 "$SCRIPT_DIR/generate-supercharge-html.py" "$HTML_FILE"
fi

if [ ! -f "$HTML_FILE" ]; then
    echo "❌ Error: Failed to generate HTML file"
    exit 1
fi

echo "✅ HTML generated: $HTML_FILE"
echo ""

# Create ZIP file
echo "📦 Creating ZIP file..."
cd "$SUPERCHARGE_DIR"
ZIP_FILE="supercharge-assets.zip"

# Remove old ZIP if exists
[ -f "$ZIP_FILE" ] && rm "$ZIP_FILE"

# Create ZIP with HTML, covers, and videos
zip -r "$ZIP_FILE" \
    "$(basename "$HTML_FILE")" \
    covers/ \
    videos/ \
    > /dev/null

if [ ! -f "$ZIP_FILE" ]; then
    echo "❌ Error: Failed to create ZIP file"
    exit 1
fi

# Get file sizes
HTML_SIZE=$(du -h "$HTML_FILE" | cut -f1)
ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
COVER_COUNT=$(find covers -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.gif" -o -iname "*.webp" \) | wc -l | tr -d ' ')
VIDEO_COUNT=$(find videos -type f \( -iname "*.mp4" -o -iname "*.mov" -o -iname "*.webm" -o -iname "*.avi" \) | wc -l | tr -d ' ')

echo "✅ ZIP file created: $ZIP_FILE"
echo ""
echo "📊 Summary:"
echo "   HTML file: $HTML_SIZE"
echo "   ZIP file: $ZIP_SIZE"
echo "   Covers: $COVER_COUNT images"
echo "   Videos: $VIDEO_COUNT files"
echo ""
echo "📤 Ready to upload!"
echo "   File: $ZIP_FILE"
echo ""
echo "   Upload via admin panel:"
echo "   1. Go to Admin Dashboard"
echo "   2. Select Supercharge book"
echo "   3. Go to Covers, Landing Pages, or Marketing Assets"
echo "   4. Click 'Upload' and select: $ZIP_FILE"
echo ""



