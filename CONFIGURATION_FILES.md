# Configuration Files: Local vs Render

This document outlines all configuration files that differentiate between local development and Render deployment.

---

## 📋 Primary Configuration Files

### 1. **`render.yaml`** - Render Deployment Configuration
**Location**: `/render.yaml`

**Purpose**: Defines Render-specific settings, environment variables, and build/start commands.

**Key Differences**:
- Sets `DATABASE_URL=file:/var/data/db.sqlite` (Render persistent disk)
- Auto-configures `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` from service URL
- Defines persistent disk mount at `/var/data`
- Sets file storage paths to `/var/data/*`
- Configures build and start commands with initialization scripts

**Local Equivalent**: `.env` file (not in git)

---

### 2. **`.env`** - Local Development Environment
**Location**: `/` (root, not committed to git)

**Purpose**: Contains local development environment variables.

**Key Differences**:
- `DATABASE_URL=file:./dev.db` (local relative path)
- `BETTER_AUTH_URL=http://localhost:3000`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- File storage paths use relative paths: `./uploads/*`

**Render Equivalent**: Environment variables set in Render dashboard (or `render.yaml`)

---

### 3. **`src/env.js`** - Environment Variable Schema
**Location**: `/src/env.js`

**Purpose**: Validates and provides type-safe access to environment variables using `@t3-oss/env-nextjs`.

**Key Features**:
- Defines which environment variables are required/optional
- Provides defaults (e.g., `DATABASE_URL` defaults to `file:./build-db.sqlite` for build phase)
- Validates environment variables at build time
- Works for both local and Render (reads from `process.env`)

**No Local/Render Differences**: Same file works for both environments

---

### 4. **`src/server/db/index.ts`** - Database Connection Logic
**Location**: `/src/server/db/index.ts`

**Purpose**: Handles database connection with automatic environment detection.

**Key Detection Logic**:
```typescript
// Detects build phase
const isBuildPhase = process.argv.includes('build') ||
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.RENDER === 'true';

// Detects production paths
if (dbPath.startsWith('/var/') || dbPath.startsWith('/mnt/')) {
  // Render production path
}

// Falls back to build database if /var/data not available during build
if (!dirExists && isBuildPhase) {
  dbFallbackPath = './build-db.sqlite';
}
```

**Local Behavior**:
- Uses `./dev.db` from `DATABASE_URL`
- Creates database if it doesn't exist
- Caches connection in development

**Render Behavior**:
- Uses `/var/data/db.sqlite` from `DATABASE_URL`
- Falls back to `./build-db.sqlite` during build phase (when `/var/data` not available)
- Verifies persistent disk is mounted at runtime
- Warns if not using persistent disk path

---

### 5. **`drizzle.config.ts`** - Database Migration Configuration
**Location**: `/drizzle.config.ts`

**Purpose**: Configures Drizzle ORM for migrations and schema management.

**Key Features**:
- Reads `DATABASE_URL` from `env.js`
- Works with both local (`./dev.db`) and Render (`/var/data/db.sqlite`) paths
- Filters tables to `getlostportal_*` prefix

**No Local/Render Differences**: Uses `DATABASE_URL` environment variable

---

### 6. **`next.config.js`** - Next.js Configuration
**Location**: `/next.config.js`

**Purpose**: Next.js build and runtime configuration.

**Key Features**:
- Configures webpack externals for `better-auth` and `better-sqlite3`
- Sets up rewrites for precanned content (`/uploads/precanned/*` → `/api/uploads/precanned/*`)
- This rewrite ensures files work on Render where static files may not be accessible

**No Local/Render Differences**: Same configuration works for both

---

### 7. **`scripts/render-build.sh`** - Render Build Script
**Location**: `/scripts/render-build.sh`

**Purpose**: Custom build script for Render deployment.

**Key Features**:
- Installs dependencies with `npm ci`
- Generates database migrations (but skips running them during build)
- Builds Next.js application
- **Only used on Render** (called by `render.yaml`)

