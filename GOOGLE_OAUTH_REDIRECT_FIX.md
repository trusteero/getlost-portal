# Fix Google OAuth Redirect URI Mismatch

## Error: `redirect_uri_mismatch`

This error means the redirect URI in Google Cloud Console doesn't match what your app is sending.

---

## Quick Fix

### Step 1: Find Your Render URL

Your Render URL should be something like:
- `https://getlost-portal.onrender.com`
- Or check Render Dashboard → Your Service → URL

### Step 2: Add Redirect URI to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Click on your **OAuth 2.0 Client ID** (the one you're using)
5. Scroll down to **"Authorized redirect URIs"**
6. Click **"+ ADD URI"**
7. Add this **EXACT** URL:
   ```
   https://getlost-portal.onrender.com/api/auth/callback/google
   ```
   ⚠️ **Important**: Replace `getlost-portal` with your actual Render service name!
8. Click **"SAVE"**

### Step 3: Wait a Few Minutes

Google's changes can take 1-5 minutes to propagate. Wait a bit, then try again.

---

## Complete Setup (Local + Production)

For both local development and production, you should have these redirect URIs:

### Authorized JavaScript Origins:
```
http://localhost:3000
https://getlost-portal.onrender.com
```

### Authorized Redirect URIs:
```
http://localhost:3000/api/auth/callback/google
https://getlost-portal.onrender.com/api/auth/callback/google
```

**Note**: Replace `getlost-portal` with your actual Render service name!

---

## Verify Your Render URL

To find your exact Render URL:

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click on your service (`getlostportal`)
3. Look at the top - it shows your service URL
4. It should be something like: `https://getlost-portal.onrender.com`

---

## Common Mistakes

### ❌ Wrong Format
```
https://getlost-portal.onrender.com/auth/callback/google  ← Missing /api
https://getlost-portal.onrender.com/api/auth/google      ← Wrong path
```

### ✅ Correct Format
```
https://getlost-portal.onrender.com/api/auth/callback/google
```

### ❌ Using HTTP Instead of HTTPS
```
http://getlost-portal.onrender.com/api/auth/callback/google  ← Wrong protocol
```

### ✅ Using HTTPS
```
https://getlost-portal.onrender.com/api/auth/callback/google
```

---

## Still Not Working?

### 1. Double-Check the URL
- Make sure it's exactly: `https://YOUR-SERVICE-NAME.onrender.com/api/auth/callback/google`
- No trailing slashes
- Use `https://` not `http://`

### 2. Check Environment Variables
Make sure these are set in Render Dashboard:
- `AUTH_GOOGLE_ID` = Your Google Client ID
- `AUTH_GOOGLE_SECRET` = Your Google Client Secret

### 3. Wait for Propagation
Google's changes can take up to 5 minutes. Wait a bit and try again.

### 4. Clear Browser Cache
Sometimes browsers cache OAuth errors. Try:
- Incognito/Private window
- Clear cookies for your Render domain
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### 5. Check Render Logs
Look for these in Render logs:
```
✅ [Better Auth] Google OAuth configured
🔍 [Better Auth] Google OAuth configuration check:
   AUTH_GOOGLE_ID: xxxxx...
   AUTH_GOOGLE_SECRET: SET
   Has credentials: true
```

If you see warnings instead, the credentials aren't set correctly.

---

## Testing

After adding the redirect URI:

1. Wait 2-5 minutes for Google to update
2. Go to your Render app: `https://getlost-portal.onrender.com`
3. Click "Sign in with Google"
4. You should be redirected to Google's login page
5. After logging in, you'll be redirected back to your app

---

## Summary

**The fix is simple:**
1. Add `https://YOUR-SERVICE-NAME.onrender.com/api/auth/callback/google` to Google Cloud Console
2. Wait a few minutes
3. Try again!

The redirect URI must match **exactly** what Better Auth sends, which is:
```
https://YOUR-DOMAIN/api/auth/callback/google
```

