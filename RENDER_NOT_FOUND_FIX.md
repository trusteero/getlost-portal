# Render "Not Found" Error - Troubleshooting Guide

## 🔍 Common Causes

### 1. Build Failed (Most Common)

**Check Render Logs:**
1. Go to Render dashboard → Your service
2. Click **"Logs"** tab
3. Look for build errors

**Common build errors:**
- Missing environment variables
- TypeScript errors
- Database connection during build
- Missing dependencies

### 2. App Not Starting

**Check Runtime Logs:**
1. Go to **"Logs"** tab in Render
2. Look for errors after "Build completed"
3. Check if app is listening on correct port

**Common issues:**
- Port mismatch (Next.js uses PORT env var)
- Database initialization failing
- Missing required env vars at runtime

### 3. Middleware Syntax Error

There's a syntax error in `src/middleware.ts` - missing comma on line 34.

### 4. Database Path Issue

The database path might not be accessible at runtime.

---

## ✅ Quick Fixes

### Fix 1: Check Build Logs

```bash
# In Render dashboard → Logs
# Look for:
- "Build failed"
- "Error:"
- "Missing:"
```

### Fix 2: Check Runtime Logs

```bash
# In Render dashboard → Logs
# After build, look for:
- "Server started"
- "Listening on port"
- Database errors
```

### Fix 3: Verify Environment Variables

Make sure these are set in Render:
- ✅ `AUTH_GOOGLE_ID`
- ✅ `AUTH_GOOGLE_SECRET`
- ✅ `SUPER_ADMIN_EMAILS`
- ✅ `DATABASE_URL=file:/var/data/db.sqlite`

### Fix 4: Check Port Configuration

Next.js should automatically use Render's `PORT` env var, but verify:
- Service is set to listen on `$PORT` (Next.js does this automatically)
- No hardcoded port numbers

### Fix 5: Verify Disk is Mounted

1. Go to **"Disks"** section
2. Verify disk `getlostportal-uploads` is mounted at `/var/data`
3. Check disk status is "Attached"

---

## 🔧 Step-by-Step Debugging

### Step 1: Check Build Logs

1. Render dashboard → Your service → **"Logs"**
2. Scroll to build section
3. Look for errors (red text)
4. Common errors:
   - `Error: Missing environment variable`
   - `TypeError: Cannot read property`
   - `Database connection failed`

### Step 2: Check Runtime Logs

1. Scroll past build logs
2. Look for runtime errors
3. Check if app started:
   ```
   ✓ Ready in Xms
   ▲ Next.js X.X.X
   - Local: http://localhost:XXXX
   ```

### Step 3: Test Database

If database is the issue:
1. Go to **"Shell"** tab in Render
2. Run:
   ```bash
   ls -la /var/data
   ```
3. Should show `db.sqlite` file

### Step 4: Check Environment Variables

1. Go to **"Environment"** tab
2. Verify all required vars are set
3. Check for typos in variable names

---

## 🐛 Specific Error Messages

### "Cannot find module"
- **Fix**: Check build logs for missing dependencies
- **Solution**: Dependencies might not be installing correctly

### "Database connection failed"
- **Fix**: Verify disk is mounted
- **Solution**: Check `/var/data` exists and is writable

### "Port already in use"
- **Fix**: Next.js should use `$PORT` automatically
- **Solution**: Usually not an issue with Next.js

### "404 Not Found" on all routes
- **Fix**: App might not be starting correctly
- **Solution**: Check runtime logs for startup errors

---

## 📋 Checklist

Before asking for help, check:

- [ ] Build logs show "Build succeeded"
- [ ] Runtime logs show "Ready" or "Server started"
- [ ] All required environment variables are set
- [ ] Disk is mounted at `/var/data`
- [ ] Database file exists (or will be created)
- [ ] No TypeScript/build errors in logs
- [ ] Service status is "Live" (not "Build failed")

---

## 🚀 Quick Test

Try accessing these URLs:
- `https://your-app.onrender.com/` (homepage)
- `https://your-app.onrender.com/login` (login page)
- `https://your-app.onrender.com/api/auth/session` (auth endpoint)

If all return 404, the app isn't starting correctly.

---

## 💡 Most Likely Issues

1. **Build failed** - Check build logs for errors
2. **Missing env vars** - Verify all required vars are set
3. **Database error** - Check disk mount and database path
4. **App not starting** - Check runtime logs for errors

**Share the error logs from Render and I can help fix it!**

