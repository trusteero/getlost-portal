# Render.com Deployment Guide

## ✅ Database Issue Fixed!

The database connection issue has been resolved. The problem was that Render's persistent disks are **only available at runtime**, not during the build phase.

### What was happening:
1. **Build Phase**: Next.js tries to pre-compile API routes
2. **Problem**: The `/var/data` disk is NOT mounted during build
3. **Error**: Database directory `/var/data` doesn't exist

### The Solution:
- During **build**: Use a temporary database (`./build-db.sqlite`)
- During **runtime**: Use the actual database at `/var/data/db.sqlite`
- The code now automatically detects when `/var/data` is unavailable and falls back appropriately

## 📋 Deployment Steps

### 1. Environment Variables on Render

Make sure these are set in your Render service:

```env
# Database (with leading slash!)
DATABASE_URL=/var/data/db.sqlite

# Or with file:// prefix (also works)
DATABASE_URL=file:/var/data/db.sqlite

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email settings
EMAIL_FROM=noreply@yourdomain.com
EMAIL_SERVER_USER=your-email-user
EMAIL_SERVER_PASSWORD=your-email-password
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
RESEND_API_KEY=your-resend-api-key

# Admin emails
SUPER_ADMIN_EMAILS=admin@example.com

# NextAuth (still needed on deploy branch)
NEXTAUTH_URL=https://getlostportal.onrender.com
NEXTAUTH_SECRET=your-secret-here
```

### 2. Persistent Disk Setup

In Render Dashboard:
1. Go to your web service
2. Click "Disks" in the left sidebar
3. Add a disk with:
   - **Name**: `data`
   - **Mount Path**: `/var/data`
   - **Size**: 1GB (or more as needed)

### 3. Build & Start Commands

In Render service settings:

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm run start
```

### 4. First Deployment

After deploying:

1. **Initialize the database** (first time only):
   - The database will be automatically created at `/var/data/db.sqlite` on first run
   - Run migrations if needed: Access your service shell and run `npm run db:migrate`

2. **Test the disk** (optional):
   - Visit: `https://your-app.onrender.com/api/test-disk`
   - This will show if `/var/data` is properly mounted

## 🔍 Debugging

### Check Database Connection
Look for these logs in Render:

**During Build** (expected):
```
[DB] Production directory /var/data not available (expected during build on Render)
[DB] Using temporary build database at ./build-db.sqlite
```

**During Runtime** (should work):
```
[DB] Successfully connected to database at: /var/data/db.sqlite
```

### Common Issues

1. **"Database directory does not exist" at runtime**
   - The disk is not properly mounted
   - Check disk configuration in Render

2. **"Permission denied" errors**
   - The disk mount path permissions issue
   - Ensure mount path is `/var/data` exactly

3. **Database file not persisting**
   - Make sure DATABASE_URL starts with `/var/data/`
   - Don't use relative paths like `./db.sqlite` in production

## 📝 Important Notes

1. **Disk is runtime-only**: The `/var/data` disk is NOT available during:
   - Build command
   - Pre-deploy command
   - One-off jobs

2. **Single instance only**: Services with disks cannot scale to multiple instances

3. **Backup regularly**: Download your database periodically as Render disks can be lost if the service is deleted

## 🚀 Deploy Now!

With these changes, your deployment should work correctly:

```bash
git push origin deploy
```

The build will use a temporary database, and at runtime it will connect to the persistent disk at `/var/data/db.sqlite`.