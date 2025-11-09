# Demo Data Seeding

This directory contains scripts to seed demo data for the Get Lost Portal.

## Overview

The demo system stores all report and collateral data in the database:
- **Reports**: HTML reports stored in `getlostportal_report` table
- **Marketing Assets**: Video assets, social posts, banners in `getlostportal_marketing_asset` table
- **Book Covers**: eBook, paperback, hardcover covers in `getlostportal_book_cover` table
- **Landing Pages**: Landing page content in `getlostportal_landing_page` table

## Seeding Demo Data

### Seed Script

Use `scripts/seed-demo-data.js` to populate demo data for books:

```bash
# Seed data for a specific book
node scripts/seed-demo-data.js --book-title "Everlasting Gift"

# Seed data for all books
node scripts/seed-demo-data.js --all
```

### What It Does

1. **Reports**: Finds HTML reports in `BOOK_REPORTS_PATH` and stores them in the database
   - Matches reports to books by title (normalized matching)
   - Stores HTML content (images bundled on-the-fly when viewed)

2. **Marketing Assets**: Creates demo marketing assets
   - Book trailer video
   - Instagram post
   - Website banner

3. **Book Covers**: Creates demo book covers
   - eBook cover (primary)
   - Paperback cover
   - Hardcover design

4. **Landing Pages**: Creates demo landing pages
   - Hero section with headline
   - About section
   - Reviews section

### Automatic Population

When a user purchases/unlocks a feature, demo data is automatically populated:
- `marketing-assets`: Creates marketing assets
- `book-covers`: Creates book covers
- `landing-page`: Creates landing page
- `manuscript-report`: Uses report from database (seeded or uploaded)

## Database Tables

### Reports (`getlostportal_report`)
- `htmlContent`: HTML report content (images bundled on-the-fly)
- `status`: pending, analyzing, completed
- Linked to `bookVersionId`

### Marketing Assets (`getlostportal_marketing_asset`)
- `assetType`: video, social-post, banner
- `fileUrl`: URL to asset file
- `thumbnailUrl`: Preview image
- `metadata`: JSON metadata (dimensions, duration, etc.)

### Book Covers (`getlostportal_book_cover`)
- `coverType`: ebook, paperback, hardcover
- `imageUrl`: URL to cover image
- `isPrimary`: Boolean flag for primary cover

### Landing Pages (`getlostportal_landing_page`)
- `slug`: URL slug
- `headline`: Hero headline
- `subheadline`: Hero subheadline
- `htmlContent`: Rendered HTML
- `status`: draft, published, archived

## Render Deployment

For Render deployment:

1. **Seed data before deployment**:
   ```bash
   # Run locally and export database
   node scripts/seed-demo-data.js --all
   # Export database and import on Render
   ```

2. **Or seed via API** (if admin endpoints are available):
   - Reports can be uploaded via `/api/admin/reports/[id]/upload`
   - Other data will be auto-populated when features are purchased

3. **Environment Variables**:
   - `BOOK_REPORTS_PATH`: Path to reports directory (optional, only for local seeding)
   - `DATABASE_URL`: Database connection string

## Notes

- Reports are stored with HTML content in the database
- Images are bundled on-the-fly when reports are viewed (see `/api/books/[id]/report/view`)
- Demo data is created automatically when features are unlocked
- All data persists in the database (works on Render)

