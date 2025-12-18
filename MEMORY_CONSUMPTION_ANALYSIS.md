# Server-Side Memory Consumption Analysis

## 🔴 Critical Memory Consumers (High Impact)

### 1. **Database Fields Storing Large Content**

#### `reports.htmlContent` (TEXT field)
- **Size**: 2-10 MB per report (can be larger with embedded images)
- **Impact**: CRITICAL - If loading 100 reports = 200MB-1GB+ memory
- **Where it's loaded**:
  - `/api/books/[id]/report/view` - Loads full HTML for viewing
  - `/api/admin/books/[id]/report/view` - Loads all reports
- **Current status**: ✅ FIXED** - Excluded from `/api/books` and `/api/admin/books` queries

#### `bookVersions.fileData` (TEXT field - Base64)
- **Size**: 10-50 MB per book file (base64 encoded = ~33% larger than original)
- **Impact**: CRITICAL - If loading 50 books with versions = 500MB-2.5GB+ memory
- **Where it's loaded**:
  - `/api/books/[id]/extract-metadata` - Falls back to DB if file not on disk
  - Any query that does `.select()` on `bookVersions` without excluding `fileData`
- **Current status**: ✅ FIXED** - Excluded from `/api/books` and `/api/admin/books` queries

#### `landingPages.htmlContent` (TEXT field)
- **Size**: 100KB-2MB per landing page
- **Impact**: MEDIUM - Usually only loaded when viewing specific landing page
- **Where it's loaded**: Landing page view routes

#### `marketingAssets.fileUrl` / `bookCovers.fileUrl`
- **Size**: Varies (images, videos, HTML)
- **Impact**: LOW-MEDIUM - Usually only metadata is loaded

---

### 2. **File Upload Operations**

#### `file.arrayBuffer()` - Loading Entire Files
- **Size**: Up to 50MB per file (your current limit)
- **Impact**: HIGH - Each upload loads entire file into memory
- **Where it happens**:
  - `/api/books` (POST) - Manuscript uploads
  - `/api/admin/books/[id]/report` - Report HTML/ZIP uploads
  - `/api/admin/books/[id]/marketing-assets` - Asset uploads
  - `/api/admin/books/[id]/covers` - Cover uploads
  - `/api/admin/books/[id]/landing-page` - Landing page uploads
- **Current status**: ⚠️ **UNOPTIMIZED** - All files loaded into memory before processing

#### `fs.readFile()` - Reading Files from Disk
- **Size**: Entire file size
- **Impact**: MEDIUM - Only when file is on disk (not in DB)
- **Where it happens**:
  - `/api/books/[id]/extract-metadata` - Reading book files
  - Report bundling operations
- **Current status**: ⚠️ **UNOPTIMIZED** - Could use streaming for large files

---

### 3. **ZIP File Operations**

#### Loading Entire ZIP into Memory
- **Size**: Entire ZIP file (can be 10-50MB+)
- **Impact**: HIGH - ZIP + extracted content = 2x memory usage
- **Where it happens**:
  - `/api/admin/books/[id]/report` - ZIP uploads
  - `/api/admin/books/[id]/preview-report` - ZIP previews
  - `/api/admin/books/[id]/landing-page` - ZIP uploads
  - `/api/admin/books/[id]/marketing-assets` - ZIP uploads
  - `/api/admin/books/[id]/covers` - ZIP uploads
- **Current code**:
  ```typescript
  const fileBytes = await file.arrayBuffer(); // Loads entire ZIP
  const zipBuffer = Buffer.from(fileBytes);   // Creates buffer copy
  const zip = new AdmZip(zipBuffer);          // Parses ZIP in memory
  zip.extractAllTo(tempDir, true);           // Extracts to disk (good!)
  ```
- **Current status**: ⚠️ **PARTIALLY OPTIMIZED** - Extracts to disk but loads ZIP into memory first

---

### 4. **Image Bundling Operations**

#### Converting Images to Base64 Data URLs
- **Size**: Each image = 100KB-2MB, multiplied by number of images
- **Impact**: HIGH - A report with 20 images = 2-40MB additional memory
- **Where it happens**:
  - `bundleReportHtmlFromContent()` - Embeds images into HTML
  - `bundleHtmlInline()` - Inlines images for reports
