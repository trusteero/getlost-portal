# 512MB Server Memory Optimizations

## 🎯 Critical Changes for 512MB Server

### Memory Breakdown (512MB Total):
- **Node.js Runtime**: ~50-100MB
- **Database (SQLite)**: ~50-100MB  
- **Application Code**: ~50-100MB
- **Available for Operations**: ~200-300MB
- **Safety Margin**: Keep operations under ~150MB

---

## ✅ Optimizations Applied

### 1. **File Size Limits**
- **Before**: 50MB per file
- **After**: 20MB per file
- **Impact**: Reduces memory usage per upload from 50MB to 20MB
- **Rationale**: With 200-300MB available, 20MB allows ~10-15 concurrent uploads safely

### 2. **User Books Endpoint (`/api/books`)**
- **Books Limit**: 50 → **20 books**
- **Versions per Book**: 10 → **5 versions**
- **Reports per Version**: 5 → **3 reports**
- **Assets per Book**: 20 → **10 assets**
- **Estimated Memory**: ~2-4MB per request (down from ~5-10MB)

### 3. **Admin Books Endpoint (`/api/admin/books`)**
- **Books per Page**: 200 → **50 books**
- **Assets per Book**: 20 → **10 assets**
- **Estimated Memory**: ~5-10MB per request (down from ~20-50MB)

### 4. **Admin Users Endpoint (`/api/admin/users`)**
- **Users per Page**: 1000 → **500 users**
- **Estimated Memory**: ~5-10MB per request

### 5. **Database Query Endpoint**
- **Max Rows**: 10,000 → **5,000 rows**
- **Estimated Memory**: Varies by row size, but safer

### 6. **Image Bundling**
- **Max Images**: Unlimited → **10 images per report**
- **Impact**: Prevents loading 20+ images (20-40MB) into memory
- **Estimated Memory**: ~10-25MB per bundling operation (down from 47MB+)

---

## 📊 Memory Usage Estimates (After Optimizations)

| Operation | Memory Usage | % of Available | Status |
|-----------|-------------|----------------|--------|
| User dashboard (20 books) | ~2-4 MB | 1-2% | ✅ Safe |
| Admin dashboard (50 books) | ~5-10 MB | 2-5% | ✅ Safe |
| File upload (20MB file) | ~20 MB | 10-13% | ⚠️ Monitor |
| ZIP upload (20MB) | ~25 MB | 13-17% | ⚠️ Monitor |
| Image bundling (10 images) | ~10-25 MB | 5-17% | ✅ Safe |
| Database query (5K rows) | Varies | - | ✅ Limited |

---

## ⚠️ Remaining Risks

### High Risk Operations (Still Need Attention):

1. **Concurrent File Uploads**
   - **Risk**: 5 concurrent 20MB uploads = 100MB
   - **Mitigation**: Consider request queuing or further reducing file size limit

2. **ZIP File Processing**
   - **Risk**: 20MB ZIP + extraction = ~25MB memory
   - **Mitigation**: Could stream ZIP extraction if library supports it

3. **Image Bundling During Upload**
   - **Risk**: Uploading report with 10 images = 25MB+ memory
   - **Mitigation**: Already limited to 10 images

4. **Multiple Concurrent Requests**
   - **Risk**: 10 users loading dashboards simultaneously = 20-40MB
   - **Mitigation**: Current limits should handle this

---

## 🎯 Recommendations

### Immediate Actions:
1. ✅ **DONE**: Reduced all limits for 512MB server
2. ⚠️ **MONITOR**: Watch memory usage in production
3. ⚠️ **CONSIDER**: Further reduce file size to 15MB if issues persist

### Future Optimizations:
1. **Stream file uploads** - Don't load entire file into memory
2. **Stream ZIP extraction** - Extract directly to disk without loading ZIP
3. **Lazy image loading** - Don't bundle images, use URLs instead
4. **Request queuing** - Queue large operations to prevent concurrent memory spikes
5. **Memory monitoring** - Add alerts when memory usage > 80%

---

## 🔍 Monitoring Recommendations

Add memory logging to track actual usage:

```typescript
const memUsage = process.memoryUsage();
const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
const rssMB = Math.round(memUsage.rss / 1024 / 1024);

console.log(`[Memory] Heap: ${heapUsedMB}MB/${heapTotalMB}MB, RSS: ${rssMB}MB`);
```

**Alert thresholds for 512MB server:**
- **Warning**: RSS > 400MB (78% of total)
- **Critical**: RSS > 450MB (88% of total)
- **Action**: RSS > 480MB (94% of total) - Reject new requests

---

## 📝 Summary

With these optimizations, the server should be able to handle:
- ✅ 20 books per user dashboard
- ✅ 50 books per admin page
- ✅ 20MB file uploads
- ✅ 10 images per report bundling
- ✅ Multiple concurrent requests

**Estimated peak memory usage**: ~150-200MB for normal operations, leaving ~300MB headroom for Node.js, database, and spikes.

