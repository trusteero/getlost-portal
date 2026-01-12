# Guest Purchase Implementation Roadmap

## Quick Summary

**Goal**: Allow users to purchase upload permissions via Stripe **before** signing up, then automatically link the purchase to their account when they sign up.

## Key Changes Required

### 1. Database Schema (Critical)
- Make `userId` nullable in `purchases` table
- Add `guestEmail` column to track purchases by email
- Add index on `guestEmail` for fast lookups
- Update foreign key constraint to allow NULL userId

### 2. New Landing Page
- Public route: `/purchase-upload`
- No authentication required
- Stripe checkout button
- Clear pricing and messaging

### 3. Guest Checkout Endpoint
- New: `POST /api/checkout/create-guest`
- No authentication required
- Accepts email in request body
- Creates purchase with `userId: null, guestEmail: email`

### 4. Purchase Linking on Signup
- Modify: `POST /api/auth/signup`
- After user creation, find purchases by email
- Link purchases to new user account
- Grant permissions if purchases are completed

### 5. Webhook Updates
- Modify: `POST /api/webhooks/stripe`
- Handle purchases with `userId: null`
- Update status normally (purchase waits for linking)

## Implementation Order

### Phase 1: Database Migration (Foundation)
**Priority: CRITICAL**

1. Create migration to:
   - Make `userId` nullable
   - Add `guestEmail` column
   - Add index on `guestEmail`
   - Update foreign key constraint

**Files to modify:**
- `src/server/db/schema.ts` - Update purchases table definition
- Create new migration file in `drizzle/` folder

**Testing:**
- Verify migration runs successfully
- Test that existing purchases still work
- Verify NULL userId is allowed

### Phase 2: Guest Checkout Endpoint
**Priority: HIGH**

1. Create `src/app/api/checkout/create-guest/route.ts`
2. Similar to existing checkout, but:
   - No session required
   - Accepts `email` in body
   - Creates purchase with `userId: null, guestEmail: email`
   - Stripe metadata includes `guestEmail`

**Files to create:**
- `src/app/api/checkout/create-guest/route.ts`

**Files to reference:**
- `src/app/api/checkout/create/route.ts` (existing implementation)

**Testing:**
- Test guest checkout without authentication
- Verify purchase created with guestEmail
- Test Stripe checkout session creation

### Phase 3: Landing Page
**Priority: HIGH**

1. Create `src/app/purchase-upload/page.tsx`
2. Public page (no auth required)
3. Shows pricing, features
4. Email input + purchase button
5. Calls guest checkout endpoint

**Files to create:**
- `src/app/purchase-upload/page.tsx`

**Design considerations:**
- Clear value proposition
- Trust indicators
- Simple, conversion-focused

### Phase 4: Purchase Linking
**Priority: HIGH**

1. Modify `src/app/api/auth/signup/route.ts`
2. After user creation:
   - Find purchases where `guestEmail = user.email` (case-insensitive)
   - Update purchases: set `userId = user.id`, clear `guestEmail`
   - If any purchases are `completed`, grant upload permission

**Files to modify:**
- `src/app/api/auth/signup/route.ts`

**Helper function to create:**
```typescript
async function linkGuestPurchasesToUser(userId: string, email: string) {
  // Find purchases with matching email
  // Update userId
  // Return linked purchases
}
```

**Testing:**
- Test signup with matching email
- Test signup with different email
- Test multiple purchases linking
- Test permission granting

### Phase 5: Webhook Updates
**Priority: MEDIUM**

1. Modify `src/app/api/webhooks/stripe/route.ts`
2. Handle purchases with `userId: null`
3. Update status normally (purchase can be completed before user signs up)

**Files to modify:**
- `src/app/api/webhooks/stripe/route.ts`

**Testing:**
- Test webhook with guest purchase
- Verify status updates correctly
- Test purchase completion before signup

### Phase 6: Signup Flow Enhancement
**Priority: MEDIUM**

1. Modify `src/app/signup/page.tsx`
2. Check URL params for `purchase_id` and `email`
3. Show messaging: "Complete your account to access your purchase"
4. Pre-fill email if provided

**Files to modify:**
- `src/app/signup/page.tsx`

**Testing:**
- Test redirect from Stripe checkout
- Test email pre-fill
- Test purchase linking message

### Phase 7: Edge Cases & Polish
**Priority: LOW**

1. Email mismatch handling
2. Manual purchase claim page (optional)
3. Error messages
4. Success messaging
5. Analytics tracking

## Database Migration Example

```typescript
// In src/server/db/schema.ts
export const purchases = createTable(
  "purchase",
  (d) => ({
    id: d.text({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: d.text({ length: 255 }).references(() => users.id), // NOW NULLABLE
    guestEmail: d.text({ length: 255 }), // NEW FIELD
    bookId: d.text({ length: 255 }).references(() => books.id),
    // ... rest of fields
  }),
  (t) => [
    index("purchase_user_idx").on(t.userId),
    index("purchase_guest_email_idx").on(t.guestEmail), // NEW INDEX
    // ... rest of indexes
  ],
);
```