- **Current code**:
  ```typescript
  const imageBuffer = await fs.readFile(resolvedImagePath); // Load image
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`; // Convert to base64
  ```
- **Current status**: ⚠️ **UNOPTIMIZED** - All images loaded into memory, then converted to base64

---

### 5. **Database Query Results**

#### Loading Many Rows Without Limits
- **Size**: Depends on row count × row size
- **Impact**: HIGH - Can easily load millions of rows
- **Where it happens**:
  - ✅ **FIXED**: `/api/books` - Now limited to 50 books, excludes large fields
  - ✅ **FIXED**: `/api/admin/books` - Now paginated (200 per page), excludes large fields
  - ✅ **FIXED**: `/api/admin/users` - Now paginated (1000 per page)
  - ✅ **FIXED**: `/api/admin/database/query` - Now limited to 10,000 rows
  - ⚠️ **CHECK**: Other endpoints that might load unlimited data

#### N+1 Query Problems
- **Impact**: HIGH - 200 books × 10 queries each = 2000 queries + all data in memory
- **Current status**: ✅ **FIXED** - Both `/api/books` and `/api/admin/books` now use batch queries

---

### 6. **Base64 Encoding/Decoding**

#### Converting Between Base64 and Binary
- **Size**: Base64 is ~33% larger than binary, plus temporary buffers
- **Impact**: MEDIUM - When processing files stored as base64 in DB
- **Where it happens**:
  - `/api/books/[id]/extract-metadata` - `Buffer.from(latestVersion.fileData, 'base64')`
  - Image bundling - `imageBuffer.toString("base64")`
- **Current status**: ⚠️ **UNOPTIMIZED** - Creates temporary buffers

---

## 📊 Memory Consumption Estimates

### Worst Case Scenarios (Before Fixes):

1. **User Dashboard (`/api/books`)**:
   - 100 books × 10 versions × 5 reports × 5MB HTML = **25GB** potential
   - Plus fileData from versions = **Additional 5-25GB**
   - **Total: 30-50GB** ❌

2. **Admin Dashboard (`/api/admin/books`)**:
   - 1000 books × 10 queries each = **10,000+ queries**
   - Each query loads data = **10-50GB** potential
   - **Total: 10-50GB** ❌

3. **ZIP Upload**:
   - 50MB ZIP file = **50MB** in memory
   - Extracted content = **50MB** on disk (good!)
   - HTML content = **5MB** in memory
   - **Total: ~55MB** per upload ⚠️

4. **Image Bundling**:
   - Report with 20 images (1MB each) = **20MB** images
   - Base64 conversion = **27MB** (33% larger)
   - HTML with embedded images = **27MB** HTML
   - **Total: ~47MB** per report ⚠️

---

## ✅ Current Status After Fixes

### Fixed Issues:
1. ✅ `/api/books` - Excludes `htmlContent` and `fileData`, limited to 50 books
2. ✅ `/api/admin/books` - Excludes large fields, paginated, batch queries
3. ✅ `/api/admin/users` - Paginated
4. ✅ `/api/admin/database/query` - Limited to 10,000 rows

### Remaining Issues:
1. ⚠️ File uploads still load entire files into memory (`arrayBuffer()`)
2. ⚠️ ZIP files loaded entirely before extraction
3. ⚠️ Image bundling loads all images into memory
4. ⚠️ Base64 encoding creates temporary buffers
5. ⚠️ Some endpoints might still load large fields when viewing specific items

---

## 🎯 Recommendations for Further Optimization

### High Priority:
1. **Stream file uploads** instead of loading into memory
2. **Stream ZIP extraction** (if library supports it)
3. **Lazy load images** in reports (don't bundle, use URLs)
4. **Add limits to image bundling** (max images per report)

### Medium Priority:
1. **Use file streaming** for large file reads
2. **Cache bundled reports** to avoid re-bundling
3. **Move large content to object storage** (S3, etc.) instead of database

### Low Priority:
1. **Optimize base64 operations** (use streaming base64 if available)
2. **Add memory monitoring** to track actual usage
3. **Implement request queuing** for large operations

---

## 📈 Memory Usage by Operation

| Operation | Memory Usage | Status |
|-----------|-------------|--------|
| User dashboard (50 books) | ~5-10 MB | ✅ Optimized |
| Admin dashboard (200 books) | ~20-50 MB | ✅ Optimized |
| File upload (50MB file) | ~50 MB | ⚠️ Could stream |
| ZIP upload (50MB) | ~55 MB | ⚠️ Could stream |
| Report view (5MB HTML) | ~5 MB | ✅ Acceptable |
| Image bundling (20 images) | ~47 MB | ⚠️ Could optimize |
| Database query (10K rows) | Varies | ✅ Limited |

---

## 🔍 How to Monitor Memory Usage

1. **Add memory logging**:
   ```typescript
   const memUsage = process.memoryUsage();
   console.log(`Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
   ```

2. **Monitor specific endpoints**:
   - Log memory before/after large operations
   - Track peak memory usage per request

3. **Set up alerts**:
   - Alert when memory usage > 80% of available
   - Track memory growth over time

