# Asset Upload Guide: ZIP or Standalone HTML

## Overview

The system supports **two upload formats**:
1. **ZIP files** - containing HTML + media files (images, videos)
2. **Standalone HTML files** - single HTML file (images can be in external directories)

Both formats result in a **standalone HTML file with embedded images** (base64 data URLs) stored in the database. This creates self-contained HTML that works anywhere.

## How It Works

### Upload Formats

#### Option 1: ZIP File Upload
1. **Upload Process:**
   - Admin creates a ZIP file containing:
     - One HTML file (the main asset)
     - Image/video files referenced in the HTML
   - Admin uploads the ZIP file
   - System extracts ZIP to temporary directory
   - System finds the HTML file in the ZIP
   - System searches for image references in the HTML
   - Images are found and embedded as base64 data URLs
   - The bundled HTML (with embedded images) is stored in the database
   - Temporary files are cleaned up

#### Option 2: Standalone HTML File
1. **Upload Process:**
   - Admin uploads a single HTML file
   - System searches for image references in the HTML
   - Images are found in configured directories (see below)
   - Images are embedded as base64 data URLs
   - The bundled HTML (with embedded images) is stored in the database

**Note:** Both formats produce the same result - a standalone HTML file with all images embedded as base64.

2. **Image Resolution:**
   - The system searches for images in this order:
     1. Extracted ZIP directory (preserves directory structure) - **highest priority**
     2. Subdirectories within the extracted ZIP
     3. Book reports directory (`BOOK_REPORTS_PATH` environment variable)
     4. Subdirectories of the book reports directory

3. **HTML References:**
   - Images can be referenced in HTML using:
     - `<img src="image.jpg">` (same directory)
     - `<img src="images/logo.png">` (subdirectory)
     - `<img src="assets/banner.jpg">` (nested path)
     - CSS: `background-image: url(image.jpg)`
     - Links: `<a href="image.png">`

### For Videos
**Note:** Videos are currently **not** embedded as base64 (they're too large). Instead:

1. **Current Approach:**
   - Videos should be uploaded separately and served via API routes
   - HTML should reference videos using API paths like `/api/uploads/...`
   - The system will not automatically bundle videos into HTML

2. **Future Enhancement:**
   - Consider creating an API route to serve uploaded videos
   - Store videos in a dedicated uploads directory
   - Update HTML references to point to the API route

## Admin UI Usage

### Report Upload

**Format:** ZIP file OR standalone HTML file

1. **Option A - ZIP File:**
   - Create a ZIP file containing:
     - Your HTML file (e.g., `report.html`)
     - All image files referenced in the HTML
     - Preserve directory structure if needed (e.g., `images/chart.png`)
   - Click "Upload ZIP or HTML" and select your ZIP file

2. **Option B - Standalone HTML:**
   - Upload a single HTML file
   - Images should be in the configured directories (see Search Directories below)

3. The system will:
   - Extract ZIP (if applicable) or read HTML directly
   - Find image references in the HTML
   - Match them with files (from ZIP or search directories)
   - Embed images as base64 data URLs
   - Store the bundled HTML (standalone with embedded images) in the database

### Marketing Assets Upload

**Format:** ZIP file OR standalone HTML file

1. Enter an asset title (optional, defaults to date)
2. **Option A - ZIP File:**
   - Create a ZIP file containing HTML + images
   - Click "Upload ZIP or HTML" and select your ZIP file
3. **Option B - Standalone HTML:**
   - Upload a single HTML file
   - Images should be in the configured directories
4. The system will create a standalone HTML with embedded images

### Example ZIP Structure

```
marketing-asset.zip
├── marketing.html
├── hero-image.jpg
├── banner.jpg
└── images/
    └── logo.png
```

**marketing.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Marketing Asset</title>
</head>
<body>
  <h1>My Marketing Asset</h1>
  <img src="hero-image.jpg" alt="Hero">
  <img src="images/logo.png" alt="Logo">
  <div style="background-image: url(banner.jpg)"></div>
</body>
</html>
```

The system will automatically:
- Extract the ZIP
- Find `marketing.html`
- Find and embed `hero-image.jpg`, `images/logo.png`, and `banner.jpg`
- Store the bundled HTML in the database

## Technical Details

### API Endpoint

**POST** `/api/admin/books/[id]/marketing-assets`

**Form Data:**
- `file` (required): ZIP file (containing HTML + assets) or HTML file
- `title` (required): Asset title

**Response:**
```json
{
  "success": true,
  "assetId": "uuid",
  "title": "Asset Title",
  "uploadedAsZip": true,
  "extractedFilesCount": 5
}
```

### Implementation Files

- **Backend:** `src/app/api/admin/books/[id]/marketing-assets/route.ts`
- **Bundling Logic:** `src/server/utils/bundle-report-html.ts`
- **Admin UI:** `src/app/admin/page.tsx`

### Search Directories

The system searches for images in these directories (in order):

1. **Extracted ZIP directory** (temporary, created per upload)
   - Contains all files from the ZIP
   - Preserves directory structure
   - Highest priority

2. **Subdirectories** within extracted ZIP
   - Searches nested directories (e.g., `images/`, `assets/`)

3. **Book Reports Directory** (`BOOK_REPORTS_PATH`)
   - Default: `/Users/eerogetlost/book-reports`
   - Can be set via environment variable
   - Fallback for images not in ZIP

4. **Subdirectories** of book reports directory
   - Searches recursively in subdirectories

### Image Matching

The system matches image references in HTML to files by:
- Filename (e.g., `src="image.jpg"` matches `image.jpg`)
- Relative paths (e.g., `src="images/logo.png"` matches `images/logo.png`)
- Case-insensitive matching

## Limitations

1. **Videos:** Not currently bundled as base64 (too large). Use API routes for video serving.
2. **File Size:** Large images embedded as base64 can make HTML files very large.
3. **External URLs:** Images with `http://` or `https://` URLs are not processed.
4. **Data URLs:** Images already embedded as `data:` URLs are skipped.
5. **Multiple HTML Files:** If ZIP contains multiple HTML files, the first one found is used.

## ZIP File Requirements

1. **Must contain at least one HTML file** (`.html` extension)
2. **Directory structure is preserved** - use relative paths in HTML
3. **File names are case-sensitive** - match exactly what's in HTML
4. **Supported image formats:** jpg, jpeg, png, gif, webp, svg

## Future Enhancements

1. **Video Support:**
   - Create API route for serving uploaded videos
   - Store videos in dedicated directory
   - Update HTML to reference video API routes

2. **Image Optimization:**
   - Compress images before embedding
   - Convert to WebP format
   - Resize large images

3. **Better Error Handling:**
   - Show which images were found/not found
   - Provide warnings for missing images
   - Allow manual image path correction

4. **ZIP Validation:**
   - Validate ZIP structure before processing
   - Show preview of files in ZIP
   - Allow selecting which HTML file to use if multiple exist

