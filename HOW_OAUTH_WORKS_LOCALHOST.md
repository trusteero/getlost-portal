# How Google OAuth Works with Localhost

## The Complete Flow

Here's exactly what happens when you click "Sign in with Google" on localhost:

### Step 1: User Clicks "Sign in with Google"

```
User clicks button → Frontend calls Better Auth
```

**What happens:**
- Your frontend (React) calls Better Auth's sign-in method
- Better Auth generates an OAuth authorization URL
- The URL includes:
  - Your `AUTH_GOOGLE_ID` (Client ID)
  - A `redirect_uri` parameter: `http://localhost:3000/api/auth/callback/google`
  - A `state` parameter (for security - prevents CSRF attacks)
  - Scopes (what info you're requesting: email, profile)

**Example URL generated:**
```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=YOUR_CLIENT_ID.apps.googleusercontent.com
  &redirect_uri=http://localhost:3000/api/auth/callback/google
  &response_type=code
  &scope=email profile
  &state=random-security-token
```

### Step 2: Browser Redirects to Google

```
Your app → Browser redirects → Google's servers
```

**What happens:**
- The browser navigates to Google's OAuth page
- Google shows a login screen (if not already logged in)
- Google shows a consent screen: "Get Lost Portal wants to access your Google account"
- User clicks "Allow"

**Important:** This happens on Google's servers (`accounts.google.com`), NOT on your localhost!

### Step 3: Google Redirects Back to Localhost

```
Google → Browser redirects → http://localhost:3000/api/auth/callback/google
```

**What happens:**
- After user approves, Google redirects the browser back
- The redirect goes to: `http://localhost:3000/api/auth/callback/google`
- Google includes an **authorization code** in the URL:
  ```
  http://localhost:3000/api/auth/callback/google?code=4/0Aean...&state=random-security-token
  ```

**Key Point:** Google redirects to `localhost:3000` - this is why you need to register `http://localhost:3000` in Google Cloud Console!

### Step 4: Your Server Handles the Callback

```
Browser → Your Next.js server → Better Auth processes callback
```

**What happens:**
1. The browser makes a request to: `http://localhost:3000/api/auth/callback/google?code=...`
2. This hits your Next.js API route: `/api/auth/[...all]/route.ts`
3. Better Auth:
   - Validates the `state` parameter (security check)
   - Exchanges the authorization code for an access token
   - Uses the access token to fetch user info from Google
   - Creates/updates user in your database
   - Creates a session
   - Sets a cookie in the browser

**The code exchange happens server-to-server:**
```
Your server (localhost:3000) → Google's API (accounts.google.com)
  POST /token
  Body: {
    code: "authorization_code",
    client_id: "YOUR_CLIENT_ID",
    client_secret: "YOUR_CLIENT_SECRET",  // This is secret, never exposed to browser!
    redirect_uri: "http://localhost:3000/api/auth/callback/google"
  }
  
Google responds:
  {
    access_token: "...",
    id_token: "...",
    expires_in: 3600
  }
```

### Step 5: User is Logged In

```
Better Auth → Sets cookie → User redirected to dashboard
```

**What happens:**
- Better Auth creates a session in your database
- Sets an HTTP-only cookie in the browser
- Redirects user to your dashboard
- User is now logged in!

## Why Localhost Works

### 1. **Google Allows Localhost URLs**

Google's OAuth system explicitly allows `http://localhost` URLs. This is by design - developers need to test locally!

**In Google Cloud Console, you register:**
- `http://localhost:3000` as an authorized origin
- `http://localhost:3000/api/auth/callback/google` as a redirect URI

### 2. **The Redirect Happens in the Browser**

The key insight: **The redirect from Google happens in the user's browser**, not on Google's servers.

```
Google's servers → User's browser → Your localhost server
```

When Google redirects to `http://localhost:3000`, the browser:
1. Receives the redirect response from Google
2. Makes a new HTTP request to `localhost:3000`
3. This request goes to **your local Next.js server** (running on your machine)

### 3. **Your Local Server is Accessible**

Your Next.js dev server (`npm run dev`) is:
- Running on your machine
- Listening on `localhost:3000`
- Accessible to the browser (same machine)

So when the browser requests `http://localhost:3000/api/auth/callback/google`, it reaches your local server!

## Security Considerations

### Why `http://` Works for Localhost

- **Localhost is considered secure** - it's only accessible on your machine
- **No network exposure** - `localhost` doesn't go over the internet
- **Development only** - Google allows `http://` for localhost, but requires `https://` for production

### The `state` Parameter

The `state` parameter prevents CSRF attacks:
1. Your server generates a random token
2. Includes it in the OAuth URL
3. Google returns it in the callback
4. Your server verifies it matches
5. If it doesn't match, the request is rejected

### Client Secret Security

**Important:** The `AUTH_GOOGLE_SECRET` is:
- ✅ Stored in your `.env` file (server-side only)
- ✅ Never exposed to the browser
- ✅ Only used in server-to-server communication with Google
- ❌ Never in your frontend code
- ❌ Never in the OAuth redirect URL

## Visual Flow Diagram

```
┌─────────────┐
│   Browser   │
│  (User)     │
└──────┬──────┘
       │
       │ 1. Click "Sign in with Google"
       ▼
┌─────────────────────────┐
│  Your App (localhost)   │
│  http://localhost:3000  │
│                         │
│  Generates OAuth URL    │
│  with redirect_uri:     │
│  localhost:3000/...     │
└──────┬──────────────────┘
       │
       │ 2. Redirect to Google
       ▼
┌─────────────────────────┐
│  Google OAuth Server    │
│  accounts.google.com    │
│                         │
│  - Shows login screen   │
│  - Shows consent screen │
│  - User approves        │
└──────┬──────────────────┘
       │
       │ 3. Redirect back with code
       │    http://localhost:3000/api/auth/callback/google?code=...
       ▼
┌─────────────────────────┐
│  Your App (localhost)   │
│  http://localhost:3000  │
│                         │
│  - Receives code        │
│  - Exchanges for token  │
│  - Gets user info       │
│  - Creates session      │
│  - Sets cookie          │
└──────┬──────────────────┘
       │
       │ 4. User logged in!
       ▼
┌─────────────┐
│  Dashboard  │
│  (Logged in)│
└─────────────┘
```

## Common Questions

### Q: Does Google need to access my localhost?

**A:** No! Google never accesses your localhost. The flow is:
- Your browser → Google (for login)
- Google → Your browser (redirect with code)
- Your browser → Your localhost (callback)

### Q: Why does it work if localhost isn't on the internet?

**A:** Because the redirect happens in the browser, which is on the same machine as your server. The browser can access `localhost` even though it's not on the internet.

### Q: Can I use a different port?

**A:** Yes! Just update:
1. Google Cloud Console: Add `http://localhost:3001` (or whatever port)
2. Your `.env`: Set `NEXT_PUBLIC_APP_URL=http://localhost:3001`

### Q: What if I'm testing on a different machine?

**A:** You have two options:
1. **Use ngrok** (tunnels localhost to internet):
   ```bash
   ngrok http 3000
   # Use the ngrok URL in Google Console
   ```

2. **Use your local IP** (if on same network):
   - Google Console: `http://192.168.1.100:3000`
   - `.env`: `NEXT_PUBLIC_APP_URL=http://192.168.1.100:3000`

### Q: Why does the callback URL need to be exact?

**A:** Security! Google only redirects to URLs you've explicitly registered. This prevents malicious sites from intercepting your OAuth flow.

## Testing the Flow

You can test each step:

1. **Check OAuth URL generation:**
   ```javascript
   // In your browser console on localhost:3000
   fetch('/api/auth/sign-in/social?provider=google')
     .then(r => r.json())
     .then(console.log)
   ```

2. **Check callback handling:**
   - Add console logs in `/api/auth/[...all]/route.ts`
   - Watch your terminal when the callback happens

3. **Check database:**
   ```bash
   npm run db:studio
   # Check the `user` and `account` tables
   ```

## Summary

**The magic of localhost OAuth:**
1. ✅ Google allows `http://localhost` URLs
2. ✅ Redirect happens in the browser (same machine as your server)
3. ✅ Your local server receives the callback
4. ✅ Everything works just like production, but on your machine!

The key is that **the browser acts as the bridge** between Google's servers and your localhost server.