**Migration SQL (for existing databases):**
```sql
-- Make userId nullable
ALTER TABLE purchase ADD COLUMN guestEmail TEXT;
CREATE INDEX purchase_guest_email_idx ON purchase(guestEmail);

-- Note: SQLite doesn't support MODIFY COLUMN directly
-- Need to recreate table or use a migration script
```

## Code Snippets

### Guest Checkout Endpoint
```typescript
// src/app/api/checkout/create-guest/route.ts
export async function POST(request: NextRequest) {
  // No session required!
  const { email, featureType } = await request.json();
  
  // Validate email
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  
  // Create purchase with guestEmail
  const purchaseId = crypto.randomUUID();
  await db.insert(purchases).values({
    id: purchaseId,
    userId: null, // NULL for guest
    guestEmail: email.toLowerCase().trim(),
    featureType: "book-upload",
    amount: 9999,
    status: "pending",
    // ... other fields
  });
  
  // Create Stripe checkout
  const session = await stripe.checkout.sessions.create({
    // ... checkout config
    metadata: {
      guestEmail: email,
      purchaseId,
      featureType: "book-upload",
    },
    success_url: `${baseURL}/signup?purchase_id=${purchaseId}&email=${encodeURIComponent(email)}`,
  });
  
  return NextResponse.json({ url: session.url });
}
```

### Purchase Linking Function
```typescript
// In src/app/api/auth/signup/route.ts
async function linkGuestPurchasesToUser(userId: string, email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Find all guest purchases with matching email
  const guestPurchases = await db
    .select()
    .from(purchases)
    .where(
      and(
        isNull(purchases.userId),
        sql`LOWER(TRIM(guestEmail)) = ${normalizedEmail}`
      )
    );
  
  if (guestPurchases.length === 0) {
    return [];
  }
  
  // Link all purchases to user
  for (const purchase of guestPurchases) {
    await db
      .update(purchases)
      .set({
        userId,
        guestEmail: null, // Clear guest email
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, purchase.id));
  }
  
  console.log(`[Signup] Linked ${guestPurchases.length} guest purchase(s) to user ${userId}`);
  
  return guestPurchases;
}
```

## Testing Checklist

### Unit Tests
- [ ] Guest checkout creates purchase with guestEmail
- [ ] Purchase linking matches email correctly
- [ ] Case-insensitive email matching
- [ ] Multiple purchases linking
- [ ] Permission granting after linking

### Integration Tests
- [ ] Full guest purchase flow
- [ ] Signup with matching email
- [ ] Signup with different email
- [ ] Webhook processing guest purchases
- [ ] Upload permission after signup

### Edge Cases
- [ ] Email mismatch
- [ ] Multiple purchases
- [ ] Purchase before email verification
- [ ] Abandoned purchases
- [ ] Stripe errors

## Security Considerations

1. **Rate Limiting**: Apply to guest checkout (by IP, not user)
2. **Email Validation**: Server-side validation, prevent injection
3. **Purchase ID**: Use UUIDs, not sequential
4. **Webhook Verification**: Already implemented
5. **Email Matching**: Case-insensitive, SQL injection safe

## Success Metrics

- Conversion rate: Guest purchases → Signups
- Time to signup after purchase
- Purchase linking success rate
- Support tickets for unlinked purchases

## Estimated Timeline

- **Phase 1 (Database)**: 2-4 hours
- **Phase 2 (Guest Checkout)**: 3-5 hours
- **Phase 3 (Landing Page)**: 4-6 hours
- **Phase 4 (Purchase Linking)**: 3-4 hours
- **Phase 5 (Webhook)**: 1-2 hours
- **Phase 6 (Signup Flow)**: 2-3 hours
- **Phase 7 (Polish)**: 2-4 hours

**Total**: ~18-28 hours

## Dependencies

- Existing Stripe integration (already implemented)
- Existing purchase system (already implemented)
- Database migration system (already implemented)

## Risks & Mitigations

### Risk: Email Mismatch
- **Mitigation**: Show warning, allow manual claim

### Risk: Abandoned Purchases
- **Mitigation**: Keep purchases for 90 days, send reminders

### Risk: Database Migration Issues
- **Mitigation**: Test migration on copy of production data first

### Risk: Webhook Timing
- **Mitigation**: Purchase can be completed before or after signup, both work

## Next Steps

1. Review this document with team
2. Create database migration
3. Implement guest checkout endpoint
4. Create landing page
5. Add purchase linking to signup
6. Test end-to-end flow
7. Deploy to staging
8. Test with real Stripe payments
9. Deploy to production

## Questions to Resolve

1. Should we allow multiple guest purchases with same email?
2. How long should we keep unlinked purchases?
3. Should we send reminder emails for unlinked purchases?
4. Should we create a manual claim page for purchase IDs?
5. What happens if user signs up with different email?

## Related Documents

- `GUEST_PURCHASE_ANALYSIS.md` - Detailed technical analysis
- `GUEST_PURCHASE_FLOW.md` - Visual flow diagrams
- `STRIPE_SETUP.md` - Stripe configuration
- `STRIPE_INTEGRATION_GUIDE.md` - Existing Stripe integration

