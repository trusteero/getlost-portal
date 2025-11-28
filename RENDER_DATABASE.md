# Database on Render Deployment

This document explains how the database is configured, initialized, and persisted on Render.com.

---

## 📊 Overview

The application uses **SQLite** stored on a **persistent disk** on Render. This ensures data persists across redeploys and restarts.

### Key Details:
- **Database Type**: SQLite (better-sqlite3)
- **Location**: `/var/data/db.sqlite`
- **Storage**: Persistent disk (1GB, mounted at `/var/data`)
- **Persistence**: ✅ Data survives redeploys, restarts, and code updates
- **Plan Required**: Starter plan or higher (for persistent disk support)

---

## 🔧 Configuration

### 1. Persistent Disk Setup

Defined in `render.yaml`:

```yaml
disk:
  name: getlostportal-uploads
  mountPath: /var/data
  sizeGB: 1
```

**What this means:**
- Render creates a 1GB persistent disk
- Mounts it at `/var/data` on the service
- All data in `/var/data` persists across redeploys
- The disk is **only available at runtime** (not during build)

### 2. Database Path

Set in `render.yaml`:

```yaml
envVars:
  - key: DATABASE_URL
    value: file:/var/data/db.sqlite
```

**Path Format:**
- `file:/var/data/db.sqlite` (with `file:` prefix)
- Or `/var/data/db.sqlite` (absolute path)
- The code handles both formats

---

## 🚀 Initialization Process

### Build Phase (Database NOT Available)

During `npm run build`:
1. Render runs the build command
2. `/var/data` disk is **NOT mounted** yet
3. Code detects missing `/var/data` directory
4. Falls back to temporary database: `./build-db.sqlite`
5. Build completes successfully

**Logs you'll see:**
```
[DB] Production directory /var/data not available (expected during build on Render)
[DB] Using temporary build database at ./build-db.sqlite
```

### Runtime Phase (Database Available)

When the service starts:

1. **Initialization Script Runs** (`scripts/render-init.sh`):
   ```bash
   # Verifies disk is mounted
   if [ ! -d "/var/data" ]; then
     echo "❌ ERROR: Persistent disk not mounted"
     exit 1
   fi
   
   # Creates directories
   mkdir -p /var/data/book-reports
   mkdir -p /var/data/reports
   mkdir -p /var/data/uploads
   mkdir -p /var/data/books
   mkdir -p /var/data/covers
   
   # Runs database migrations
   npm run db:migrate
   ```

2. **Database Connection** (`src/server/db/index.ts`):
   ```typescript
   // Detects production path
   if (dbPath.startsWith('/var/data')) {
     // Uses persistent disk
     sqlite = new Database('/var/data/db.sqlite');
     sqlite.pragma('journal_mode = WAL');
   }
   ```

3. **First Run**:
   - If database doesn't exist, it's created automatically
   - Migrations run via `render-init.sh`
   - Database is ready to use

4. **Subsequent Runs**:
   - Existing database is found and reused
   - Migrations are applied if needed
   - All data from previous deployments is preserved

---

## 💾 Persistence

### What Persists:
✅ **Database file** (`/var/data/db.sqlite`)
- All tables and data
- User accounts, sessions
- Books, reports, assets
- Purchases, features
- Everything in the database

✅ **Uploaded files** (stored in `/var/data/*`)
- Book files: `/var/data/books/`
- Cover images: `/var/data/covers/`
- Reports: `/var/data/reports/`
- Uploads: `/var/data/uploads/`

### What Doesn't Persist:
❌ **Build artifacts** (`.next/` directory)
- Rebuilt on every deploy

❌ **Node modules** (`node_modules/`)
- Reinstalled on every deploy

❌ **Temporary files** (outside `/var/data`)
- Cleared on redeploy

---

## 🔍 Database Features

### WAL Mode (Write-Ahead Logging)

The database uses WAL mode for better concurrency:

```typescript
sqlite.pragma('journal_mode = WAL');
```

**Benefits:**
- Multiple readers can access database simultaneously
- Writers don't block readers
- Better performance for web applications
- Prevents locking issues

### Automatic Migration

Migrations run automatically on startup via `render-init.sh`:

```bash
# Runs Drizzle migrations
node -e "
  const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
  const db = drizzle(new Database('/var/data/db.sqlite'));
  migrate(db, { migrationsFolder: './drizzle' });
"
```

**What happens:**
- Checks for pending migrations
- Applies them automatically
- Database schema stays up-to-date

---

## 📋 Database Structure

The database contains multiple tables:

### Core Tables:
- `getlostportal_user` / `user` - User accounts (Better Auth)
- `getlostportal_session` / `session` - User sessions
- `getlostportal_book` - Uploaded books
- `getlostportal_book_version` - Book file versions

### Feature Tables:
- `getlostportal_report` - Full reports
- `getlostportal_marketing_asset` - Marketing materials
- `getlostportal_book_cover` - Book covers
- `getlostportal_landing_page` - Landing pages
- `getlostportal_purchase` - Feature purchases

### Better Auth Tables:
- `user` - Better Auth users
- `session` - Better Auth sessions
- `account` - OAuth accounts
- `verification` - Email verification tokens

