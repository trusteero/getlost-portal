# Email Verification Setup Guide

## Overview

Email verification has been enabled for user sign-ups. When a user creates an account, they must verify their email address before they can log in.

## How It Works

1. **User Signs Up**: User creates an account with email and password
2. **Verification Email Sent**: Better Auth automatically sends a verification email via Resend
3. **User Clicks Link**: User clicks the verification link in their email
4. **Email Verified**: User's account is marked as verified and they can now log in

## Configuration

### Environment Variables

Make sure these are set in your `.env` file:

```env
# Resend Configuration (required for email sending)
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=onboarding@resend.dev  # ⚠️ Can only send to your Resend account email. For any email, verify a domain and use noreply@yourdomain.com

# App URL (required for verification links)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change to your production URL in production
```

### Resend Setup

1. Sign up at [Resend](https://resend.com) (free account)
2. Get your API key from [Resend API Keys](https://resend.com/api-keys)
3. ⚠️ **Important**: `onboarding@resend.dev` can only send to your Resend account email
4. To send to any email address: Add and verify your domain in [Resend Domains](https://resend.com/domains)
5. Once domain is verified, use `noreply@yourdomain.com` as `RESEND_FROM_EMAIL`
5. Add the API key to your environment variables

See [RESEND_SETUP.md](./RESEND_SETUP.md) for detailed setup instructions.

## Development Mode

In development, if `RESEND_API_KEY` is not set, emails will be logged to the console instead of being sent. This allows you to test the flow without configuring Resend.

## User Flow

### Sign Up Flow

1. User visits `/signup`
2. User fills in name, email, and password
3. User clicks "Create Account"
4. Account is created but email is not verified
5. User sees success message: "Check Your Email!"
6. Verification email is sent automatically

### Verification Flow

1. User receives email with verification link
2. User clicks the link (goes to `/api/auth/verify-email?token=...`)
3. Email is verified in the database
4. User is redirected to login page
5. User can now log in with their credentials

### Login Flow

1. User tries to log in with unverified email
2. Better Auth blocks the login and shows error: "Please verify your email before signing in"
3. User can click "Resend Verification Email" to get a new link
4. After verification, user can log in normally

## API Endpoints

### Verify Email (GET)
- **Route**: `/api/auth/verify-email?token={token}`
- **Method**: GET
- **Description**: Verifies the user's email using the token from the email link

### Resend Verification (POST)
- **Route**: `/api/auth/resend-verification`
- **Method**: POST
- **Body**: `{ "email": "user@example.com" }`
- **Description**: Sends a new verification email to the user

## Better Auth Configuration

Email verification is enabled in `src/lib/auth.ts`:

```typescript
emailAndPassword: {
  enabled: true,
  requireEmailVerification: true, // Requires email verification before login
}
```

## Custom Email Plugin

A custom plugin (`src/lib/auth-email-plugin.ts`) intercepts Better Auth's email sending and uses Resend instead. This ensures:
- Consistent email templates
- Resend integration
- Custom verification email design

## Troubleshooting

### Emails Not Sending

1. Check that `RESEND_API_KEY` is set
2. For production: Verify your domain in Resend dashboard
3. For testing: Use `onboarding@resend.dev` as `RESEND_FROM_EMAIL`
4. Check Resend dashboard for email logs and errors
5. In development, check console logs for email content

### Verification Link Not Working

1. Check that `NEXT_PUBLIC_APP_URL` matches your actual URL
2. Verify the token hasn't expired (24 hours)
3. Check that the verification table exists in the database

### User Can't Log In After Verification

1. Check that `emailVerified` is set to `true` in the database
2. Clear browser cookies and try again
3. Check Better Auth logs for errors

## Testing

### Test Email Verification Locally

1. Set `RESEND_API_KEY` in your `.env` file (or leave unset to see console logs)
2. Set `RESEND_FROM_EMAIL=onboarding@resend.dev` for testing (no domain verification needed)
3. Sign up with a test email
4. Check your email inbox (or console logs) for the verification link
5. Click the link to verify
6. Try logging in

### Test Without Resend

In development, if `RESEND_API_KEY` is not set:
- Emails will be logged to the console
- You can copy the verification URL from the console
- Paste it in your browser to test verification

## Security Considerations

- Verification tokens expire after 24 hours
- Tokens are single-use (deleted after verification)
- Tokens are cryptographically secure (random 32-byte hex strings)
- Email verification prevents fake accounts

## Future Enhancements

- Add email verification reminder emails
- Add option to change email address
- Add email verification status to user profile
- Add admin ability to manually verify emails

