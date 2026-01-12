# Uploading Supercharge HTML with Separate Covers and Videos

This guide shows you how to upload HTML files that reference covers and videos from separate directories.

## Your Directory Structure

```
/Users/eerogetlost/GetLostBooks/supercharge/
├── covers/
│   ├── Alternative Cover 1.png
│   ├── Alternative Cover 2.png
│   ├── Alternative Cover 3.png
│   ├── Alternative Cover 4.png
│   ├── Alternative Cover 5.png
│   └── Alternative Cover 6.png
└── videos/
    ├── Supercharge Chaotic Meeting 5sec.mp4
    ├── Supercharge Meeting Alt Action 5sec.mp4
    ├── Supercharge Meeting Scene 5sec.mp4
    └── ... (other videos)
```

## Option 1: Create ZIP File (Recommended)

### Step 1: Generate HTML

```bash
cd /Users/eerogetlost/getlostportal/scripts
python3 generate-supercharge-html.py supercharge-assets.html supercharge-example.json
```

This creates HTML that references:
- `covers/Alternative Cover 1.png` (and other covers)
- `videos/Supercharge Chaotic Meeting 5sec.mp4` (and other videos)

### Step 2: Create ZIP File

```bash
cd /Users/eerogetlost/GetLostBooks/supercharge
zip -r supercharge-assets.zip supercharge-assets.html covers/ videos/
```

This creates:
```
supercharge-assets.zip
├── supercharge-assets.html
├── covers/
│   ├── Alternative Cover 1.png
│   ├── Alternative Cover 2.png
│   └── ...
└── videos/
    ├── Supercharge Chaotic Meeting 5sec.mp4
    └── ...
```

### Step 3: Upload ZIP to Portal

1. Go to Admin Dashboard
2. Select the Supercharge book
3. Go to the appropriate section (Covers, Landing Pages, or Marketing Assets)
4. Click "Upload"
5. Select `supercharge-assets.zip`

The portal will:
- Extract the ZIP
- Find `supercharge-assets.html`
- Find all images in `covers/` directory
- Embed images as base64
- Store standalone HTML in database
- **Note:** Videos are NOT embedded (too large), but references are preserved

## Option 2: Upload HTML Only (Images in Book-Reports)

If you want to upload HTML only, you need to copy images to the book-reports directory:

### Step 1: Copy Covers to Book-Reports

```bash
# Create book-specific directory
mkdir -p ~/book-reports/supercharge/covers
mkdir -p ~/book-reports/supercharge/videos

# Copy covers
cp -r /Users/eerogetlost/GetLostBooks/supercharge/covers/* ~/book-reports/supercharge/covers/

# Copy videos (optional - videos won't be embedded anyway)
cp -r /Users/eerogetlost/GetLostBooks/supercharge/videos/* ~/book-reports/supercharge/videos/
```

### Step 2: Generate HTML with Correct Paths

The HTML should reference:
```html
<img src="supercharge/covers/Alternative Cover 1.png">
<video src="supercharge/videos/Supercharge Chaotic Meeting 5sec.mp4">
```

### Step 3: Upload HTML Only

Upload just the HTML file - portal will find images in `~/book-reports/supercharge/`

## HTML Structure

The generated HTML will look like:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Supercharge - Book Assets</title>
</head>
<body>
  <!-- Main cover -->
  <img src="covers/Alternative Cover 1.png" alt="Supercharge">
  
  <!-- Covers gallery -->
  <div>
    <img src="covers/Alternative Cover 1.png">
    <img src="covers/Alternative Cover 2.png">
    <!-- ... -->
  </div>
  
  <!-- Videos -->
  <div>
    <video src="videos/Supercharge Chaotic Meeting 5sec.mp4" controls></video>
    <!-- ... -->
  </div>
</body>
</html>
```

## Video Handling

**Important:** Videos are NOT embedded as base64 (they're too large).

### Current Behavior
- Videos are referenced in HTML: `<video src="videos/file.mp4">`
- Portal preserves these references
- Videos need to be served separately (via API or file server)

### Future Enhancement
- Videos will be uploaded to a dedicated storage
- HTML will reference videos via API routes: `/api/uploads/videos/file.mp4`
- Videos served on-demand

## Quick Start Commands

```bash
# 1. Generate HTML
cd /Users/eerogetlost/getlostportal/scripts
python3 generate-supercharge-html.py ../supercharge-assets.html supercharge-example.json

# 2. Create ZIP (from GetLostBooks/supercharge directory)
cd /Users/eerogetlost/GetLostBooks/supercharge
zip -r supercharge-assets.zip supercharge-assets.html covers/ videos/

# 3. Upload supercharge-assets.zip via admin panel
```

## Customization

You can modify `generate-supercharge-html.py` to:
- Add more sections (personas, marketing, etc.)
- Change layout and styling
- Add more image galleries
- Customize video display

## Troubleshooting

### Images Not Found

If images aren't being found in the ZIP:
1. Check ZIP structure - images should be in `covers/` subdirectory
2. Check HTML references - should be `src="covers/filename.png"`
3. Check file names - match case exactly

### Videos Not Playing

Videos won't play if:
1. They're not in the ZIP (for ZIP uploads)
2. They're not in book-reports directory (for HTML-only uploads)
3. Browser doesn't support the video format

Videos need to be served via a web server or API route to play in the browser.

## Summary

✅ **Use ZIP file upload** - Easiest way to include HTML + covers + videos  
✅ **HTML references images** - Portal finds and embeds automatically  
✅ **Videos preserved** - References kept, but not embedded  
✅ **Standalone result** - Final HTML has images embedded, videos referenced  

The portal handles all the image finding and embedding automatically!



