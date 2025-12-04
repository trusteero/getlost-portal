# Example Books Creation Fix

## Problem
Example books were not being created for new users when they signed up.

## Root Causes Identified

1. **Wrong property name**: Code was checking `account?.providerId` instead of `account?.provider`
2. **Timing issues**: For new OAuth users, the user record might be created before the account record
3. **Logic complexity**: The code tried to detect "new" vs "existing" users, but OAuth users are always "existing" by the time the callback runs

## Solution

### Changes Made

1. **Fixed provider check**: Changed from `providerId` to `provider` (NextAuth uses `provider`)
2. **Improved OAuth detection**: Check both the `account` object and the `accounts` table
3. **Always attempt creation**: For OAuth users, always call `createExampleBooksForUser()` - the function itself checks if books already exist
4. **Better logging**: Added console logs to help debug when books are created or skipped

### How It Works Now

1. **For OAuth Users (Google)**:
   - When they sign in, we check if they have a Google account (from `account` object or `accounts` table)
   - If yes, we call `createExampleBooksForUser()` which will:
     - Check if they already have example books
     - If not, create "Wool" and "Beach Read" example books
     - Skip if books already exist

2. **For Credentials Users**:
   - Example books are created when they verify their email (in `/api/auth/verify-email` route)

3. **Manual Creation**:
   - Use the script: `npx tsx scripts/create-example-books-for-user.ts <email>`

## Debugging

Check server logs for:
- `[Auth] Google OAuth user detected - creating example books...`
- `[Example Books] Creating example books for user...`
- `[Example Books] User already has example books, skipping creation`

If books aren't being created:
1. Check if the user is detected as OAuth user in logs
2. Check for any errors in the logs
3. Manually create books using the script
4. Verify the user has a Google account in the `accounts` table

## Testing

To test with a new user:
1. Sign up with Google OAuth
2. Check server logs for creation messages
3. Verify books appear in the UI
4. Sign in again - should see "already has example books" message

