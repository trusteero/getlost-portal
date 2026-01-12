# Using HTML with Separate Images/Videos

Yes! You can absolutely use HTML and images/videos separately. The portal supports this in two ways:

## Option 1: Upload HTML Only (Images in Book-Reports Directory)

### How It Works

1. **Create your HTML file** with image references:
   ```html
   <img src="cover.jpg" alt="Book Cover">
   <img src="images/chart.png" alt="Chart">
   ```

2. **Place images in the book-reports directory:**
   ```
   /Users/eerogetlost/book-reports/
   ├── cover.jpg
   └── images/
       └── chart.png
   ```

3. **Upload just the HTML file** via the admin panel

4. **Portal automatically:**
   - Searches for images in the book-reports directory
   - Finds images referenced in HTML
   - Embeds them as base64
   - Stores standalone HTML in database

### Search Order

The portal searches for images in this order:
1. Book reports directory (`BOOK_REPORTS_PATH` env var, default: `/Users/eerogetlost/book-reports`)
2. Subdirectories of book reports directory
3. Recursively searches nested directories

## Option 2: Upload ZIP File (HTML + Images Together)

### How It Works

1. **Create a ZIP file** containing:
   ```
   my-report.zip
   ├── report.html
   ├── cover.jpg
   └── images/
       ├── chart.png
       └── logo.png
   ```

2. **HTML references images with relative paths:**
   ```html
   <img src="cover.jpg" alt="Cover">
   <img src="images/chart.png" alt="Chart">
   <img src="images/logo.png" alt="Logo">
   ```

3. **Upload the ZIP file** via admin panel

4. **Portal automatically:**
   - Extracts ZIP to temporary directory
   - Finds HTML file
   - Finds images referenced in HTML
   - Embeds images as base64
   - Stores standalone HTML in database

### ZIP Structure Example

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

## Image Reference Formats

The portal finds images referenced in these ways:

### HTML Attributes
- `<img src="image.jpg">`
- `<img src="images/logo.png">`
- `<a href="image.png">`

### CSS
- `background-image: url(image.jpg)`
- `background-image: url('images/banner.png')`

### Supported Formats
- `.jpg`, `.jpeg`
- `.png`
- `.gif`
- `.webp`
- `.svg`

## Video Handling

**Important:** Videos are NOT embedded as base64 (they're too large).

### Current Approach
1. Upload videos separately via API
2. Reference videos in HTML using API paths:
   ```html
   <video src="/api/uploads/video.mp4"></video>
   ```

### Future Enhancement
- Videos will be served via dedicated API routes
- HTML will reference videos using API paths
- Videos stored in dedicated uploads directory

## Example Workflow

### Using Separate Images

1. **Generate HTML:**
   ```bash
   python3 generate-portal-html.py book-data.json report.html
   ```

2. **Create book-data.json:**
   ```json
   {
     "title": "My Book",
     "author": "Author Name",
     "cover_image": "cover.jpg"
   }
   ```

3. **Place images in book-reports:**
   ```bash
   cp cover.jpg ~/book-reports/
   ```

4. **Upload HTML only:**
   - Go to admin panel
   - Select book
   - Upload `report.html`
   - Portal finds `cover.jpg` automatically

### Using ZIP File

1. **Generate HTML:**
   ```bash
   python3 generate-portal-html.py book-data.json report.html
   ```

2. **Create ZIP:**
   ```bash
   zip my-report.zip report.html cover.jpg images/*.png
   ```

3. **Upload ZIP:**
   - Go to admin panel
   - Select book
   - Upload `my-report.zip`
   - Portal extracts and processes automatically

## Benefits of Separate Images

✅ **Smaller HTML files** - HTML stays lightweight  
✅ **Easier to update** - Change images without regenerating HTML  
✅ **Better organization** - Keep images in separate directories  
✅ **Faster uploads** - Upload HTML first, images can be added later  
✅ **Automatic processing** - Portal handles embedding automatically  

## Best Practices

1. **Use relative paths** in HTML:
   - ✅ `src="image.jpg"` (same directory)
   - ✅ `src="images/logo.png"` (subdirectory)
   - ❌ `src="/absolute/path/image.jpg"` (won't work)
   - ❌ `src="http://example.com/image.jpg"` (external URLs skipped)

2. **Organize images in subdirectories:**
   ```
   report.html
   images/
   ├── cover.jpg
   ├── charts/
   │   └── chart1.png
   └── logos/
       └── logo.png
   ```

3. **Use descriptive filenames:**
   - ✅ `book-cover.jpg`
   - ✅ `demographics-chart.png`
   - ❌ `img1.jpg`, `temp.png`

4. **Match case exactly:**
   - HTML: `src="Cover.jpg"`
   - File: `Cover.jpg` ✅
   - File: `cover.jpg` ❌ (case-sensitive)

## Troubleshooting

### Images Not Found

If images aren't being found:

1. **Check file paths** - Use relative paths, match case exactly
2. **Check file location** - Images should be in book-reports directory or ZIP
3. **Check file extensions** - Must match exactly (`.jpg` vs `.jpeg`)
4. **Check console logs** - Portal logs which images were found/not found

### Missing Images Warning

The portal will log warnings for missing images:
```
⚠️  Could not find image referenced in HTML: images/logo.png
```

This won't break the upload, but the image won't be embedded.

## Summary

✅ **Yes, you can use HTML and images separately!**

- Upload HTML only → Portal searches book-reports directory
- Upload ZIP file → Portal extracts and finds images
- Both methods result in standalone HTML with embedded images
- Videos handled separately (not embedded, served via API)

The portal automatically handles finding and embedding images, so you can keep your HTML and images separate for easier management.



