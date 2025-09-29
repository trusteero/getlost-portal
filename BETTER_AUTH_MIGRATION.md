# Better Auth Migration Guide

## 🎉 Migration Completed!

Your application has been successfully migrated from NextAuth to Better Auth! This provides a more refined, better-supported authentication system with improved TypeScript support and more flexible configuration options.

## 📋 Environment Variables

You need to update your environment variables (`.env.local` for development, `.env` for production):

### Required New Variables

```env
# Better Auth Configuration
BETTER_AUTH_URL=http://localhost:3000  # Change to your production URL in production
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change to your production URL in production
```

### Keep Existing Variables

These variables remain the same:

```env
# Database
DATABASE_URL=./db.sqlite  # Or your database path

# Google OAuth (no changes needed)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Configuration (no changes needed)
EMAIL_FROM=noreply@yourdomain.com
EMAIL_SERVER_USER=your-email-user
EMAIL_SERVER_PASSWORD=your-email-password
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
RESEND_API_KEY=your-resend-api-key

# Admin Configuration (no changes needed)
SUPER_ADMIN_EMAILS=admin@example.com,another@example.com
```

### Variables No Longer Needed

You can remove these NextAuth-specific variables:

```env
NEXTAUTH_SECRET=...  # No longer needed
NEXTAUTH_URL=...     # Replaced by BETTER_AUTH_URL
```

## 🔄 What Changed

### Authentication System
- **From**: NextAuth v5 (beta)
- **To**: Better Auth v1.3.23
- **Benefits**:
  - More stable (not beta)
  - Better TypeScript support
  - Simpler configuration
  - More flexible hooks system
  - Better session management

### Database Schema
- User data has been migrated to Better Auth's schema
- All existing users, passwords, and OAuth accounts preserved
- Foreign key relationships maintained (user IDs unchanged)
- Old NextAuth tables still present but unused (can be removed later)

### Code Changes

1. **Authentication Configuration**
   - Location: `/src/lib/auth.ts` (Better Auth server config)
   - Client: `/src/lib/auth-client.ts` (Better Auth client)

2. **API Routes**
   - Old: `/api/auth/[...nextauth]`
   - New: `/api/auth/[...all]`

3. **Login/Signup Pages**
   - Updated to use Better Auth's `signIn` and `signUp` methods
   - Located in `/src/app/login/page.tsx` and `/src/app/signup/page.tsx`

4. **Middleware**
   - Updated to check Better Auth session cookies
   - Located in `/src/middleware.ts`

5. **Session Management**
   - Server-side: Use `getSession()` from `/src/server/auth/index.ts`
   - Client-side: Use `useSession()` hook from `/src/lib/auth-client.ts`

## ⚠️ Important Notes

1. **All users must log in again** - Sessions from NextAuth are not compatible with Better Auth
2. **Email verification still works** - The same email verification flow is maintained
3. **Google OAuth unchanged** - Users can still sign in with Google using the same credentials
4. **Admin roles preserved** - Super admin and admin roles have been migrated

## 🚀 Deployment Steps

When deploying to production (e.g., Render.com):

1. Update environment variables:
   ```env
   BETTER_AUTH_URL=https://getlostportal.onrender.com
   NEXT_PUBLIC_APP_URL=https://getlostportal.onrender.com
   ```

2. Ensure Google OAuth callback URLs are updated in Google Console:
   - Add: `https://getlostportal.onrender.com/api/auth/callback/google`

3. Database will be automatically migrated on first run

## 🧹 Cleanup (Optional)

After confirming everything works, you can:

1. Remove old NextAuth tables from the database:
   ```sql
   DROP TABLE IF EXISTS getlostportal_account;
   DROP TABLE IF EXISTS getlostportal_session;
   DROP TABLE IF EXISTS getlostportal_user;
   DROP TABLE IF EXISTS getlostportal_verification_token;
   ```

2. Remove NextAuth dependencies from `package.json`:
   ```bash
   npm uninstall next-auth @auth/drizzle-adapter
   ```

## 🔧 Troubleshooting

### Issue: Users can't log in
- **Solution**: Make sure environment variables are set correctly
- Check that `BETTER_AUTH_URL` matches your actual domain

### Issue: Google OAuth not working
- **Solution**: Update callback URLs in Google Console
- New callback URL format: `/api/auth/callback/google`

### Issue: Email verification not sending
- **Solution**: Email configuration remains the same, check SMTP settings

## 📚 Resources

- [Better Auth Documentation](https://better-auth.com)
- [Migration Script](/scripts/migrate-to-better-auth.js)
- [Auth Configuration](/src/lib/auth.ts)

## ✅ Testing Checklist

- [ ] Email/password sign up
- [ ] Email verification
- [ ] Email/password sign in
- [ ] Google OAuth sign in
- [ ] Password reset
- [ ] Session persistence
- [ ] Admin access
- [ ] Protected routes

---

Migration completed on: 2025-09-29
Better Auth version: 1.3.23