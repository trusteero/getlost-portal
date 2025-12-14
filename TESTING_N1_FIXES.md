# Testing Guide for N+1 Query Fixes

## 🎯 What Was Fixed

1. **`GET /api/books`** - Main dashboard endpoint
   - Before: 50+ queries for 10 books (N+1 problem)
   - After: ~8 batch queries total

2. **`GET /api/books/[id]`** - Single book detail endpoint
   - Before: 1 query per version for reports
   - After: 1 batch query for all reports

## ✅ Functional Testing

### 1. Dashboard Load (`GET /api/books`)

**Test Cases:**

1. **Empty Dashboard**
   - Log in as a new user with no books
   - Verify: Returns empty array `[]`
   - Check: No errors in console/network tab

2. **Single Book**
   - User with exactly 1 book
   - Verify: Book appears with all data
   - Check: All asset statuses display correctly (report, marketing, covers, landing page)

3. **Multiple Books (5-10 books)**
   - User with several books
   - Verify: All books load correctly
   - Check: Each book shows correct:
     - Latest version
     - Latest report status
     - Asset statuses (not_requested, requested, uploaded, viewed)
     - Features list
     - Precanned content indicator
     - Sample book indicator

4. **Books with Different Asset States**
   - Book with completed report → should show "viewed" or "uploaded"
   - Book with purchased feature but no assets → should show "requested"
   - Book with no purchases → should show "not_requested"
   - Book with admin-uploaded assets → should show "uploaded" or "viewed"

5. **Books with Multiple Versions**
   - Book with 2+ versions
   - Verify: Latest version is shown
   - Check: Report status reflects latest version's reports

### 2. Book Detail Page (`GET /api/books/[id]`)

**Test Cases:**

1. **Book with Single Version**
   - Navigate to book detail page
   - Verify: Version loads with reports
   - Check: Reports are ordered correctly (newest first)

2. **Book with Multiple Versions**
   - Book with 3+ versions
   - Verify: All versions load
   - Check: Each version shows its reports correctly
   - Verify: Summary extraction works for completed reports

3. **Book with No Reports**
   - Book that hasn't generated reports yet
   - Verify: Versions load but reports array is empty
   - Check: No errors

4. **Book with Multiple Reports per Version**
   - Version with 2+ reports
   - Verify: All reports appear
   - Check: Reports are ordered by `requestedAt` desc
   - Verify: Variant parsing works (preview, html, etc.)

## ⚡ Performance Testing

### 1. Network Tab Inspection

**Before Fix:**
- Multiple sequential requests for each book
- Many small queries

**After Fix:**
- Fewer, larger batch queries
- All data fetched in parallel

**How to Test:**
1. Open browser DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Load dashboard (`/dashboard`)
4. Check:
   - Number of requests to `/api/books` (should be 1)
   - Response time (should be faster)
   - Payload size (should be reasonable)

### 2. Response Time Comparison

**Test with different book counts:**

```bash
# Test with 1 book
# Expected: < 200ms

# Test with 5 books
# Expected: < 300ms

# Test with 10 books
# Expected: < 500ms

# Test with 20+ books
# Expected: < 1000ms
```

**How to measure:**
- Browser DevTools → Network tab → Check "Time" column
- Or add `console.time()` in the API route temporarily

### 3. Database Query Count

**Before:** For 10 books = ~50 queries
**After:** For 10 books = ~8 queries

**How to verify:**
- Add logging in the API route to count queries
- Or use database query logging (if available)

## 🔍 Edge Cases

### 1. Books with Missing Data

- Book with no versions → Should handle gracefully
- Book with no features → Should show empty features array
- Book with no assets → Should show "not_requested" for all asset types

### 2. Large Datasets

