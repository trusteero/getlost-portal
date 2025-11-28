# Resend Email Setup Guide

## Overview

This application uses [Resend](https://resend.com) for sending transactional emails (verification emails, password resets, welcome emails, etc.).

## Why Resend?

- ✅ **Next.js Optimized**: Built specifically for Next.js applications
- ✅ **Great Free Tier**: 3,000 emails/month free
- ✅ **Easy Setup**: No domain verification required for testing
- ✅ **Simple API**: Clean, developer-friendly API
- ✅ **Excellent Deliverability**: High inbox rates

## Setup Instructions

### 1. Create a Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

### 2. Get Your API Key

1. Go to [Resend API Keys](https://resend.com/api-keys)
2. Click "Create API Key"
3. Give it a name (e.g., "Get Lost Portal")
4. Copy the API key (you'll only see it once!)

### 3. Configure Environment Variables

Add these to your `.env.local` file (for development) or your production environment:

```env
# Resend Configuration
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

**For Testing (No Domain Required):**
- ⚠️ **Important**: `onboarding@resend.dev` can only send emails to the email address associated with your Resend account
- If you need to test with other email addresses, you must verify a domain
- For development, you can use your own email address as the recipient, or verify a domain

**For Production:**
- Add and verify your domain in Resend
- Use an email from your verified domain (e.g., `noreply@yourdomain.com`)

### 4. Domain Verification (Required for Testing with Any Email)

**⚠️ Important Limitation:**
- `onboarding@resend.dev` can **only** send emails to the email address associated with your Resend account
- To send verification emails to any user email address, you **must** verify your own domain
- This is required for both testing and production

**Steps to Verify Your Domain:**

1. Go to [Resend Domains](https://resend.com/domains)
2. Click "Add Domain"
3. Enter your domain (e.g., `getlost.ink` or `yourdomain.com`)
4. Add the DNS records Resend provides to your domain's DNS settings:
   - **SPF record** - Authorizes Resend to send emails
   - **DKIM records** (usually 2-3 records) - Email authentication
   - **DMARC record** (optional but recommended) - Email security
5. Wait for verification (usually a few minutes to a few hours)
6. Once verified, update your `RESEND_FROM_EMAIL`:
   ```env
   RESEND_FROM_EMAIL=noreply@getlost.ink
   ```

## Environment Variables

### Required

- `RESEND_API_KEY` - Your Resend API key
- `RESEND_FROM_EMAIL` - Sender email address

### Optional

- `NEXT_PUBLIC_APP_URL` - Base URL for email links (defaults to `http://localhost:3000`)

## Development Mode

In development, if `RESEND_API_KEY` is not set:
- Emails will be logged to the console instead of being sent
- This allows you to test the email flow without configuring Resend
- You'll see logs like: `📧 [Email] Would be sent: { to: '...', subject: '...' }`

## Testing

### Test Email Sending

1. Set `RESEND_API_KEY` in your `.env.local`
2. Use `onboarding@resend.dev` as `RESEND_FROM_EMAIL` for testing
3. ⚠️ **Note**: With `onboarding@resend.dev`, you can only send to the email address associated with your Resend account
4. To test with any email address, verify a domain first (see Domain Verification below)
5. Try signing up a new user (must use your Resend account email if using `onboarding@resend.dev`)
6. Check your email inbox (or Resend dashboard for logs)

### Check Email Logs

1. Go to [Resend Dashboard](https://resend.com/emails)
2. View all sent emails
3. See delivery status, opens, clicks, etc.

## Pricing

- **Free Tier**: 3,000 emails/month
- **Pro**: $20/month for 50,000 emails
- **Business**: Custom pricing for higher volumes

See [Resend Pricing](https://resend.com/pricing) for details.

## Troubleshooting

### Emails Not Sending

1. **Check API Key**: Verify `RESEND_API_KEY` is set correctly
2. **Check From Email**: 
   - For testing: Use `onboarding@resend.dev`
   - For production: Must be from a verified domain
3. **Check Logs**: Look for `📧 [Email]` logs in your console
4. **Check Resend Dashboard**: View email logs and errors

### Domain Verification Issues

1. **DNS Records**: Make sure all DNS records are added correctly
2. **Propagation**: DNS changes can take up to 48 hours (usually much faster)
3. **Check Status**: Go to Resend Domains to see verification status

### Rate Limits

- Free tier: 10 requests/second
- Pro tier: 100 requests/second
- If you hit limits, you'll see rate limit errors in logs

## Migration from MailerSend

If you were previously using MailerSend:

1. Replace `MAILERSEND_API_KEY` with `RESEND_API_KEY`
2. Replace `MAILERSEND_FROM_EMAIL` with `RESEND_FROM_EMAIL`
3. Update your environment variables
4. No code changes needed - the service handles the switch automatically

## Support

- [Resend Documentation](https://resend.com/docs)
- [Resend Support](https://resend.com/support)
- [Resend Status](https://status.resend.com)

