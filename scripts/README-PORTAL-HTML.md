# Generate HTML Files for Portal Upload

This script generates standalone HTML files that can be uploaded directly to the Get Lost Portal for your customers.

## Quick Start

### 1. Create a book data JSON file

Create a JSON file with your book information:

```json
{
  "title": "My Book Title",
  "author": "Author Name",
  "subtitle": "A compelling subtitle",
  "description": "Book description here...",
  "cover_image": "path/to/cover.jpg"
}
```

### 2. Generate the HTML file

```bash
cd /Users/eerogetlost/getlostportal/scripts
python3 generate-portal-html.py example-book-data.json output.html
```

### 3. Upload to Portal

The generated HTML file can be uploaded via the admin panel:
- **Reports**: Upload via the Reports section for a book
- **Landing Pages**: Upload via the Landing Pages section
- **Covers**: Upload via the Book Covers section
- **Marketing Assets**: Upload via the Marketing Assets section

## Features

- ✅ Standalone HTML (all styles and scripts included)
- ✅ Responsive design (works on mobile and desktop)
- ✅ Tabbed interface (Overview, Demographics, Classification, Personas, Marketing)
- ✅ Optional image embedding (images can be embedded as base64 or referenced)
- ✅ Portal-ready format (matches the portal's expected structure)

## Options

### Use Separate Images (Recommended)

**By default**, images are referenced separately (not embedded). This is the recommended approach:

```bash
python3 generate-portal-html.py book-data.json output.html
```

Then upload either:
1. **ZIP file** containing HTML + images
2. **HTML file only** (images should be in the book-reports directory)

The portal will automatically find and embed images when you upload.

### Embed Images in HTML

If you want images embedded as base64 in the HTML file itself:

```bash
python3 generate-portal-html.py book-data.json output.html --embed-images
```

Note: This makes the HTML file larger, but it's fully standalone.

## Using Existing Report Data

If you have existing report JSON files from the book-report-generator, you can create a simple wrapper script to convert them:

```python
import json
import sys
from pathlib import Path

# Load your existing report JSON
with open('path/to/report.json', 'r') as f:
    report_data = json.load(f)

# Convert to portal format
book_data = {
    "title": report_data.get('book_title', ''),
    "author": report_data.get('author', ''),
    "subtitle": report_data.get('subtitle', ''),
    "description": report_data.get('description', ''),
    "cover_image": report_data.get('cover_image_path', '')
}

# Save and use with generate-portal-html.py
with open('portal-book-data.json', 'w') as f:
    json.dump(book_data, f, indent=2)
```

## Upload Formats

The portal accepts two formats:

1. **Standalone HTML file** - Just upload the `.html` file
2. **ZIP file** - ZIP containing HTML + images/videos

The portal will automatically:
- Extract ZIP files
- Find images referenced in HTML
- Embed images as base64 data URIs
- Store the final standalone HTML in the database

## Example Workflow

1. **Generate HTML from your data:**
   ```bash
   python3 generate-portal-html.py my-book.json my-book-report.html
   ```

2. **Upload via Admin Panel:**
   - Go to Admin Dashboard
   - Select the book
   - Go to "Reports" section
   - Click "Upload"
   - Select `my-book-report.html`

3. **Or upload via API:**
   ```bash
   curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "file=@my-book-report.html" \
     https://your-portal.com/api/admin/books/BOOK_ID/report
   ```

## Customization

The generated HTML uses:
- **Tailwind CSS** (via CDN) for styling
- **Lucide Icons** (via CDN) for icons
- Responsive grid layout
- Tab-based navigation

You can modify `generate-portal-html.py` to customize:
- Additional tabs
- Different layouts
- Custom styling
- Additional sections

## Notes

- Images are automatically embedded as base64 when uploaded to the portal
- The HTML is stored standalone in the database (no external dependencies)
- Customers can view reports directly in the portal
- Reports can be downloaded as standalone HTML files