- User with 50+ books → Should still load (may be slower but shouldn't crash)
- Book with 10+ versions → Should load all versions
- Version with 20+ reports → Should load all reports

### 3. Concurrent Requests

- Open dashboard in multiple tabs
- Navigate between books quickly
- Verify: No race conditions, data consistency

## 🐛 Regression Testing

### Verify These Still Work:

1. **Asset Status Logic**
   - Precanned asset 10-second delay → Should show "requested" for 10 seconds after purchase
   - Admin-uploaded assets → Should be immediately accessible
   - Viewed assets → Should show "viewed" status

2. **Report Status Logic**
   - Completed reports → Should show "uploaded" or "viewed"
   - Pending purchases → Should show "requested"
   - No purchase → Should show "not_requested"

3. **Precanned Content Detection**
   - Books with precanned content → Should flag `hasPrecannedContent: true`
   - Books without precanned content → Should flag `hasPrecannedContent: false`

4. **Sample Book Detection**
   - Books with "Wool" or "Beach Read" in title → Should flag `isSample: true`

## 📊 Quick Test Checklist

- [ ] Dashboard loads with 0 books
- [ ] Dashboard loads with 1 book
- [ ] Dashboard loads with 5+ books
- [ ] All asset statuses display correctly
- [ ] Book detail page loads
- [ ] Multiple versions display correctly
- [ ] Reports appear for each version
- [ ] No console errors
- [ ] No network errors
- [ ] Response time is reasonable (< 1s for 10 books)
- [ ] Data is consistent (refresh shows same data)

## 🚨 What to Watch For

### Red Flags:

1. **Missing Data**
   - Books not appearing
   - Missing versions or reports
   - Empty asset statuses

2. **Incorrect Statuses**
   - "uploaded" when should be "viewed"
   - "not_requested" when should be "requested"
   - Wrong asset status for purchased features

3. **Performance Issues**
   - Slower than before (unlikely but possible)
   - Timeout errors
   - Memory issues with many books

4. **Type Errors**
   - TypeScript compilation errors
   - Runtime type errors in console

## 🔧 Manual Testing Steps

### Step 1: Basic Functionality
```bash
1. Log in to dashboard
2. Verify books load
3. Click on a book
4. Verify book detail page loads
5. Check all data is present
```

### Step 2: Different Scenarios
```bash
1. Test with books that have:
   - Completed reports
   - Pending purchases
   - No purchases
   - Admin-uploaded assets
   - Multiple versions
```

### Step 3: Performance Check
```bash
1. Open DevTools Network tab
2. Load dashboard
3. Check response time
4. Check number of requests
5. Compare with previous behavior (if possible)
```

### Step 4: Edge Cases
```bash
1. Test with empty data (no books)
2. Test with large datasets (many books)
3. Test rapid navigation
4. Test concurrent requests
```

## 📝 Expected Results

### Success Criteria:

✅ **Functional:**
- All books load correctly
- All data is present and accurate
- No missing information
- Statuses are correct

✅ **Performance:**
- Faster response times
- Fewer database queries
- Better scalability

✅ **Reliability:**
- No errors in console
- No crashes
- Consistent behavior

## 🐞 If Something Breaks

1. **Check Browser Console**
   - Look for JavaScript errors
   - Check for network errors

2. **Check Server Logs**
   - Look for database errors
   - Check for query failures

3. **Verify Data**
   - Check database directly
   - Verify data exists for the book

4. **Compare with Previous Version**
   - If possible, compare with code before fix
   - Check what changed

## 🎯 Priority Tests

**Must Test (Critical):**
1. Dashboard loads with multiple books
2. Book detail page loads correctly
3. Asset statuses are accurate
4. No errors in console

**Should Test (Important):**
1. Performance improvement
2. Edge cases (empty data, large datasets)
3. Different asset states

**Nice to Test (Optional):**
1. Concurrent requests
2. Stress testing (50+ books)
3. Query count verification

---

## Quick Test Script

If you want to quickly verify everything works:

```bash
# 1. Log in
# 2. Navigate to dashboard
# 3. Check browser console for errors
# 4. Check network tab - should see 1 request to /api/books
# 5. Verify books appear
# 6. Click a book
# 7. Verify book detail loads
# 8. Check all data is present
```

If all of the above pass, the fix is working! 🎉