**Local Equivalent**: `npm run build` (standard Next.js build)

---

### 8. **`scripts/render-init.sh`** - Render Initialization Script
**Location**: `/scripts/render-init.sh`

**Purpose**: Runtime initialization for Render deployment.

**Key Features**:
- Verifies persistent disk is mounted at `/var/data`
- Creates necessary directories on persistent disk
- Copies book-reports from repo to persistent disk (if present)
- Runs database migrations
- **Only used on Render** (called by `render.yaml` startCommand)

**Local Equivalent**: Database migrations run automatically on first connection

---

## 🔧 Environment Variable Detection

The application uses environment variables to automatically detect the environment:

### Database Path Detection
```typescript
// In src/server/db/index.ts
let dbPath = env.DATABASE_URL;

// Local: file:./dev.db → ./dev.db
// Render: file:/var/data/db.sqlite → /var/data/db.sqlite
```

### File Storage Path Detection
```typescript
// Throughout the codebase
const bookStoragePath = process.env.BOOK_STORAGE_PATH || './uploads/books';
const coverStoragePath = process.env.COVER_STORAGE_PATH || path.join(process.cwd(), 'uploads', 'covers');
const reportStoragePath = process.env.REPORT_STORAGE_PATH || './uploads/reports';

// Local: Uses defaults (relative paths)
// Render: Uses /var/data/* (set in render.yaml)
```

### Build Phase Detection
```typescript
// In src/server/db/index.ts
const isBuildPhase = 
  process.argv.includes('build') ||
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.RENDER === 'true';
```

---

## 📊 Configuration Comparison

| Setting | Local | Render |
|---------|-------|--------|
| **Database Path** | `./dev.db` | `/var/data/db.sqlite` |
| **Database Source** | `.env` file | `render.yaml` + Dashboard |
| **File Storage** | `./uploads/*` | `/var/data/*` |
| **Base URL** | `http://localhost:3000` | `https://your-app.onrender.com` |
| **Build Command** | `npm run build` | `scripts/render-build.sh` |
| **Start Command** | `npm run dev` | `scripts/render-init.sh && npm run start` |
| **Migrations** | Auto on first connection | Run in `render-init.sh` |
| **Persistent Disk** | N/A | `/var/data` (1GB) |

---

## 🎯 Key Takeaways

1. **No Code Changes Needed**: The same codebase works for both environments
2. **Environment Variables**: Only difference is environment variable values
3. **Automatic Detection**: Code automatically detects environment based on:
   - `DATABASE_URL` path (`./` vs `/var/data/`)
   - `NODE_ENV` and build phase flags
   - File path prefixes
4. **Build Phase Handling**: Special logic handles Render's build phase where `/var/data` isn't available yet
5. **Initialization Scripts**: Render uses custom scripts to set up persistent disk and run migrations

---

## 📝 Files Summary

### Used by Both Environments:
- ✅ `src/env.js` - Environment variable validation
- ✅ `drizzle.config.ts` - Database migration config
- ✅ `next.config.js` - Next.js configuration
- ✅ `src/server/db/index.ts` - Database connection (auto-detects environment)

### Local Only:
- ✅ `.env` - Local environment variables (not in git)

### Render Only:
- ✅ `render.yaml` - Render deployment configuration
- ✅ `scripts/render-build.sh` - Render build script
- ✅ `scripts/render-init.sh` - Render initialization script

---

## 🔍 How to Check Current Environment

The application logs environment information:

```typescript
// Database connection logs
console.log('[DB] Database URL from env:', env.DATABASE_URL);
console.log('[DB] Resolved database path:', dbPath);
console.log('[DB] ✅ Using persistent disk - data will persist across redeploys');
// or
console.log('[DB] ⚠️  WARNING: Not using persistent disk path!');
```

Check your application logs to see which environment is detected.

