# Guest Purchase Feature Analysis

## Overview
Allow users to purchase upload permissions via Stripe **before** signing up, then automatically link the purchase to their account when they sign up.

## Current System Architecture

### Database Schema
- **`purchases` table**: 
  - `userId` is **NOT NULL** with foreign key to `users.id`
  - Requires authenticated user to create purchase
  - `bookId` is nullable (for user-level purchases like `book-upload`)

### Current Purchase Flow
1. User must be authenticated (`session.user.id` required)
2. Purchase record created with `userId`
3. Stripe checkout session created with `userId` in metadata
4. Webhook processes payment completion
5. Purchase status updated to `completed`
6. Upload permission granted based on completed purchases

### Current Checkout Endpoint
- **`POST /api/checkout/create`**
  - Requires authentication
  - Creates purchase with `userId`
  - Returns Stripe checkout URL

## Required Changes

### 1. Database Schema Changes

**Option A: Make `userId` nullable (Recommended)**
```sql
-- Migration: Allow nullable userId for guest purchases
ALTER TABLE purchase MODIFY COLUMN userId TEXT NULL;
-- Remove foreign key constraint temporarily, add back with ON DELETE SET NULL
```

**Option B: Add `guestEmail` field**
```sql
-- Add guest email tracking
ALTER TABLE purchase ADD COLUMN guestEmail TEXT NULL;
-- Index for email lookups
CREATE INDEX purchase_guest_email_idx ON purchase(guestEmail);
```

**Recommended: Option A + Option B**
- Make `userId` nullable
- Add `guestEmail` field
- Add index on `guestEmail`
- This allows:
  - Guest purchases (userId = NULL, guestEmail = email)
  - Authenticated purchases (userId = id, guestEmail = NULL)
  - Easy matching during signup

### 2. New Landing Page

**Route: `/purchase-upload` or `/buy-upload`**

Features:
- Public page (no authentication required)
- Stripe checkout button
- Clear pricing
- "Sign up after purchase" messaging

### 3. Guest Checkout Endpoint

**New: `POST /api/checkout/create-guest`**

Differences from authenticated checkout:
- No session required
- Accepts `email` in request body
- Creates purchase with:
  - `userId: NULL`
  - `guestEmail: email`
  - `status: "pending"`
- Stripe checkout session metadata includes:
  - `guestEmail: email`
  - `purchaseId: purchaseId`
  - `featureType: "book-upload"`
- Success URL: `/signup?purchase_id={purchaseId}&email={email}`

### 4. Purchase Linking on Signup

**Modify: `POST /api/auth/signup`**

After user creation:
1. Check for purchases with `guestEmail` matching new user's email
2. Update those purchases:
   - Set `userId` to new user's ID
   - Clear `guestEmail` (or keep for audit trail)
3. If any purchases are `completed`, grant upload permission immediately

**Alternative: Separate endpoint**
- `POST /api/user/link-guest-purchases`
- Called after signup/login
- Matches purchases by email

### 5. Webhook Updates

**Modify: `POST /api/webhooks/stripe`**

Handle guest purchases:
- If `userId` is NULL, check `guestEmail` in metadata
- Update purchase status normally
- Purchase remains linked to email until user signs up

### 6. Email Matching Strategy

**Challenges:**
- User might sign up with different email than checkout email
- Case sensitivity
- Email verification timing

**Solutions:**
1. **Case-insensitive matching**: `LOWER(email) = LOWER(guestEmail)`
2. **Stripe customer email**: Use Stripe session's `customer_email` as source of truth
3. **Manual linking option**: Allow users to claim purchases via purchase ID
4. **Email verification**: Only link after email is verified

**Recommended Flow:**
1. User purchases with email: `user@example.com`
2. Purchase stored with `guestEmail: "user@example.com"`
3. User signs up with `user@example.com`
4. On signup (or email verification), match purchases
5. Link purchases to user account

### 7. Success Flow

**After Guest Purchase:**
1. User completes Stripe checkout
2. Redirected to: `/signup?purchase_id={id}&email={email}`
3. Signup page shows: "Complete your account to access your purchase"
4. User signs up with same email
5. Purchases automatically linked
6. Upload permission granted immediately