---

## 🛠️ Maintenance

### Checking Database Status

The initialization script provides database info:

```bash
# On Render, check service logs for:
📊 Existing database found: 2.5 MB
   Users (Better Auth): 5
   Total Users: 5, Books: 12
```

### Database Size

The database file grows as you add data:
- Initial size: ~50-100 KB (empty)
- With users and books: ~1-10 MB
- With reports/assets: Can grow larger

**Monitor disk usage** in Render dashboard:
- Go to service → Disks
- Check disk usage percentage
- Upgrade disk size if needed (1GB → 2GB, etc.)

### Backing Up Database

**Important**: Render disks can be lost if the service is deleted!

**Backup options:**

1. **Download via Render Shell**:
   ```bash
   # Access Render shell
   # Download database
   cp /var/data/db.sqlite ~/backup-$(date +%Y%m%d).sqlite
   ```

2. **API Endpoint** (if you create one):
   ```typescript
   // GET /api/admin/database/backup
   // Returns database file for download
   ```

3. **Automated Backups**:
   - Use Render's scheduled jobs
   - Or external backup service
   - Store backups in S3/cloud storage

---

## ⚠️ Important Limitations

### 1. Single Instance Only

**Services with persistent disks cannot scale horizontally:**
- ❌ Cannot run multiple instances
- ✅ Can scale vertically (upgrade plan)
- ✅ Can use read replicas (if you switch to PostgreSQL)

### 2. Disk Only Available at Runtime

**The `/var/data` disk is NOT available during:**
- Build phase
- Pre-deploy commands
- One-off jobs (unless they mount the disk)

**Solution**: Code handles this with fallback database during build.

### 3. Disk Size Limits

**Current configuration**: 1GB

**If you run out of space:**
1. Go to Render dashboard → Service → Disks
2. Click "Edit" on the disk
3. Increase size (1GB → 2GB, etc.)
4. Restart service

### 4. No Automatic Backups

**Render does NOT automatically backup persistent disks:**
- You must manually backup the database
- If service is deleted, disk data is lost
- Consider external backup solution

---

## 🔧 Troubleshooting

### Issue: "Database directory does not exist"

**Error:**
```
[DB] ERROR: Database directory does not exist: /var/data
```

**Solution:**
1. Check Render dashboard → Service → Disks
2. Verify disk is attached and mounted at `/var/data`
3. Restart the service
4. Check service logs for disk mount confirmation

### Issue: "Permission denied"

**Error:**
```
❌ ERROR: Cannot write to /var/data (permission denied)
```

**Solution:**
1. Verify disk mount path is exactly `/var/data`
2. Check disk permissions in Render dashboard
3. Restart the service

### Issue: Database not persisting

**Symptoms:**
- Data disappears after redeploy
- Database resets to empty

**Solution:**
1. Check `DATABASE_URL` is set to `file:/var/data/db.sqlite`
2. Verify logs show: `✅ Using persistent disk - data will persist across redeploys`
3. If you see: `⚠️ WARNING: Not using persistent disk path!` → Fix `DATABASE_URL`

### Issue: Build fails with database error

**Error:**
```
[DB] Production directory /var/data not available
```

**Status**: ✅ **This is expected!**

**Explanation:**
- During build, `/var/data` is not available
- Code automatically uses fallback database
- Build should complete successfully
- Runtime will use the real database

---

## 📊 Monitoring

### Check Database Health

**In Render logs, look for:**
```
[DB] ✅ Using persistent disk - data will persist across redeploys
[DB] Database verified: 25 table(s) found
[DB] Using persistent disk database (2048 KB)
```

### Check Disk Usage

**In Render dashboard:**
1. Go to your service
2. Click "Disks" in sidebar
3. View disk usage percentage
4. Upgrade if approaching limit

### Check Database Size

**Via initialization script logs:**
```
📊 Existing database found: 2.5 MB
   Users (Better Auth): 5
   Total Users: 5, Books: 12
```

---

## 🎯 Summary

### How It Works:
1. **Persistent disk** mounted at `/var/data` (1GB)
2. **Database file** stored at `/var/data/db.sqlite`
3. **Initialization script** sets up directories and runs migrations
4. **Database connection** automatically detects and uses persistent disk
5. **Data persists** across redeploys, restarts, and code updates

### Key Points:
- ✅ Data persists on persistent disk
- ✅ Automatic migrations on startup
- ✅ WAL mode for better performance
- ⚠️ Single instance only (no horizontal scaling)
- ⚠️ Manual backups required
- ⚠️ Disk only available at runtime (not during build)

### Best Practices:
1. **Monitor disk usage** regularly
2. **Backup database** periodically
3. **Upgrade disk size** before running out of space
4. **Check logs** for database health messages
5. **Verify disk mount** if issues occur

---

## 📚 Related Files

- `render.yaml` - Disk and environment configuration
- `scripts/render-init.sh` - Initialization script
- `src/server/db/index.ts` - Database connection logic
- `drizzle.config.ts` - Migration configuration
- `src/server/db/schema.ts` - Database schema

