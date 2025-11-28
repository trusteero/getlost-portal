# Debugging Cover Images

## Steps to Debug

### 1. Check Server Logs
When you try to view a cover image, check your Next.js server logs. You should see:
```
[Covers API] Request for cover: {filename}
[Covers API] process.cwd(): {path}
[Covers API] coverDir: {path}
[Covers API] filePath: {path}
```

### 2. Run Debug Script
```bash
# Check all books
node scripts/debug-covers.js

# Check specific book
node scripts/debug-covers.js {bookId}
```

### 3. Check Browser Console
Open browser DevTools → Console. Look for:
- `[ManuscriptCard] Failed to load cover image: {url}`
- `[ManuscriptCard] Successfully loaded cover: {url}`

### 4. Check Network Tab
1. Open DevTools → Network tab
2. Filter by "Img" or search for "covers"
3. Try to load a book with a cover
4. Check if the request to `/api/covers/{filename}` is:
   - ✅ 200 OK (success)
   - ❌ 404 Not Found (file missing)
   - ❌ 403 Forbidden (path issue)
   - ❌ 500 Error (server error)

### 5. Test API Directly
```bash
# Replace {filename} with actual cover filename from database
curl -I http://localhost:3000/api/covers/{filename}

# Should return 200 OK
```

### 6. Check Database
```sql
-- Check what coverImageUrl values are stored
SELECT id, title, coverImageUrl FROM getlostportal_book WHERE coverImageUrl IS NOT NULL;
```

### 7. Verify File Exists
```bash
# Check if file exists on disk
ls -la uploads/covers/

# Should see files like: {bookId}.jpg, {bookId}.png, etc.
```

## Common Issues

### Issue: coverImageUrl is null
**Solution**: Cover wasn't uploaded or was overwritten by precanned content

### Issue: File exists but API returns 404
**Possible causes**:
- Path resolution issue (check server logs for actual paths)
- File permissions
- process.cwd() pointing to wrong directory

### Issue: API returns 200 but image doesn't display
**Possible causes**:
- CORS issue
- Content-Type header wrong
- Browser cache (try hard refresh: Cmd+Shift+R)

### Issue: Image loads but shows broken
**Possible causes**:
- File is corrupted
- Wrong file extension
- MIME type mismatch

## Quick Fixes

### If coverImageUrl is wrong:
1. Check database: `SELECT id, title, coverImageUrl FROM getlostportal_book WHERE id = '{bookId}';`
2. Update if needed: `UPDATE getlostportal_book SET coverImageUrl = '/api/covers/{bookId}.jpg' WHERE id = '{bookId}';`

### If file is missing:
1. Re-upload the cover image
2. Or copy from precanned: `cp public/uploads/precanned/uploads/{filename} uploads/covers/{bookId}.{ext}`

### If path is wrong:
1. Check `process.cwd()` in server logs
2. Verify `COVER_STORAGE_PATH` environment variable
3. Ensure path is absolute or relative to project root