**After Signup:**
1. Check URL params for `purchase_id`
2. Verify purchase exists and matches email
3. Link purchase to user
4. If purchase is completed, grant permission
5. Redirect to dashboard with success message

## Implementation Plan

### Phase 1: Database Schema
1. Create migration to:
   - Make `userId` nullable
   - Add `guestEmail` column
   - Add index on `guestEmail`
   - Update foreign key constraint

### Phase 2: Guest Checkout
1. Create `/api/checkout/create-guest` endpoint
2. Create `/purchase-upload` landing page
3. Update Stripe checkout success URL

### Phase 3: Purchase Linking
1. Update signup endpoint to link guest purchases
2. Create purchase linking utility function
3. Handle email verification timing

### Phase 4: Webhook Updates
1. Update webhook to handle guest purchases
2. Store Stripe customer email in purchase record

### Phase 5: UI/UX
1. Landing page design
2. Signup flow with purchase context
3. Success messaging
4. Error handling (email mismatch, etc.)

## Edge Cases & Considerations

### 1. Email Mismatch
- User purchases with `user@example.com`
- Signs up with `different@example.com`
- **Solution**: 
  - Show warning during signup
  - Allow manual purchase ID entry
  - Support email for manual linking

### 2. Multiple Guest Purchases
- User makes multiple purchases before signup
- **Solution**: Link all matching purchases on signup

### 3. Purchase Before Email Verification
- User signs up but email not verified
- **Solution**: Link purchases after email verification

### 4. Expired/Abandoned Purchases
- User purchases but never signs up
- **Solution**: 
  - Keep purchases for 90 days
  - Send reminder emails
  - Allow manual claim via purchase ID

### 5. Stripe Customer Creation
- Stripe creates customer with email
- **Solution**: Use Stripe customer email as source of truth

## Security Considerations

1. **Rate Limiting**: Apply to guest checkout endpoint
2. **Email Validation**: Validate email format
3. **Purchase ID Security**: Use UUIDs, not sequential IDs
4. **Webhook Verification**: Already implemented
5. **Email Matching**: Case-insensitive, trimmed

## Testing Strategy

1. **Guest Purchase Flow**:
   - Purchase without account
   - Verify purchase created with guestEmail
   - Complete Stripe checkout
   - Verify webhook processes payment

2. **Signup Linking**:
   - Sign up with matching email
   - Verify purchases linked
   - Verify upload permission granted

3. **Edge Cases**:
   - Email mismatch
   - Multiple purchases
   - Purchase before email verification
   - Abandoned purchases

## Database Migration Example

```typescript
// Migration: Add guest purchase support
export async function up(db: Database) {
  // Make userId nullable
  await db.exec(`
    CREATE TABLE purchase_new (
      id TEXT PRIMARY KEY,
      userId TEXT REFERENCES users(id) ON DELETE SET NULL,
      guestEmail TEXT,
      bookId TEXT REFERENCES books(id) ON DELETE SET NULL,
      featureType TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      paymentMethod TEXT,
      paymentIntentId TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      completedAt INTEGER,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
    );
    
    INSERT INTO purchase_new SELECT * FROM purchase;
    DROP TABLE purchase;
    ALTER TABLE purchase_new RENAME TO purchase;
    
    CREATE INDEX purchase_guest_email_idx ON purchase(guestEmail);
    CREATE INDEX purchase_user_idx ON purchase(userId);
  `);
}
```

## API Endpoints Summary

### New Endpoints
- `POST /api/checkout/create-guest` - Guest checkout (no auth)
- `GET /purchase-upload` - Landing page
- `POST /api/user/link-guest-purchases` - Manual linking (optional)

### Modified Endpoints
- `POST /api/auth/signup` - Link guest purchases on signup
- `POST /api/webhooks/stripe` - Handle guest purchases
- `GET /api/user/upload-permission` - Check permission (already handles completed purchases)

## Success Metrics

1. Conversion rate: Guest purchases → Signups
2. Time to signup after purchase
3. Purchase linking success rate
4. Support tickets for unlinked purchases

## Future Enhancements

1. **Purchase ID Claim Page**: Allow users to claim purchases manually
2. **Email Reminders**: Remind users to sign up after purchase
3. **Social Login**: Link purchases via OAuth email
4. **Purchase History**: Show guest purchases before signup

