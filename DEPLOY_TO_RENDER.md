# 🚀 Deploy to Render - Step by Step

## ✅ Prerequisites

- [x] Code is in your GitHub repository: `trusteero/getlost-portal`
- [x] `render.yaml` is configured
- [x] Build script exists: `scripts/render-build.sh`

---

## 📋 Step 1: Push Code to GitHub

Make sure your latest code is pushed:

```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin develop
```

---

## 📋 Step 2: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up/login (use GitHub for easiest setup)
3. Authorize Render to access your repositories

---

## 📋 Step 3: Create Web Service

### Option A: Using Blueprint (Easiest - Recommended)

1. Click **"New +"** → **"Blueprint"**
2. Connect GitHub if not already connected
3. Select repository: **`trusteero/getlost-portal`**
4. Render will detect `render.yaml` and auto-configure everything!
5. Click **"Apply"**

### Option B: Manual Setup

1. Click **"New +"** → **"Web Service"**
2. Connect GitHub → Select `trusteero/getlost-portal`
3. Configure:
   - **Name**: `getlostportal`
   - **Region**: `Oregon` (or your preference)
   - **Branch**: `develop`
   - **Runtime**: `Node`
   - **Build Command**: `chmod +x scripts/render-build.sh && ./scripts/render-build.sh`
   - **Start Command**: `npm run start`

---

## 📋 Step 4: Add Environment Variables

Go to **Environment** tab in Render dashboard and add:

### Required Variables:

```bash
# Google OAuth (get from Google Cloud Console)
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret

# Admin emails (your email address)
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

# AI Services (if using)
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
```

### Already Auto-Configured by render.yaml:

- ✅ `NODE_ENV=production`
- ✅ `DATABASE_URL=file:/var/data/db.sqlite`
- ✅ `AUTH_SECRET` (auto-generated)
- ✅ `BETTER_AUTH_URL` (your Render URL)
- ✅ `NEXT_PUBLIC_APP_URL` (your Render URL)
- ✅ `REPORT_STORAGE_PATH=/var/data/reports`
- ✅ `UPLOAD_DIR=/var/data/uploads`

---

## 📋 Step 5: Verify Persistent Disk

The `render.yaml` should auto-create the disk, but verify:

1. Go to **"Disks"** section in Render dashboard
2. Verify disk exists:
   - **Name**: `getlostportal-uploads`
   - **Mount Path**: `/var/data`
   - **Size**: 1 GB

If not created automatically:
- Click **"Add Disk"**
- Name: `getlostportal-uploads`
- Mount Path: `/var/data`
- Size: 1 GB

---

## 📋 Step 6: Update Google OAuth Redirect URI

**CRITICAL**: Add your Render URL to Google OAuth:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. **APIs & Services** → **Credentials**
3. Click your OAuth 2.0 Client ID
4. Under **"Authorized redirect URIs"**, add:
   ```
   https://getlostportal.onrender.com/api/auth/callback/google
   ```
   (Replace `getlostportal` with your actual Render service name)
5. Click **"Save"**

---

## 📋 Step 7: Deploy!

1. Click **"Create Web Service"** (or **"Save Changes"** if editing)
2. Render will start building (takes 5-10 minutes)
3. Watch the **Logs** tab for progress
4. Once deployed, your app will be live at: `https://getlostportal.onrender.com`

---

## ✅ Step 8: Verify Deployment

1. Visit your Render URL: `https://getlostportal.onrender.com`
2. Test signup/login
3. Test Google OAuth
4. Test file upload (if configured)
5. Check logs for any errors

---

## 🐛 Troubleshooting

### Build Fails

**Check logs for:**
- Missing environment variables
- TypeScript errors
- Missing dependencies

**Common fixes:**
- Ensure `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set
- Verify Node.js version (should be 20+)
- Check `render.yaml` syntax

### Database Error

**Error**: "Database directory does not exist"

**Fix:**
- Verify disk is mounted at `/var/data`
- Check `DATABASE_URL=file:/var/data/db.sqlite` is set
- Ensure disk exists in Render dashboard

### OAuth Not Working

**Error**: "Redirect URI mismatch"

**Fix:**
- Add Render URL to Google OAuth authorized redirect URIs
- Format: `https://your-app.onrender.com/api/auth/callback/google`
- Make sure it matches exactly (including `https://`)

### File Upload Issues

**Error**: "Permission denied" or files not saving

**Fix:**
- Verify disk is mounted at `/var/data`
- Check file size limits in Render settings
- Ensure `UPLOAD_DIR=/var/data/uploads` is set

---

## 📝 Quick Checklist

Before deploying:
- [ ] Code pushed to GitHub (`trusteero/getlost-portal`)
- [ ] `render.yaml` is in repository
- [ ] Google OAuth credentials ready
- [ ] Admin email address ready
- [ ] Optional: BookDigest API key
- [ ] Optional: MailerSend API key

After deploying:
- [ ] Build succeeded
- [ ] App loads at Render URL
- [ ] Can sign up/login
- [ ] Google OAuth works
- [ ] File uploads work
- [ ] Database persists (check after restart)

---

## 🚀 Ready to Deploy?

Run these commands:

```bash
# Make sure everything is committed
git add .
git commit -m "Prepare for Render deployment"
git push origin develop
```

Then follow steps 2-7 above!

Your app will be live at: `https://getlostportal.onrender.com` 🎉

