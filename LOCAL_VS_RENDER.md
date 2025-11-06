# Running Locally vs Render - Environment Guide

## ✅ Yes, it's Easy!

The app is designed to work seamlessly in both environments. The only difference is **environment variables**.

---

## 🔄 How It Works

### Automatic Environment Detection

The app automatically detects whether it's running locally or on Render:

1. **Database Path**: Automatically switches based on `DATABASE_URL`
   - Local: `file:./dev.db`
   - Render: `file:/var/data/db.sqlite`

2. **File Storage**: Uses environment variables with sensible defaults
   - Local: `./uploads/books` (relative paths)
   - Render: `/var/data/books` (absolute paths)

3. **Build Phase**: Automatically handles Render's build phase where `/var/data` isn't available yet

---

## 📝 Environment Variables Comparison

### Local Development (`.env` file)

```bash
# Database
DATABASE_URL=file:./dev.db

# Auth
AUTH_SECRET=your-local-secret-here
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google OAuth (same for both)
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret

# File Storage (optional - defaults work)
BOOK_STORAGE_PATH=./uploads/books
COVER_STORAGE_PATH=./uploads/covers
REPORT_STORAGE_PATH=./uploads/reports

# Admin
SUPER_ADMIN_EMAILS=admin@example.com

# Optional Services
BOOKDIGEST_API_KEY=your-key
MAILERSEND_API_KEY=your-key
```

### Render Production (Dashboard Settings)

```bash
# Database
DATABASE_URL=file:/var/data/db.sqlite

# Auth (auto-configured by render.yaml)
AUTH_SECRET=[auto-generated]
BETTER_AUTH_URL=https://your-app.onrender.com
NEXT_PUBLIC_APP_URL=https://your-app.onrender.com

# Google OAuth (same credentials, but add production redirect URI)
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret

# File Storage (set in render.yaml)
BOOK_STORAGE_PATH=/var/data/books
COVER_STORAGE_PATH=/var/data/covers
REPORT_STORAGE_PATH=/var/data/reports
UPLOAD_DIR=/var/data/uploads

# Admin
SUPER_ADMIN_EMAILS=admin@example.com

# Services
BOOKDIGEST_API_KEY=your-key
MAILERSEND_API_KEY=your-key
```

---

## 🚀 Workflow: Local → Render

### 1. Develop Locally

```bash
# Your .env file
DATABASE_URL=file:./dev.db
AUTH_SECRET=local-secret
BETTER_AUTH_URL=http://localhost:3000
# ... etc

# Run locally
npm run dev
```

### 2. Test Locally

- Everything works with local database (`./dev.db`)
- Files stored in `./uploads/`
- Google OAuth redirects to `localhost:3000`

### 3. Deploy to Render

**Option A: Using render.yaml (Recommended)**
- Push code to GitHub
- Render auto-detects `render.yaml`
- Most settings auto-configured
- Just add secrets in Render dashboard

**Option B: Manual Setup**
- Create web service on Render
- Copy environment variables from `.env`
- Update URLs to Render domain
- Update database path to `/var/data/db.sqlite`

### 4. Both Work Simultaneously

- **Local**: `http://localhost:3000` → uses `./dev.db`
- **Render**: `https://your-app.onrender.com` → uses `/var/data/db.sqlite`

No code changes needed! 🎉

---

## 🔑 Key Differences

| Setting | Local | Render |
|---------|-------|--------|
| **Database** | `./dev.db` | `/var/data/db.sqlite` |
| **File Storage** | `./uploads/` | `/var/data/uploads/` |
| **Base URL** | `http://localhost:3000` | `https://your-app.onrender.com` |
| **Google OAuth** | `localhost:3000` redirect | `your-app.onrender.com` redirect |

---

## ✅ What's Already Configured

1. ✅ **Database auto-detection** - Handles both paths automatically
2. ✅ **Build phase handling** - Works during Render builds
3. ✅ **File path defaults** - Sensible defaults for both environments
4. ✅ **Environment validation** - `env.js` validates required vars
5. ✅ **Better Auth URLs** - Uses environment variables

---

## 🎯 Quick Setup Checklist

### Local Development
- [ ] Create `.env` file with local settings
- [ ] Set `DATABASE_URL=file:./dev.db`
- [ ] Set `BETTER_AUTH_URL=http://localhost:3000`
- [ ] Run `npm run dev`

### Render Deployment
- [ ] Push code to GitHub
- [ ] Create Render service (or use `render.yaml`)
- [ ] Set `DATABASE_URL=file:/var/data/db.sqlite`
- [ ] Set `BETTER_AUTH_URL=https://your-app.onrender.com`
- [ ] Add persistent disk at `/var/data`
- [ ] Deploy!

---

## 💡 Pro Tips

1. **Use the same Google OAuth app** - Just add both redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-app.onrender.com/api/auth/callback/google`

2. **Database stays separate** - Local and Render have separate databases (good for testing!)

3. **File uploads** - Local files stay local, Render files stay on Render (separate storage)

4. **Environment variables** - Keep sensitive keys out of git, use Render's secure env vars

5. **Testing** - Test locally first, then deploy to Render

---

## 🐛 Common Issues

### Issue: "Database directory does not exist" on Render
**Solution**: Make sure persistent disk is mounted at `/var/data`

### Issue: OAuth redirect mismatch
**Solution**: Add both localhost and Render URLs to Google OAuth settings

### Issue: Files not persisting on Render
**Solution**: Ensure files are saved to `/var/data/` (persistent disk), not `/tmp/`

### Issue: Build fails on Render
**Solution**: This is normal! The app uses a temporary build database during build phase.

---

## ✨ Summary

**Yes, it's very easy!** The app is designed to work in both environments with just environment variable changes. No code modifications needed when switching between local and Render.

Just:
1. Keep different `.env` files (or use Render dashboard)
2. Update URLs (localhost vs Render domain)
3. Update database path (relative vs absolute)
4. That's it! 🎉

