# Safer Database Migrations

This document explains the improved database migration system that makes database updates safer and more resilient.

## Overview

The new migration system:
- **Automatically checks and creates missing columns** on app startup
- **Gracefully handles missing columns** in queries (only selects columns that exist)
- **Prevents crashes** when columns are missing
- **Provides manual fix endpoints** for admin use

## How It Works

### 1. Automatic Column Checks on Startup

When the database connection is established (`src/server/db/index.ts`), the system automatically:
- Checks if required columns exist in the `getlostportal_book` table
- Creates missing columns if needed
- Logs the results

This happens **synchronously** before any queries run, ensuring the schema is always up-to-date.

### 2. Safe Query Building

Queries in `src/app/api/books/route.ts` and `src/app/api/admin/books/route.ts` now:
- Check if columns exist before selecting them
- Only include columns in SELECT statements if they exist
- Provide default values for missing columns

Example:
```typescript
// Only add optional columns if they exist
if (columnExists("getlostportal_book", "authorName")) {
  selectFields.authorName = books.authorName;
}
```

### 3. Safe Insert/Update Operations

Insert and update operations:
- Check column existence before including them in operations
- Skip optional columns if they don't exist
- Ensure columns are created before operations

### 4. Manual Fix Endpoint

Admins can manually trigger migrations via:
```
POST /api/admin/fix-database
```

This endpoint:
- Runs all pending migrations
- Returns a status report
- Can be called via HTTP (no shell access needed)

## Current Required Columns

The system ensures these columns exist in `getlostportal_book`:
- `authorName` (text, 500 chars) - Optional
- `authorBio` (text) - Optional
- `manuscriptStatus` (text, 50 chars, default: 'queued') - Optional

## Migration Files

- `src/server/db/migrations.ts` - Core migration utilities
- `src/server/db/safe-queries.ts` - Safe query wrappers (for future use)
- `scripts/run-migrations.js` - Manual migration runner
- `scripts/fix-missing-columns.js` - Quick column fixer

## Benefits

1. **No More Crashes**: App won't crash if columns are missing
2. **Automatic Recovery**: Missing columns are created automatically
3. **Graceful Degradation**: App works even if some columns are missing
4. **Easy Fixes**: Admin endpoint allows fixing without shell access
5. **Idempotent**: Running migrations multiple times is safe

## Usage

### Automatic (Recommended)
Migrations run automatically on app startup. No action needed.

### Manual Fix (If Needed)
If you see errors about missing columns:

1. **Via API** (while logged in as admin):
   ```bash
   curl -X POST https://your-app.onrender.com/api/admin/fix-database \
     -H "Cookie: your-session-cookie"
   ```

2. **Via Browser Console** (while logged in as admin):
   ```javascript
   fetch('/api/admin/fix-database', { method: 'POST' })
     .then(r => r.json())
     .then(console.log)
   ```

3. **Via Render Shell**:
   ```bash
   npm run db:fix-columns
   ```

## Future Improvements

- Add migration version tracking
- Support rollback operations
- Add migration tests
- Extend to other tables beyond `getlostportal_book`

