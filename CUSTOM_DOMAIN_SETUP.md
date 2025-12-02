# Custom Domain Setup Guide

## Overview

If you're using a custom domain (e.g., `portal.getlost.ink`) that points to your Render deployment (`https://getlost-portal.onrender.com/`), you need to configure Better Auth to trust both origins.

## The Problem

When you access the site via `portal.getlost.ink`, the browser sends requests with origin `https://portal.getlost.ink`. However, Better Auth is configured to only trust `https://getlost-portal.onrender.com/`, causing "Invalid origin" errors.

## The Solution

Configure Better Auth to trust both the Render URL and your custom domain.

## Setup Steps

### 1. Set Up DNS

Point your custom domain to your Render service:

```
Type: CNAME
Name: portal (or @ for root domain)
Value: getlost-portal.onrender.com
```

Or use an A record if CNAME isn't supported:

```
Type: A
Name: portal (or @ for root domain)
Value: [Render IP address]
```

### 2. Configure Render Custom Domain

1. Go to Render Dashboard → Your Service → Settings
2. Scroll to "Custom Domains"
3. Add your custom domain: `portal.getlost.ink`
4. Render will provide DNS instructions if needed

### 3. Set Environment Variables

In Render Dashboard → Your Service → Environment, add:

```bash
CUSTOM_DOMAIN=https://portal.getlost.ink
NEXT_PUBLIC_CUSTOM_DOMAIN=https://portal.getlost.ink
```

**Note**: You can use either:
- `CUSTOM_DOMAIN` (server-side only)
- `NEXT_PUBLIC_CUSTOM_DOMAIN` (available to client-side code)
- Both (recommended for consistency)

### 4. Update Google OAuth (if using)

**⚠️ IMPORTANT**: You MUST update Google OAuth settings when using a custom domain.

Since the `baseURL` now uses your custom domain, the OAuth callback URL will be:
- `https://portal.getlost.ink/api/auth/callback/google`

**Steps:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services → Credentials**
3. Edit your **OAuth 2.0 Client ID**
4. In **"Authorized redirect URIs"**, add:
   - `https://portal.getlost.ink/api/auth/callback/google`
   - (Keep the existing Render URL if you want both to work: `https://getlost-portal.onrender.com/api/auth/callback/google`)

**Why both?**
- If `CUSTOM_DOMAIN` is set, Better Auth uses it as `baseURL`, so the callback will be `https://portal.getlost.ink/api/auth/callback/google`
- If you want users to be able to sign in via either domain, register both callback URLs
- If you only want the custom domain, you can remove the Render URL from Google Console

### 5. Redeploy

After setting the environment variables, Render will automatically redeploy. The new configuration will:

- Trust requests from `https://getlost-portal.onrender.com/` (Render URL)
- Trust requests from `https://portal.getlost.ink` (custom domain)
- Allow authentication from both origins

## Verification

After deployment, check the server logs for:

```
🔒 [Better Auth] Trusted origins (production): [
  'https://getlost-portal.onrender.com',
  'https://portal.getlost.ink'
]
```

## Troubleshooting

### Still Getting "Invalid origin" Error

1. **Check environment variables**: Verify `CUSTOM_DOMAIN` is set correctly in Render dashboard
2. **Check logs**: Look for the trusted origins log message
3. **Check DNS**: Ensure DNS has propagated (can take up to 48 hours)
4. **Clear browser cache**: Try incognito mode or clear cookies
5. **Check protocol**: Make sure you're using `https://` (not `http://`)

### DNS Not Working

- Verify DNS records are correct
- Use `dig portal.getlost.ink` or `nslookup portal.getlost.ink` to check DNS
- Wait for DNS propagation (can take 24-48 hours)

### SSL Certificate Issues

Render automatically provisions SSL certificates for custom domains. If you see SSL errors:

1. Wait a few minutes after adding the domain (certificate provisioning takes time)
2. Check Render dashboard for certificate status
3. Contact Render support if issues persist

## Environment Variables Summary

| Variable | Purpose | Example |
|----------|---------|---------|
| `BETTER_AUTH_URL` | Render URL (auto-set) | `https://getlost-portal.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | Render URL (auto-set) | `https://getlost-portal.onrender.com` |
| `CUSTOM_DOMAIN` | Custom domain URL | `https://portal.getlost.ink` |
| `NEXT_PUBLIC_CUSTOM_DOMAIN` | Custom domain URL (client-side) | `https://portal.getlost.ink` |

## Notes

- The Render URL is automatically trusted (from `BETTER_AUTH_URL`)
- The custom domain must be explicitly set via `CUSTOM_DOMAIN` or `NEXT_PUBLIC_CUSTOM_DOMAIN`
- Both origins will be trusted once configured
- In development, localhost origins are automatically trusted

