# Render.com Deployment Guide for GetLostPortal

## Prerequisites

1. A Render.com account
2. A GitHub repository with your code
3. Required API keys and credentials

## Deployment Steps

### 1. Connect GitHub Repository

1. Log into Render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub account if not already connected
4. Select your `getlostportal` repository
5. Click "Connect"

### 2. Configure Service Settings

The `render.yaml` file will automatically configure most settings, but verify:

- **Name**: getlostportal
- **Region**: Oregon (or your preferred region)
- **Branch**: main (or your default branch)
- **Runtime**: Node
- **Build Command**: `chmod +x scripts/render-build.sh && ./scripts/render-build.sh`
- **Start Command**: `npm run start`

### 3. Environment Variables

In the Render dashboard, add the following environment variables:

#### Database Configuration

Choose one of these options:

**Option A: Using Turso (Recommended for production)**
- `DATABASE_URL`: Your Turso database URL (libsql://...)
- `TURSO_DATABASE_URL`: Same as DATABASE_URL
- `TURSO_AUTH_TOKEN`: Your Turso auth token

**Option B: Using SQLite with Persistent Disk**
- `DATABASE_URL`: file:/var/data/db.sqlite

#### Authentication
- `AUTH_SECRET`: Click "Generate" for a random value
- `NEXTAUTH_SECRET`: Same as AUTH_SECRET
- `NEXTAUTH_URL`: Will be auto-populated with your Render URL

#### Google OAuth
- `AUTH_GOOGLE_ID`: Your Google OAuth client ID
- `AUTH_GOOGLE_SECRET`: Your Google OAuth client secret

#### Email Configuration
- `RESEND_API_KEY`: Your Resend API key
- `RESEND_FROM_EMAIL`: Verified sender email (e.g., noreply@yourdomain.com) or onboarding@resend.dev for testing

#### Admin Configuration
- `ADMIN_EMAILS`: Comma-separated admin emails (e.g., admin@example.com)

#### BookDigest Service
- `BOOKDIGEST_URL`: https://bookdigest.onrender.com
- `BOOKDIGEST_API_KEY`: Your BookDigest API key

#### AI Services (if needed)
- `OPENAI_API_KEY`: Your OpenAI API key (if using)
- `ANTHROPIC_API_KEY`: Your Anthropic API key (if using)

#### File Storage Paths
- `BOOK_STORAGE_PATH`: /var/data/books
- `COVER_STORAGE_PATH`: /var/data/covers
- `REPORT_STORAGE_PATH`: /var/data/reports
- `UPLOAD_DIR`: /var/data/uploads

#### Public URLs
- `NEXT_PUBLIC_APP_URL`: https://getlostportal.onrender.com (or your custom domain)
- `NEXT_PUBLIC_SUPPORTED_FORMATS`: .docx,.pdf,.epub

### 4. Persistent Disk Setup

If using SQLite or storing files locally:

1. In your Render service settings
2. Go to "Disks" section
3. Add a disk:
   - **Name**: getlostportal-data
   - **Mount Path**: /var/data
   - **Size**: 1 GB (adjust as needed)

### 5. Deploy

1. Click "Create Web Service" or "Deploy"
2. Wait for the build to complete (5-10 minutes)
3. Check the logs for any errors

### 6. Post-Deployment

1. Visit your app URL to verify it's working
2. Test Google OAuth login
3. Create admin users using the admin emails you configured
4. Test file uploads

## Database Migration Commands

If you need to run migrations manually:

```bash
# SSH into your Render service
# Then run:
npm run db:generate
npm run db:migrate
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify DATABASE_URL is set correctly
   - For Turso, ensure auth token is valid
   - For SQLite, ensure persistent disk is mounted

2. **OAuth Not Working**
   - Add your Render URL to Google OAuth authorized redirect URIs
   - Format: `https://your-app.onrender.com/api/auth/callback/google`

3. **File Upload Issues**
   - Verify persistent disk is mounted at `/var/data`
   - Check file size limits in Render settings

4. **Build Failures**
   - Check Node version compatibility
   - Verify all dependencies are in package.json
   - Check build logs for specific errors

### Monitoring

- Use Render's built-in logging
- Set up alerts for service health
- Monitor disk usage if using persistent storage

## Custom Domain

To add a custom domain:

1. Go to Settings → Custom Domains
2. Add your domain
3. Configure DNS as instructed
4. Update NEXTAUTH_URL and NEXT_PUBLIC_APP_URL environment variables

## Scaling

When ready to scale:

1. Upgrade from free tier to Starter or Standard
2. Consider using external database (Turso, PlanetScale, or Neon)
3. Use external object storage (S3, Cloudinary) for files
4. Enable auto-scaling in Render settings