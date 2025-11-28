# Google OAuth Setup for Local Development

Yes! Google authentication can be set up for local development. Here's how:

## Quick Setup Guide

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **+ CREATE CREDENTIALS** > **OAuth client ID**

### Step 2: Configure OAuth Consent Screen (First Time Only)

If this is your first OAuth client, you'll need to configure the consent screen:

1. Click **Configure Consent Screen**
2. Choose **External** (unless you have a Google Workspace)
3. Fill in:
   - **App name**: Get Lost Portal (or your app name)
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Click **Save and Continue**
5. Skip scopes (click **Save and Continue**)
6. Add test users if needed (click **Save and Continue**)
7. Review and go back to **Credentials**

### Step 3: Create OAuth 2.0 Client ID

1. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
2. **Application type**: Web application
3. **Name**: Get Lost Portal - Local Development

### Step 4: Configure Authorized URLs

#### Authorized JavaScript Origins:
Add these URLs (one per line):
```
http://localhost:3000
http://127.0.0.1:3000
```

#### Authorized Redirect URIs:
Add these EXACT URIs (Better Auth requires specific paths):
```
http://localhost:3000/api/auth/callback/google
http://127.0.0.1:3000/api/auth/callback/google
```

**Important Notes:**
- Use `http://` (not `https://`) for localhost
- The callback path must be exactly `/api/auth/callback/google`
- Include both `localhost` and `127.0.0.1` if you use either

### Step 5: Copy Credentials

After creating the OAuth client, you'll see:
- **Client ID**: Something like `123456789-abc.apps.googleusercontent.com`
- **Client Secret**: Something like `GOCSPX-xyz123...`

### Step 6: Add to Your `.env` File

Create or update your `.env` file in the project root:

```env
# Database
DATABASE_URL="file:./dev.db"

# Auth Secret (generate one if you don't have it)
AUTH_SECRET="your-generated-secret-here"

# Google OAuth (for local development)
AUTH_GOOGLE_ID="your-client-id.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="GOCSPX-your-client-secret"

# App URL (for local development)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
BETTER_AUTH_URL="http://localhost:3000"
```

### Step 7: Generate Auth Secret (If Needed)

If you don't have an `AUTH_SECRET`, generate one:

```bash
# Option 1: Using OpenSSL
openssl rand -base64 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output and add it to your `.env` file as `AUTH_SECRET`.

### Step 8: Restart Your Dev Server

```bash
npm run dev
```

The Google OAuth button should now appear on your login/signup page!

## Testing

1. Start your dev server: `npm run dev`
2. Go to `http://localhost:3000`
3. Click "Sign in" or "Sign up"
4. You should see a "Sign in with Google" button
5. Click it and you'll be redirected to Google's login page
6. After logging in, you'll be redirected back to your app

## Troubleshooting

### "redirect_uri_mismatch" Error

This means the redirect URI in your Google OAuth config doesn't match what the app is sending.

**Fix:**
1. Go to Google Cloud Console > Credentials
2. Click on your OAuth 2.0 Client ID
3. Make sure these are in **Authorized redirect URIs**:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
4. Save and wait a few minutes for changes to propagate

### "Invalid Client" Error

This means your `AUTH_GOOGLE_ID` or `AUTH_GOOGLE_SECRET` is incorrect.

**Fix:**
1. Double-check your `.env` file
2. Make sure there are no extra spaces or quotes
3. Copy the credentials directly from Google Cloud Console

### Google OAuth Button Not Showing

**Possible causes:**
1. Environment variables not loaded - restart your dev server
2. Credentials not set - check your `.env` file
3. Build cache issue - try clearing `.next` folder:
   ```bash
   rm -rf .next
   npm run dev
   ```

### "Access Blocked" Error

If you see "Access blocked: This app's request is invalid":

1. Make sure you've configured the OAuth consent screen
2. If using "External" app type, you may need to add test users
3. Go to OAuth consent screen > Test users > Add your email

## Optional: Using Different Ports

If you're running on a different port (e.g., 3001), update:

1. **Google Cloud Console**: Add the new URLs:
   ```
   http://localhost:3001
   http://localhost:3001/api/auth/callback/google
   ```

2. **Your `.env` file**:
   ```env
   NEXT_PUBLIC_APP_URL="http://localhost:3001"
   BETTER_AUTH_URL="http://localhost:3001"
   ```

## Email/Password Still Works

Even with Google OAuth configured, users can still:
- Sign up with email/password
- Sign in with email/password
- Link their Google account to an existing email account

Google OAuth is **optional** - the app works fine without it!

## Production Setup

For production (Render), you'll need to:
1. Create a separate OAuth client (or use the same one)
2. Add your production URLs:
   ```
   https://your-app.onrender.com
   https://your-app.onrender.com/api/auth/callback/google
   ```
3. Set the same environment variables in Render dashboard

## Summary

✅ **Google OAuth works locally!**
- Just configure it in Google Cloud Console
- Add credentials to `.env`
- Restart dev server
- Done!

The setup is the same as production, just with `localhost` URLs instead of your domain.

