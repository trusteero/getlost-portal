# Deployment Guide for GetLostPortal

This guide covers multiple hosting options for your Next.js application.

## 🚀 Quick Start - Recommended Options

### Option 1: Render.com (Already Configured) ⭐
**Best for**: SQLite with persistent storage, file uploads

Your app already has Render configuration files (`render.yaml`). This is the easiest option.

**Steps:**
1. Push your code to GitHub
2. Sign up at [render.com](https://render.com)
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Render will auto-detect `render.yaml` and configure everything
6. Add environment variables (see below)
7. Deploy!

**Pros:**
- ✅ Persistent disk for SQLite and file storage
- ✅ Already configured with `render.yaml`
- ✅ Free tier available
- ✅ Easy file uploads

**Cons:**
- ❌ Can't scale to multiple instances with disk storage
- ❌ Free tier spins down after inactivity

---

### Option 2: Vercel (Best for Next.js) ⭐⭐⭐
**Best for**: Production-ready, auto-scaling, edge functions

**Steps:**
1. Push code to GitHub
2. Sign up at [vercel.com](https://vercel.com)
3. Click "New Project" → Import your repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
5. Add environment variables
6. Deploy!

**Important for Vercel:**
- Use **Turso** or **PlanetScale** for database (SQLite won't work on Vercel)
- Use **S3** or **Cloudinary** for file storage (no local file system)
- Update `DATABASE_URL` to use external database

**Pros:**
- ✅ Optimized for Next.js
- ✅ Auto-scaling
- ✅ Edge functions
- ✅ Free tier with good limits
- ✅ Custom domains included

**Cons:**
- ❌ No persistent file storage (need S3/Cloudinary)
- ❌ Can't use SQLite (need external database)

---

### Option 3: Railway
**Best for**: Simple deployment, PostgreSQL included

**Steps:**
1. Sign up at [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway auto-detects Next.js
5. Add PostgreSQL database (one-click)
6. Add environment variables
7. Deploy!

**Pros:**
- ✅ PostgreSQL database included
- ✅ Persistent storage available
- ✅ Simple setup
- ✅ Good free tier

**Cons:**
- ❌ Need to migrate from SQLite to PostgreSQL

---

## 📋 Required Environment Variables

### Core Configuration

```bash
# Database (choose one)
DATABASE_URL=file:/var/data/db.sqlite  # For Render with disk
# OR
DATABASE_URL=libsql://your-turso-url  # For Turso
# OR
DATABASE_URL=postgresql://...  # For PostgreSQL

# Authentication
AUTH_SECRET=generate-a-random-secret-here
BETTER_AUTH_URL=https://your-app-domain.com
NEXT_PUBLIC_APP_URL=https://your-app-domain.com

# Google OAuth
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret

# Email (MailerSend)
MAILERSEND_API_KEY=your-mailersend-api-key
MAILERSEND_FROM_EMAIL=noreply@yourdomain.com

# Admin
SUPER_ADMIN_EMAILS=admin@example.com,another@example.com
NEXT_PUBLIC_SUPER_ADMIN_EMAILS=admin@example.com,another@example.com

# BookDigest Service
BOOKDIGEST_URL=https://bookdigest.onrender.com
BOOKDIGEST_API_KEY=your-bookdigest-api-key

# File Storage (for Render with disk)
BOOK_STORAGE_PATH=/var/data/books
COVER_STORAGE_PATH=/var/data/covers
REPORT_STORAGE_PATH=/var/data/reports
UPLOAD_DIR=/var/data/uploads

# Public
NEXT_PUBLIC_SUPPORTED_FORMATS=.docx,.pdf,.epub
NODE_ENV=production
```

---

## 🔧 Platform-Specific Setup

### Render.com Setup

1. **Create Web Service**
   - Connect GitHub repo
   - Render auto-detects `render.yaml`

2. **Add Persistent Disk** (for SQLite)
   - Go to "Disks" section
   - Add disk:
     - Name: `getlostportal-data`
     - Mount Path: `/var/data`
     - Size: 1 GB

3. **Environment Variables**
   - Add all variables from the list above
   - Set `DATABASE_URL=file:/var/data/db.sqlite`

4. **Deploy**
   - Render will build and deploy automatically
   - Check logs for any errors

### Vercel Setup

1. **Database Setup** (Required - SQLite won't work)
   
   **Option A: Turso (Recommended)**
   ```bash
   # Install Turso CLI
   npm i -g @libsql/client
   
   # Create database
   turso db create getlostportal
   
   # Get connection string
   turso db show getlostportal
   ```
   Set `DATABASE_URL` to the Turso connection string

   **Option B: PlanetScale**
   - Sign up at planetscale.com
   - Create database
   - Get connection string
   - Set `DATABASE_URL`

2. **File Storage Setup** (Required - no local storage)
   
   **Option A: AWS S3**
   ```bash
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-bucket-name
   ```
   
   **Option B: Cloudinary**
   ```bash
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-key
   CLOUDINARY_API_SECRET=your-secret
   ```

3. **Deploy**
   - Vercel auto-detects Next.js
   - Add environment variables
   - Deploy!

### Railway Setup

1. **Add PostgreSQL Database**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway provides connection string automatically

2. **Update Database Schema**
   - You'll need to migrate from SQLite to PostgreSQL
   - Update `drizzle.config.ts` to use PostgreSQL
   - Run migrations: `npm run db:push`

3. **Environment Variables**
   - Railway auto-injects `DATABASE_URL` from PostgreSQL
   - Add other variables manually

4. **Deploy**
   - Railway auto-detects and deploys

---

## 🔄 Database Migration (SQLite → PostgreSQL/Turso)

If moving from SQLite to PostgreSQL or Turso:

1. **Export SQLite data** (if you have existing data):
   ```bash
   sqlite3 dev.db .dump > backup.sql
   ```

2. **Update `drizzle.config.ts`**:
   ```typescript
   export default {
     schema: "./src/server/db/schema.ts",
     dialect: "postgresql", // or "turso" for Turso
     dbCredentials: {
       url: env.DATABASE_URL,
     },
   } satisfies Config;
   ```

3. **Run migrations**:
   ```bash
   npm run db:push
   ```

---

## 📁 File Storage Options

### Option 1: Local Storage (Render only)
- Use persistent disk at `/var/data`
- Simple but doesn't scale

### Option 2: AWS S3
- Scalable, reliable
- Need to update upload code to use S3 SDK

### Option 3: Cloudinary
- Great for images
- Easy integration
- Free tier available

### Option 4: Supabase Storage
- Free tier available
- Easy integration with Supabase

---

## 🔐 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - `https://your-domain.com/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (for local dev)
4. Copy Client ID and Secret to environment variables

---

## 📧 Email Setup (MailerSend)

1. Sign up at [MailerSend](https://www.mailersend.com)
2. Verify your domain
3. Create API token
4. Add to environment variables:
   - `MAILERSEND_API_KEY`
   - `MAILERSEND_FROM_EMAIL` (must be verified domain)

---

## ✅ Post-Deployment Checklist

- [ ] Database is accessible and migrations ran
- [ ] Google OAuth redirect URI matches your domain
- [ ] Email service configured and tested
- [ ] File uploads working (if using local storage)
- [ ] Admin users can log in
- [ ] Book upload and processing works
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active (usually automatic)

---

## 🐛 Troubleshooting

### Database Connection Errors
- Verify `DATABASE_URL` is correct
- Check database is accessible from hosting provider
- For Turso: verify auth token is valid

### OAuth Not Working
- Check redirect URI matches exactly
- Verify Google OAuth credentials
- Check `BETTER_AUTH_URL` matches your domain

### File Upload Issues
- Verify storage path exists and is writable
- Check file size limits
- For Vercel: must use external storage (S3/Cloudinary)

### Build Failures
- Check Node.js version (should be 20+)
- Verify all dependencies are in `package.json`
- Check build logs for specific errors

---

## 💰 Cost Comparison

| Platform | Free Tier | Paid Starts At | Best For |
|----------|-----------|----------------|----------|
| **Render** | ✅ Yes (spins down) | $7/month | SQLite + files |
| **Vercel** | ✅ Yes (generous) | $20/month | Production Next.js |
| **Railway** | ✅ Yes ($5 credit) | $5/month | Simple deployment |
| **Fly.io** | ✅ Yes | $1.94/month | Global edge |
| **DigitalOcean** | ❌ No | $6/month | Full control |

---

## 🎯 Recommended Setup by Use Case

**For Development/Testing:**
- Render.com (free tier, easy setup)

**For Production:**
- Vercel + Turso + S3 (scalable, optimized)

**For Simple Production:**
- Railway + PostgreSQL (all-in-one)

**For Budget-Conscious:**
- Render.com paid tier ($7/month)

---

## 📚 Additional Resources

- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)

---

## 🆘 Need Help?

If you encounter issues:
1. Check the platform's logs
2. Verify all environment variables are set
3. Test database connection separately
4. Check OAuth redirect URIs match exactly

