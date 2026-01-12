# Guest Purchase Flow - Visual Guide

## Current Flow (Authenticated Only)

```
User (Authenticated)
    ↓
Click "Purchase Upload"
    ↓
POST /api/checkout/create
    ↓
Create Purchase (userId required)
    ↓
Stripe Checkout Session
    ↓
User Pays
    ↓
Webhook: checkout.session.completed
    ↓
Update Purchase Status → "completed"
    ↓
Upload Permission Granted ✅
```

## New Flow (Guest Purchase)

### Step 1: Guest Purchase
```
Anonymous User
    ↓
Visit /purchase-upload (Landing Page)
    ↓
Enter Email + Click "Purchase"
    ↓
POST /api/checkout/create-guest
    ↓
Create Purchase:
  - userId: NULL
  - guestEmail: "user@example.com"
  - status: "pending"
    ↓
Stripe Checkout Session
    ↓
User Pays
    ↓
Webhook: checkout.session.completed
    ↓
Update Purchase Status → "completed"
    ↓
Purchase Linked to Email (not user yet)
```

### Step 2: Signup & Linking
```
User Completes Purchase
    ↓
Redirected to: /signup?purchase_id={id}&email={email}
    ↓
User Signs Up with: "user@example.com"
    ↓
POST /api/auth/signup
    ↓
Create User Account
    ↓
Link Guest Purchases:
  - Find purchases where guestEmail = user.email
  - Update: userId = newUser.id
  - Clear guestEmail (or keep for audit)
    ↓
Check Purchase Status:
  - If "completed" → Grant Upload Permission ✅
  - If "pending" → Wait for webhook
    ↓
Redirect to Dashboard
    ↓
Upload Permission Active! 🎉
```

## Database State Transitions

### Purchase Record Lifecycle

**1. Guest Purchase Created:**
```json
{
  "id": "purchase-123",
  "userId": null,
  "guestEmail": "user@example.com",
  "status": "pending",
  "featureType": "book-upload"
}
```

**2. Payment Completed (Webhook):**
```json
{
  "id": "purchase-123",
  "userId": null,
  "guestEmail": "user@example.com",
  "status": "completed",
  "completedAt": "2025-01-15T10:00:00Z",
  "featureType": "book-upload"
}
```

**3. User Signs Up (Linking):**
```json
{
  "id": "purchase-123",
  "userId": "user-456",
  "guestEmail": null,  // or keep for audit
  "status": "completed",
  "completedAt": "2025-01-15T10:00:00Z",
  "featureType": "book-upload"
}
```

## Email Matching Logic

```typescript
// Case-insensitive, trimmed matching
function matchGuestPurchases(userEmail: string) {
  const normalizedEmail = userEmail.toLowerCase().trim();
  
  return db
    .select()
    .from(purchases)
    .where(
      and(
        isNull(purchases.userId),
        sql`LOWER(TRIM(guestEmail)) = ${normalizedEmail}`
      )
    );
}
```

## Edge Cases Handled

### 1. Email Mismatch
- User purchases with `user@example.com`
- Signs up with `different@example.com`
- **Solution**: Show warning, allow manual claim via purchase ID

### 2. Multiple Purchases
- User makes 3 purchases before signup
- All 3 linked on signup
- All 3 grant upload permissions

### 3. Purchase After Signup
- User already has account
- Makes guest purchase (forgot to login)
- **Solution**: Link on next login if email matches

### 4. Webhook Before Signup
- Payment completes
- Purchase status = "completed"
- User hasn't signed up yet
- **Solution**: Purchase waits with `userId = null`, linked on signup

## API Endpoints Summary

### New Endpoints

**`POST /api/checkout/create-guest`**
- No authentication required
- Accepts: `{ email: string, featureType: "book-upload" }`
- Returns: `{ url: string }` (Stripe checkout URL)

**`GET /purchase-upload`**
- Public landing page
- Shows pricing, features
- Purchase button

### Modified Endpoints

**`POST /api/auth/signup`**
- After user creation, link guest purchases
- Grant permissions if purchases completed

**`POST /api/webhooks/stripe`**
- Handle guest purchases (userId = null)
- Update status normally

**`GET /api/user/upload-permission`**
- Already works (checks completed purchases)
- No changes needed

## Success Scenarios

### Scenario A: Happy Path
1. ✅ Guest purchases with email
2. ✅ Payment completes
3. ✅ User signs up with same email
4. ✅ Purchase linked automatically
5. ✅ Upload permission granted

### Scenario B: Signup Before Payment
1. ✅ Guest purchases with email
2. ✅ User signs up immediately (payment pending)
3. ✅ Purchase linked (status: "pending")
4. ✅ Payment completes via webhook
5. ✅ Upload permission granted

### Scenario C: Email Verification Delay
1. ✅ Guest purchases with email
2. ✅ Payment completes
3. ✅ User signs up (email not verified)
4. ✅ Purchase linked (but permission not granted yet)
5. ✅ Email verified
6. ✅ Upload permission granted

## Error Handling

### Invalid Email
- Validate email format before creating purchase
- Return 400 with error message

### Duplicate Purchase
- Check for existing pending purchase with same email
- Show warning or allow multiple purchases

### Stripe Errors
- Handle payment failures gracefully
- Keep purchase in "pending" status
- Allow retry

### Linking Failures
- Log errors but don't fail signup
- Provide manual linking option
- Support contact for assistance

## Security Considerations

1. **Rate Limiting**: Apply to guest checkout (by IP)
2. **Email Validation**: Server-side validation
3. **Purchase ID**: Use UUIDs, not sequential
4. **Webhook Verification**: Already implemented
5. **Email Matching**: Case-insensitive, SQL injection safe

## Testing Checklist

- [ ] Guest can purchase without account
- [ ] Purchase created with guestEmail
- [ ] Stripe checkout works
- [ ] Webhook processes payment
- [ ] Purchase linked on signup (matching email)
- [ ] Upload permission granted after linking
- [ ] Email mismatch handled gracefully
- [ ] Multiple purchases linked correctly
- [ ] Purchase before email verification works
- [ ] Manual claim via purchase ID works

