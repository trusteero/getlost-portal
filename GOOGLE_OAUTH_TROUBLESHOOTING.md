# Google OAuth Redirect URI Troubleshooting

## ✅ Your App Configuration (Correct)

Based on the debug endpoint, your app is using:
```
https://getlost-portal.onrender.com/api/auth/callback/google
```

This is **correct**! Now we need to make sure Google Cloud Console matches exactly.

---

## 🔍 Step-by-Step Verification

### Step 1: Verify in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Make sure you're in the **correct project** (the one with your OAuth credentials)
3. Navigate to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID (should start with `133231452076-...`)
5. Click on it to edit

### Step 2: Check Authorized Redirect URIs

Look at the **"Authorized redirect URIs"** section. You should see:

```
https://getlost-portal.onrender.com/api/auth/callback/google
```

**Common mistakes to check:**

#### ❌ Wrong - Has trailing slash
```
https://getlost-portal.onrender.com/api/auth/callback/google/
```

#### ❌ Wrong - Missing /api
```
https://getlost-portal.onrender.com/auth/callback/google
```

#### ❌ Wrong - Wrong path
```
https://getlost-portal.onrender.com/api/auth/google
```

#### ❌ Wrong - HTTP instead of HTTPS
```
http://getlost-portal.onrender.com/api/auth/callback/google
```

#### ❌ Wrong - Different domain
```
https://getlostportal.onrender.com/api/auth/callback/google
```

#### ✅ Correct - Exact match
```
https://getlost-portal.onrender.com/api/auth/callback/google
```

### Step 3: If the URL is Missing or Wrong

1. Click **"+ ADD URI"** (or edit the existing one)
2. Type or paste this **EXACTLY**:
   ```
   https://getlost-portal.onrender.com/api/auth/callback/google
   ```
3. **Double-check:**
   - No trailing slash
   - No spaces before or after
   - `https://` (not `http://`)
   - Exact domain: `getlost-portal.onrender.com` (with hyphen)
   - Exact path: `/api/auth/callback/google`
4. Click **"SAVE"**

### Step 4: Wait for Propagation

- Google's changes can take **1-5 minutes** to propagate
- Sometimes up to **10 minutes** in rare cases
- Don't test immediately after saving

### Step 5: Clear Browser Cache

1. Open an **Incognito/Private window**
2. Or clear cookies for `getlost-portal.onrender.com`
3. Try signing in again

---

## 🔍 Additional Checks

### Check 1: Are you using the right OAuth Client?

Make sure the Client ID in Google Cloud Console matches what's in Render:
- Google Cloud Console Client ID should start with: `133231452076-...`
- Check Render Dashboard → Environment → `AUTH_GOOGLE_ID` should match

### Check 2: Check for Multiple OAuth Clients

If you have multiple OAuth clients:
1. Make sure you're editing the **correct one** (the one with Client ID starting with `133231452076-...`)
2. Or add the redirect URI to **all** OAuth clients you might be using

### Check 3: Check OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Make sure it's configured (even if in testing mode)
3. If using "External" app type, add your email as a test user

### Check 4: Check Render Environment Variables

In Render Dashboard → Environment, verify:
- `AUTH_GOOGLE_ID` = `133231452076-70uu7g8...` (matches Google Console)
- `AUTH_GOOGLE_SECRET` = Set correctly
- `BETTER_AUTH_URL` = `https://getlost-portal.onrender.com`
- `NEXT_PUBLIC_APP_URL` = `https://getlost-portal.onrender.com`

---

## 🧪 Test Steps

1. **Wait 5 minutes** after saving in Google Cloud Console
2. Open **Incognito/Private window**
3. Go to: `https://getlost-portal.onrender.com/login`
4. Click "Sign in with Google"
5. Check what happens

---

## 📋 Copy-Paste Checklist

In Google Cloud Console, make sure you have **EXACTLY** this:

### Authorized JavaScript Origins:
```
https://getlost-portal.onrender.com
```

### Authorized Redirect URIs:
```
https://getlost-portal.onrender.com/api/auth/callback/google
```

**For local development, also add:**
```
http://localhost:3000
http://localhost:3000/api/auth/callback/google
```

---

## 🆘 Still Not Working?

### Option 1: Check Browser Network Tab

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Try signing in with Google
4. Look for the request to `accounts.google.com`
5. Check the `redirect_uri` parameter in the URL
6. Compare it to what's in Google Cloud Console

### Option 2: Check Render Logs

1. Go to Render Dashboard → Your Service → Logs
2. Look for the line:
   ```
   🔍 [Better Auth] Expected Google OAuth callback URL: https://...
   ```
3. Verify it matches what's in Google Cloud Console

### Option 3: Try Creating a New OAuth Client

If nothing works, create a fresh OAuth client:
1. Google Cloud Console → Credentials
2. **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Application type: **Web application**
4. Add the redirect URI from the start
5. Copy the new Client ID and Secret
6. Update in Render Dashboard

---

## ✅ Success Indicators

When it works, you should:
1. Click "Sign in with Google"
2. Be redirected to Google's login page
3. After logging in, be redirected back to your app
4. Be signed in successfully

If you see the redirect_uri_mismatch error, the URL still doesn't match exactly.

---

## 📝 Summary

**The exact URL that must be in Google Cloud Console:**
```
https://getlost-portal.onrender.com/api/auth/callback/google
```

**Double-check:**
- ✅ No trailing slash
- ✅ `https://` (not `http://`)
- ✅ Exact domain: `getlost-portal.onrender.com`
- ✅ Exact path: `/api/auth/callback/google`
- ✅ No extra spaces
- ✅ Saved and waited 5 minutes
- ✅ Testing in incognito window

