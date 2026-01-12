#!/bin/bash
# Create separate ZIP files for Supercharge covers and videos
# This script generates two HTML files and creates two ZIP files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GETLOST_BOOKS="/Users/eerogetlost/GetLostBooks"
SUPERCHARGE_DIR="$GETLOST_BOOKS/supercharge"
OUTPUT_DIR="$SUPERCHARGE_DIR"

echo "📚 Creating separate ZIP files for Supercharge covers and videos..."
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

# Generate HTML files
echo "📄 Generating HTML files..."
if [ -f "$SCRIPT_DIR/supercharge-example.json" ]; then
    python3 "$SCRIPT_DIR/generate-supercharge-html.py" "$OUTPUT_DIR" "$SCRIPT_DIR/supercharge-example.json"
else
    python3 "$SCRIPT_DIR/generate-supercharge-html.py" "$OUTPUT_DIR"
fi

COVERS_HTML="$OUTPUT_DIR/supercharge-covers.html"
VIDEOS_HTML="$OUTPUT_DIR/supercharge-videos.html"

if [ ! -f "$COVERS_HTML" ] || [ ! -f "$VIDEOS_HTML" ]; then
    echo "❌ Error: Failed to generate HTML files"
    exit 1
fi

echo "✅ HTML files generated"
echo ""

# Create ZIP files
echo "📦 Creating ZIP files..."
cd "$SUPERCHARGE_DIR"

# Remove old ZIPs if they exist
[ -f "supercharge-covers.zip" ] && rm "supercharge-covers.zip"
[ -f "supercharge-videos.zip" ] && rm "supercharge-videos.zip"

# Create covers ZIP
echo "   Creating covers ZIP..."
zip -r "supercharge-covers.zip" \
    "$(basename "$COVERS_HTML")" \
    covers/ \
    > /dev/null

# Create videos ZIP
echo "   Creating videos ZIP..."
zip -r "supercharge-videos.zip" \
    "$(basename "$VIDEOS_HTML")" \
    videos/ \
    > /dev/null

# Get file sizes and counts
COVERS_ZIP_SIZE=$(du -h "supercharge-covers.zip" | cut -f1)
VIDEOS_ZIP_SIZE=$(du -h "supercharge-videos.zip" | cut -f1)
COVER_COUNT=$(find covers -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.gif" -o -iname "*.webp" \) | wc -l | tr -d ' ')
VIDEO_COUNT=$(find videos -type f \( -iname "*.mp4" -o -iname "*.mov" -o -iname "*.webm" -o -iname "*.avi" \) | wc -l | tr -d ' ')

echo ""
echo "✅ ZIP files created!"
echo ""
echo "📊 Summary:"
echo "   📚 Covers ZIP: supercharge-covers.zip ($COVERS_ZIP_SIZE)"
echo "      - HTML: supercharge-covers.html"
echo "      - Covers: $COVER_COUNT images"
echo ""
echo "   🎥 Videos ZIP: supercharge-videos.zip ($VIDEOS_ZIP_SIZE)"
echo "      - HTML: supercharge-videos.html"
echo "      - Videos: $VIDEO_COUNT files"
echo ""
echo "📤 Ready to upload!"
echo ""
echo "   Upload covers ZIP:"
echo "   1. Go to Admin Dashboard"
echo "   2. Select Supercharge book"
echo "   3. Go to 'Book Covers' section"
echo "   4. Click 'Upload' and select: supercharge-covers.zip"
echo ""
echo "   Upload videos ZIP:"
echo "   1. Go to Admin Dashboard"
echo "   2. Select Supercharge book"
echo "   3. Go to 'Marketing Assets' section"
echo "   4. Click 'Upload' and select: supercharge-videos.zip"
echo ""



