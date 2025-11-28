# Digest Processing - Automatic Metadata Extraction

## Overview

The system includes automatic digest processing that extracts metadata from uploaded books using the BookDigest service. This happens automatically when a book is uploaded.

## What Gets Extracted

When a book is uploaded, the system:

1. **Triggers a digest job** - Sends the book file to the BookDigest service
2. **Extracts metadata** including:
   - **Title** - Book title from metadata
   - **Author** - Book author
   - **Cover Image** - Book cover image URL
   - **Pages** - Number of pages
   - **Words** - Word count
   - **Language** - Book language
   - **Brief** - Short summary/brief
   - **Short Summary** - Medium-length summary
   - **Summary** - Full summary

3. **Automatically updates the book** with extracted metadata:
   - **Cover Image** - Downloads and stores cover image if not already set
   - **Title** - Updates title if it looks like a filename (contains file extension)
   - **Description** - Sets description from brief if empty

## How It Works

### 1. Book Upload
When a user uploads a book:
- Book is created in database
- BookDigest job is triggered asynchronously
- Job status is tracked in `digest_job` table

### 2. Processing
- BookDigest service processes the book file
- Extracts metadata and cover image
- Returns results via API

### 3. Status Checking
- System periodically checks job status
- When completed, extracts results
- Updates book with metadata

### 4. Automatic Updates
The system automatically updates the book with:
- **Cover Image**: Downloaded and stored at `/api/covers/{bookId}.{ext}`
- **Title**: Updated if current title looks like a filename
- **Description**: Set from brief if currently empty

## Configuration

### Environment Variables

```bash
# BookDigest Service URL
BOOKDIGEST_URL=https://bookdigest.onrender.com

# BookDigest API Key (required)
BOOKDIGEST_API_KEY=your_api_key_here
```

### Cover Image Storage

Cover images are stored in:
- **Path**: `COVER_STORAGE_PATH` environment variable (default: `./uploads/covers`)
- **URL**: `/api/covers/{bookId}.{ext}`
- **Format**: Automatically determined from MIME type

## Database Schema

### `digest_job` Table
Stores digest job status and results:
- `id` - Job ID
- `bookId` - Reference to book
- `externalJobId` - Job ID from BookDigest service
- `status` - pending, processing, completed, failed
- `coverUrl` - Cover image URL from service
- `title`, `author`, `pages`, `words`, `language` - Extracted metadata
- `brief`, `shortSummary`, `summary` - Extracted summaries
- `textUrl` - URL to extracted text

### `book` Table
Updated with extracted metadata:
- `title` - Updated if extracted and current title is filename
- `coverImageUrl` - Updated if extracted and not already set
- `description` - Updated with brief if empty

## Status Flow

1. **pending** - Job created, waiting to be processed
2. **processing** - BookDigest service is processing
3. **completed** - Processing complete, metadata extracted
4. **failed** - Processing failed (error stored in `error` field)

## API Endpoints

### Check Digest Status
**GET** `/api/books/[id]/digest`
Returns current digest job status and results

### Trigger Digest (Manual)
**POST** `/api/books/[id]/digest`
Manually trigger a digest job for a book

### Check Multiple Jobs
**POST** `/api/digest/check-jobs`
Check status of multiple digest jobs

## Automatic Updates Logic

### Title Update
- Updates if extracted title exists
- Only updates if current title:
  - Looks like a filename (contains `.pdf`, `.epub`, etc.)
  - Is empty or missing
- Preserves user-entered titles

### Cover Image Update
- Downloads cover image from BookDigest service
- Stores locally at `/api/covers/{bookId}.{ext}`
- Only updates if book doesn't already have a cover
- Handles various image formats (jpg, png, webp, etc.)

### Description Update
- Sets description from `brief` if extracted
- Only updates if description is currently empty
- Preserves existing descriptions

## Error Handling

- Digest processing is **non-blocking** - book creation succeeds even if digest fails
- Failed jobs are logged with error messages
- Jobs can be retried manually
- Missing API key logs warning but doesn't fail

## Monitoring

Digest job status is visible in:
- **Admin Dashboard** - Shows digest status for each book
- **User Dashboard** - Shows processing status
- **API Responses** - Include digest job information

## Future Enhancements

Potential improvements:
1. **Author Field** - Add author field to books table and update from digest
2. **Additional Metadata** - Store pages, words, language on book record
3. **Retry Logic** - Automatic retry of failed jobs
4. **Webhook Support** - Receive digest completion via webhook instead of polling
5. **Batch Processing** - Process multiple books in batch

