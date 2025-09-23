# Google OAuth Setup for Get Lost

## Google Cloud Console Configuration

### 1. Create OAuth 2.0 Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
5. If prompted, configure OAuth consent screen first:
   - User Type: External
   - App name: Get Lost
   - User support email: Your email
   - Developer contact: Your email

### 2. OAuth Client Configuration

**Application type:** Web application

**Name:** Get Lost Web Client

### 3. Authorized JavaScript Origins

Add these origins (adjust ports/domains as needed):

#### For Development:
```
http://localhost:3000
http://localhost:3001
```

#### For Production:
```
https://yourdomain.com
https://www.yourdomain.com
```

### 4. Authorized Redirect URIs

Add these EXACT URIs (NextAuth requires specific paths):

#### For Development:
```
http://localhost:3000/api/auth/callback/google
http://localhost:3001/api/auth/callback/google
```

#### For Production:
```
https://yourdomain.com/api/auth/callback/google
https://www.yourdomain.com/api/auth/callback/google
```

### 5. Environment Variables

After creating the OAuth client, you'll get:
- **Client ID**: Copy to `AUTH_GOOGLE_ID` in `.env`
- **Client Secret**: Copy to `AUTH_GOOGLE_SECRET` in `.env`

### 6. NextAuth Secret

Generate a secret for NextAuth:
```bash
npx auth secret
```

Or use:
```bash
openssl rand -base64 32
```

Add to `.env`:
```
AUTH_SECRET=your_generated_secret_here
```

### 7. Complete .env Example

```env
# NextAuth
AUTH_SECRET="your-generated-secret-here"

# Google OAuth
AUTH_GOOGLE_ID="your-client-id.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="GOCSPX-your-client-secret"

# Database
DATABASE_URL="file:./db.sqlite"
```

## Important Notes

1. **Exact Path Match**: The callback URL must be EXACTLY `/api/auth/callback/google` - NextAuth expects this specific path

2. **Protocol Matters**: Use `http://` for localhost, `https://` for production

3. **Multiple Environments**: You can add multiple origins and redirect URIs for different environments in the same OAuth client

4. **Verification**: For production, you may need to verify your domain and submit for OAuth consent screen review if you want to allow any Google user to sign in

5. **Scopes**: NextAuth will request basic profile information by default (email, name, profile picture)

## Testing

1. Make sure all environment variables are set
2. Restart your Next.js development server
3. Try signing in with Google on `/login` or `/signup` pages
4. Check browser console and terminal for any errors

## Common Issues

- **Redirect URI Mismatch**: Double-check the callback URL is exactly `/api/auth/callback/google`
- **Missing Secret**: Ensure `AUTH_SECRET` is set
- **Wrong Environment Variables**: NextAuth uses `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` (not `GOOGLE_CLIENT_ID` etc.)