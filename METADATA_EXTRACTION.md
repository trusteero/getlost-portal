# Book Metadata Extraction

## Current Implementation

Metadata extraction is now handled in two ways:

1. **Automatic extraction on upload** - When a book is uploaded via `POST /api/books`, metadata is extracted synchronously if it's an EPUB file.

2. **Manual extraction endpoint** - `POST /api/books/[id]/extract-metadata` allows you to:
   - Re-extract metadata for existing books
   - Extract metadata for books uploaded before extraction was implemented
   - Update metadata when source files change

## API Endpoints

### Extract Metadata
```bash
POST /api/books/{bookId}/extract-metadata
```

**Response:**
```json
{
  "success": true,
  "extracted": {
    "title": "1984",
    "author": "George Orwell",
    "description": "...",
    "language": "en",
    "coverImage": {
      "url": "/api/covers/{bookId}.jpg",
      "size": 12345,
      "mimeType": "image/jpeg"
    }
  },
  "updated": true,
  "book": {
    "id": "...",
    "title": "1984",
    "coverImageUrl": "/api/covers/{bookId}.jpg",
    "description": "..."
  }
}
```

### Get Extraction Info
```bash
GET /api/books/{bookId}/extract-metadata
```

**Response:**
```json
{
  "canExtract": true,
  "fileType": ".epub",
  "fileName": "1984.epub",
  "currentMetadata": {
    "title": "1984",
    "coverImageUrl": "/api/covers/...",
    "description": "..."
  },
  "supportedFormats": [".epub"]
}
```

## Should We Separate Into Another Service?

### Option 1: Keep in Same Service (Current) ✅ Recommended for Now

**Pros:**
- ✅ Simple architecture - no service communication needed
- ✅ Fast - no network overhead
- ✅ Easier to debug - everything in one codebase
- ✅ Lower latency - direct file access
- ✅ No additional infrastructure costs
- ✅ Works well for current scale

**Cons:**
- ❌ Ties extraction logic to the portal service
- ❌ If extraction becomes CPU-intensive, it could block the API
- ❌ Harder to scale extraction independently

**Best for:**
- Current scale (< 1000 books/day)
- Simple extraction (EPUB metadata only)
- When you want to keep things simple

### Option 2: Separate Microservice

**Pros:**
- ✅ Can scale extraction independently
- ✅ Doesn't block main API if extraction is slow
- ✅ Can be reused by other services
- ✅ Easier to update extraction logic without redeploying portal
- ✅ Can handle multiple file formats without bloating main service

**Cons:**
- ❌ More complex architecture
- ❌ Network overhead and latency
- ❌ Need to handle file transfer (upload to extraction service or shared storage)
- ❌ Additional service to deploy and maintain
- ❌ More failure points (network, service availability)

**Best for:**
- High volume (> 1000 books/day)
- Complex extraction (multiple formats, AI processing, etc.)
- When extraction becomes a bottleneck
- When you need to reuse extraction across multiple services

### Option 3: Background Job Queue (Hybrid)

**Pros:**
- ✅ Doesn't block API requests
- ✅ Can retry failed extractions
- ✅ Can batch process multiple books
- ✅ Still in same service, just async

**Cons:**
- ❌ More complex than synchronous
- ❌ Need job queue infrastructure (Redis, database, etc.)
- ❌ Users need to poll for completion

**Best for:**
- When extraction takes > 5 seconds
- When you want async but don't need separate service
- When you already have a job queue system

## Recommendation

**For now: Keep it in the same service** because:

1. **Current scale** - EPUB metadata extraction is fast (< 1 second typically)
2. **Simplicity** - No need for complex service communication
3. **Direct file access** - Books are already stored in the portal service
4. **Easy to change later** - The extraction logic is already modular (`extractEpubMetadata` function)

**When to consider separating:**

- If extraction takes > 5 seconds regularly
- If you need to support many more file formats (PDF, DOCX, etc.)
- If extraction volume exceeds 1000 books/day
- If you want to use external AI services for extraction
- If extraction becomes a CPU bottleneck

## Migration Path (If Needed Later)

If you decide to separate later, the migration is straightforward:

1. **Extract the function** - `extractEpubMetadata` is already a standalone utility
2. **Create extraction service** - New service with the extraction logic
3. **Update portal** - Change `/api/books/[id]/extract-metadata` to call the extraction service
4. **File transfer** - Either:
   - Upload file to extraction service
   - Use shared storage (S3, etc.)
   - Extraction service reads from portal's storage

The current endpoint design makes this migration easy - just swap the implementation.

## Usage Examples

### Extract metadata for an existing book:
```bash
curl -X POST http://localhost:3000/api/books/{bookId}/extract-metadata \
  -H "Cookie: your-session-cookie"
```

### Check if extraction is possible:
```bash
curl http://localhost:3000/api/books/{bookId}/extract-metadata \
  -H "Cookie: your-session-cookie"
```

### From the admin panel (future):
Add a "Re-extract Metadata" button in the admin book details view.

