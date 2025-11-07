# 🚀 Render Deployment - Quick Start

## ✅ Step 1: Code is Ready!

Your code has been pushed to GitHub. Now let's deploy to Render!

---

## 📋 Step 2: Create Render Service

### Option A: Using render.yaml (Easiest)

1. **Go to [render.com](https://render.com)** and sign up/login
2. Click **"New +"** → **"Blueprint"** (or **"Web Service"**)
3. Connect your GitHub account if not already connected
4. Select repository: **`trusteero/getlost-portal`**
5. Render will detect `render.yaml` and auto-configure everything!
6. Click **"Apply"**

### Option B: Manual Setup

1. Go to [render.com](https://render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub → Select `getlostportal` repository
4. Configure:
   - **Name**: `getlostportal`
   - **Region**: `Oregon` (or your preference)
   - **Branch**: `develop`
   - **Runtime**: `Node`
   - **Build Command**: `chmod +x scripts/render-build.sh && ./scripts/render-build.sh`
   - **Start Command**: `npm run start`

---

## 🔧 Step 3: Add Environment Variables

Go to **Environment** tab and add:

### Required Variables:

```bash
# Database (already set, but verify)
DATABASE_URL=file:/var/data/db.sqlite

# Google OAuth (REQUIRED - get from Google Cloud Console)
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret

# Admin (REQUIRED - your email)
SUPER_ADMIN_EMAILS=your-email@example.com
NEXT_PUBLIC_SUPER_ADMIN_EMAILS=your-email@example.com
```

### Optional Variables (if you have them):

```bash
# BookDigest API (for book processing)
BOOKDIGEST_API_KEY=your-key

# Email Service (MailerSend)
MAILERSEND_API_KEY=your-key
MAILERSEND_FROM_EMAIL=noreply@yourdomain.com
```

### Already Auto-Configured:

These are set automatically by `render.yaml`:
- ✅ `NODE_ENV=production`
- ✅ `AUTH_SECRET` (auto-generated)
- ✅ `BETTER_AUTH_URL` (your Render URL)
- ✅ `NEXT_PUBLIC_APP_URL` (your Render URL)
- ✅ File storage paths (`/var/data/...`)

---

## 💾 Step 4: Add Persistent Disk

1. Go to **"Disks"** section in Render dashboard
2. Click **"Add Disk"**
3. Configure:
   - **Name**: `getlostportal-uploads`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (or more if needed)
4. Click **"Add Disk"**

---

## 🔐 Step 5: Update Google OAuth

**CRITICAL**: Add Render URL to Google OAuth:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. **APIs & Services** → **Credentials**
3. Click your OAuth 2.0 Client ID
4. Under **"Authorized redirect URIs"**, add:
   ```
   https://getlostportal.onrender.com/api/auth/callback/google
   ```
   (Replace `getlostportal` with your actual service name)
5. Click **"Save"**

---

## 🚀 Step 6: Deploy!

1. Click **"Create Web Service"** (or **"Save Changes"** if editing)
2. Render will start building (5-10 minutes)
3. Watch the **Logs** tab for progress
4. Once deployed, your app will be live!

---

## ✅ Step 7: Verify Deployment

1. Visit your Render URL: `https://getlostportal.onrender.com`
2. Test signup/login
3. Test Google OAuth
4. Test file upload (if configured)

---

## 🐛 Common Issues & Fixes

### Build Fails
- Check logs for missing env vars
- Ensure `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set
- Verify Node.js version (should be 20+)

### Database Error
- Verify disk is mounted at `/var/data`
- Check `DATABASE_URL=file:/var/data/db.sqlite`

### OAuth Error
- Add Render URL to Google OAuth redirect URIs
- Format: `https://your-app.onrender.com/api/auth/callback/google`

---

## 📞 Need Help?

Check the logs in Render dashboard for specific errors. Most issues are:
1. Missing environment variables
2. OAuth redirect URI mismatch
3. Disk not mounted properly

Your app is ready to deploy! 🎉

