# Render Deployment Checklist

## Step-by-Step Deployment Guide

### 1. Commit and Push Your Changes

First, commit all the Better Auth migration changes:

```bash
# Add all changes
git add .

# Commit
git commit -m "Migrate to Better Auth and prepare for Render deployment"

# Push to GitHub
git push origin develop
```

### 2. Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub (easiest way)
3. Authorize Render to access your repositories

### 3. Create Web Service on Render

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub account if not already connected
3. Select repository: **`Nixarn/getlostportal`**
4. Select branch: **`develop`** (or `main` if you prefer)
5. Click **"Connect"**

### 4. Render Auto-Configuration

Render will detect `render.yaml` and auto-configure:
- ✅ Service name: `getlostportal`
- ✅ Build command: `chmod +x scripts/render-build.sh && ./scripts/render-build.sh`
- ✅ Start command: `npm run start`
- ✅ Persistent disk at `/var/data`
- ✅ Some environment variables

### 5. Add Required Environment Variables

Go to **Environment** tab and add these variables:

#### Required (Must Set):

```bash
# Database (already set by render.yaml, but verify)
DATABASE_URL=file:/var/data/db.sqlite

# Google OAuth (get from Google Cloud Console)
AUTH_GOOGLE_ID=your-google-client-id-here
AUTH_GOOGLE_SECRET=your-google-client-secret-here

# Admin emails (comma-separated)
SUPER_ADMIN_EMAILS=your-email@example.com
NEXT_PUBLIC_SUPER_ADMIN_EMAILS=your-email@example.com
```

#### Optional (Set if you have them):

```bash
# BookDigest Service (for book processing)
BOOKDIGEST_API_KEY=your-bookdigest-api-key

# Email Service (Resend)
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@yourdomain.com  # or onboarding@resend.dev for testing

# AI Services (if using)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

#### Already Auto-Configured by render.yaml:

- ✅ `NODE_ENV=production`
- ✅ `AUTH_SECRET` (auto-generated)
- ✅ `BETTER_AUTH_URL` (auto-set to your Render URL)
- ✅ `NEXT_PUBLIC_APP_URL` (auto-set to your Render URL)
- ✅ `BOOK_STORAGE_PATH=/var/data/books`
- ✅ `COVER_STORAGE_PATH=/var/data/covers`
- ✅ `REPORT_STORAGE_PATH=/var/data/reports`
- ✅ `UPLOAD_DIR=/var/data/uploads`

### 6. Verify Persistent Disk

1. Go to **Disks** section in Render dashboard
2. Verify disk is created:
   - **Name**: `getlostportal-uploads`
   - **Mount Path**: `/var/data`
   - **Size**: 1 GB

If not created automatically, add it manually:
- Click **"Add Disk"**
- Name: `getlostportal-uploads`
- Mount Path: `/var/data`
- Size: 1 GB

### 7. Update Google OAuth Redirect URI

**Important**: Add your Render URL to Google OAuth:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Click your OAuth 2.0 Client ID
4. Add to **Authorized redirect URIs**:
   ```
   https://your-app-name.onrender.com/api/auth/callback/google
   ```
   (Replace `your-app-name` with your actual Render service name)

### 8. Deploy!

1. Click **"Create Web Service"** or **"Save Changes"**
2. Render will start building (takes 5-10 minutes)
3. Watch the build logs for any errors
4. Once deployed, your app will be at: `https://your-app-name.onrender.com`

### 9. Post-Deployment

1. **Test the app**: Visit your Render URL
2. **Test signup/login**: Try creating an account
3. **Test file upload**: Upload a book
4. **Check logs**: Monitor for any errors

### 10. First-Time Database Setup

The database will be created automatically on first request. If you need to run migrations manually:

1. Go to Render dashboard → Your service
2. Click **"Shell"** tab
3. Run:
   ```bash
   npm run db:push
   ```

---

## 🐛 Troubleshooting

### Build Fails

**Check build logs** for:
- Missing dependencies
- TypeScript errors
- Environment variable validation errors

**Common fixes**:
- Ensure all required env vars are set
- Check Node.js version compatibility
- Verify `render.yaml` syntax

### Database Errors

**Error**: "Database directory does not exist"
- **Fix**: Verify persistent disk is mounted at `/var/data`
- Check disk configuration in Render dashboard

### OAuth Not Working

**Error**: "Redirect URI mismatch"
- **Fix**: Add Render URL to Google OAuth authorized redirect URIs
- Format: `https://your-app.onrender.com/api/auth/callback/google`

### File Upload Issues

**Error**: "Permission denied" or files not saving
- **Fix**: Verify disk is mounted and paths use `/var/data/`
- Check file size limits in Render settings

---

## ✅ Quick Checklist

Before deploying:
- [ ] Code pushed to GitHub
- [ ] `render.yaml` is correct
- [ ] Google OAuth credentials ready
- [ ] Admin email address ready
- [ ] Optional: BookDigest API key
- [ ] Optional: Resend API key

After deploying:
- [ ] Build succeeded
- [ ] App loads at Render URL
- [ ] Can sign up/login
- [ ] Google OAuth works
- [ ] File uploads work
- [ ] Database persists (check after restart)

---

## 🚀 Ready to Deploy?

Run these commands to commit and push:

```bash
git add .
git commit -m "Prepare for Render deployment with Better Auth"
git push origin develop
```

Then follow steps 2-8 above!

