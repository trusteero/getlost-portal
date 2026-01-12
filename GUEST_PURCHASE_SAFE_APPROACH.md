# Guest Purchase - Safe, Non-Intrusive Implementation

## Philosophy: Add, Don't Modify

Instead of modifying existing tables and breaking changes, we'll **add new functionality alongside existing code** with minimal risk.

## Strategy: Guest Purchase Table (Separate Table)

### Why This Approach?

1. **Zero Risk to Existing Code**: All existing purchase queries continue to work unchanged
2. **No Schema Changes**: Don't touch the existing `purchases` table
3. **Easy Rollback**: Can delete the new table if needed
4. **Clear Separation**: Guest purchases are clearly separated from authenticated purchases
5. **Gradual Migration**: Can migrate guest purchases to main table later if desired

## Implementation Plan

### Option 1: Separate Guest Purchases Table (RECOMMENDED)

Create a new `guest_purchases` table that mirrors `purchases` but:
- No `userId` field (or nullable)
- Has `guestEmail` field
- Same structure otherwise

**Benefits:**
- Zero impact on existing `purchases` table
- All existing queries unchanged
- Easy to query separately or join when needed
- Can merge into main table later if desired

**Migration:**
```sql
CREATE TABLE guest_purchase (
  id TEXT PRIMARY KEY,
  guestEmail TEXT NOT NULL,
  bookId TEXT REFERENCES books(id),
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

CREATE INDEX guest_purchase_email_idx ON guest_purchase(guestEmail);
CREATE INDEX guest_purchase_status_idx ON guest_purchase(status);
```

### Option 2: System User for Guests (ALTERNATIVE)

Create a special system user (e.g., `guest-user-00000000-0000-0000-0000-000000000000`) and:
- Store guest purchases with this system userId
- Use `guestEmail` field to track actual email
- Link purchases on signup by moving them to real user

**Benefits:**
- No schema changes needed
- Works with existing foreign keys
- All existing queries work (just filter out system user)

**Drawbacks:**
- Requires adding `guestEmail` column (but can be nullable)
- Need to filter system user in queries

### Option 3: Feature Flag + Optional Fields (SAFEST)

Add optional fields to existing table but:
- Make them nullable
- Only use them when feature flag is enabled
- All existing code ignores these fields

**Migration:**
```sql
-- Add nullable columns (safe, doesn't break existing code)
ALTER TABLE purchase ADD COLUMN guestEmail TEXT;
ALTER TABLE purchase ADD COLUMN isGuestPurchase INTEGER DEFAULT 0;

CREATE INDEX purchase_guest_email_idx ON purchase(guestEmail) WHERE isGuestPurchase = 1;
```

**Code Changes:**
- All existing queries add `WHERE isGuestPurchase = 0 OR isGuestPurchase IS NULL`
- Or use a view that filters guest purchases

## Recommended Approach: Option 1 (Separate Table)

### Why This is Safest

1. **No Existing Code Changes**: All current purchase queries work exactly as before
2. **Clear Separation**: Guest purchases are in their own table
3. **Easy Testing**: Can test guest purchases without affecting real purchases
4. **Simple Rollback**: Just delete the table if needed
5. **Future Flexibility**: Can merge tables later or keep separate

### Implementation Structure

```
Existing Flow (Unchanged):
├── purchases table (userId NOT NULL)
├── All existing queries
└── All existing endpoints

New Flow (Separate):
├── guest_purchases table (no userId, has guestEmail)
├── New guest checkout endpoint
├── New landing page
└── Linking on signup (moves from guest_purchases to purchases)
```

## Code Implementation (Non-Intrusive)

### 1. New Guest Purchases Schema

```typescript
// src/server/db/schema.ts
export const guestPurchases = createTable(
  "guest_purchase",
  (d) => ({
    id: d.text({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
    guestEmail: d.text({ length: 255 }).notNull(),
    bookId: d.text({ length: 255 }).references(() => books.id),
    featureType: d.text({ length: 50 }).notNull(),
    amount: d.integer({ mode: "number" }).notNull(),
    currency: d.text({ length: 10 }).notNull().default("USD"),
    paymentMethod: d.text({ length: 50 }),
    paymentIntentId: d.text({ length: 255 }),
    status: d.text({ length: 50 }).notNull().default("pending"),
    completedAt: d.integer({ mode: "timestamp" }),
    createdAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  }),
  (t) => [
    index("guest_purchase_email_idx").on(t.guestEmail),
    index("guest_purchase_status_idx").on(t.status),
  ],
);
```

### 2. New Guest Checkout Endpoint (No Changes to Existing)

```typescript
// src/app/api/checkout/create-guest/route.ts
// Completely new file, doesn't touch existing /api/checkout/create
export async function POST(request: NextRequest) {
  // No session required - completely separate from authenticated flow
  const { email, featureType } = await request.json();
  
  // Create in guest_purchases table (not purchases table)
  const purchaseId = crypto.randomUUID();
  await db.insert(guestPurchases).values({
    id: purchaseId,
    guestEmail: email.toLowerCase().trim(),
    featureType: "book-upload",
    amount: 9999,
    status: "pending",
    // ... rest
  });
  
  // Stripe checkout (same as existing, but different metadata)
  const session = await stripe.checkout.sessions.create({
    // ... config
    metadata: {
      purchaseId,
      guestEmail: email,
      isGuestPurchase: "true", // Flag for webhook
    },
  });
  
  return NextResponse.json({ url: session.url });
}
```

### 3. New Webhook Handler (Separate Logic)

```typescript
// src/app/api/webhooks/stripe/route.ts
// Add new case, don't modify existing logic

case "checkout.session.completed": {
  const session = event.data.object as Stripe.Checkout.Session;
  const isGuestPurchase = session.metadata?.isGuestPurchase === "true";
  
  if (isGuestPurchase) {
    // Handle guest purchase (new code)
    const purchaseId = session.metadata?.purchaseId;
    await db
      .update(guestPurchases)
      .set({
        status: "completed",
        paymentIntentId: session.payment_intent as string,
        completedAt: new Date(),
      })
      .where(eq(guestPurchases.id, purchaseId));
  } else {
    // Existing logic (unchanged)
    // ... existing purchase handling code
  }
}
```

### 4. Purchase Linking on Signup (Moves to Main Table)

```typescript
// src/app/api/auth/signup/route.ts
// Add new function, don't modify existing signup logic

async function linkGuestPurchasesToUser(userId: string, email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Find guest purchases
  const guestPurchases = await db
    .select()
    .from(guestPurchases)
    .where(
      and(
        sql`LOWER(TRIM(guestEmail)) = ${normalizedEmail}`,
        eq(guestPurchases.status, "completed")
      )
    );
  
  if (guestPurchases.length === 0) {
    return [];
  }
  
  // Move guest purchases to main purchases table
  for (const guestPurchase of guestPurchases) {
    // Insert into main purchases table
    await db.insert(purchases).values({
      id: guestPurchase.id,
      userId, // Now has real userId
      bookId: guestPurchase.bookId,
      featureType: guestPurchase.featureType,
      amount: guestPurchase.amount,
      currency: guestPurchase.currency,
      paymentMethod: guestPurchase.paymentMethod,
      paymentIntentId: guestPurchase.paymentIntentId,
      status: guestPurchase.status,
      completedAt: guestPurchase.completedAt,
      createdAt: guestPurchase.createdAt,
      updatedAt: new Date(),
    });
    
    // Delete from guest purchases (or mark as migrated)
    await db
      .delete(guestPurchases)
      .where(eq(guestPurchases.id, guestPurchase.id));
  }
  
  return guestPurchases;
}
```

### 5. Upload Permission Check (Minimal Change)

```typescript
// src/app/api/user/upload-permission/route.ts
// Add one query, keep existing logic

export async function GET(request: NextRequest) {
  // ... existing code to check purchases table
  
  // ALSO check guest purchases (if user just signed up)
  const guestPurchases = await db
    .select()
    .from(guestPurchases)
    .where(
      and(
        sql`LOWER(TRIM(guestEmail)) = ${session.user.email.toLowerCase().trim()}`,
        eq(guestPurchases.status, "completed")
      )
    );
  
  // Count guest purchases too (they'll be linked on next signup/login)
  // Or trigger linking here if not already done
}
```

## Risk Assessment

### Zero Risk Areas (No Changes)
- ✅ Existing `purchases` table
- ✅ Existing checkout endpoint
- ✅ Existing purchase queries
- ✅ Existing webhook logic (just add new case)
- ✅ Existing upload permission logic

### Low Risk Areas (New Code Only)
- ✅ New `guest_purchases` table
- ✅ New guest checkout endpoint
- ✅ New landing page
- ✅ Purchase linking function

### Medium Risk Areas (Minimal Changes)
- ⚠️ Webhook handler (add new case, don't modify existing)
- ⚠️ Signup endpoint (add linking function, don't modify existing flow)
- ⚠️ Upload permission check (add one query, keep existing)

## Rollback Plan

If something goes wrong:

1. **Disable Guest Checkout**: Remove/comment out the landing page
2. **Keep Guest Purchases**: Don't delete the table, just stop creating new ones
3. **Manual Linking**: Can manually link purchases via admin tool
4. **Remove Feature**: Delete new files, keep existing code untouched

## Testing Strategy

### Phase 1: Test New Code Only
- Test guest checkout in isolation
- Test guest purchases table
- Verify no impact on existing purchases

### Phase 2: Test Integration
- Test purchase linking on signup
- Test upload permission with linked purchases
- Verify existing purchases still work

### Phase 3: Test Edge Cases
- Email mismatches
- Multiple purchases
- Webhook timing

## Migration Path (Future)

If we want to merge tables later:

```sql
-- Move guest purchases to main table (one-time migration)
INSERT INTO purchase (id, userId, guestEmail, ...)
SELECT id, NULL, guestEmail, ... FROM guest_purchase
WHERE status = 'completed';

-- Then make userId nullable in purchases table
-- Then update userId for linked purchases
```

## Comparison: Separate Table vs Modified Table

| Aspect | Separate Table | Modified Table |
|--------|---------------|----------------|
| **Risk to Existing Code** | ✅ Zero | ⚠️ Medium |
| **Schema Changes** | ✅ New table only | ⚠️ Modify existing |
| **Query Changes** | ✅ None | ⚠️ Add WHERE clauses |
| **Rollback** | ✅ Easy (delete table) | ⚠️ Harder (revert migration) |
| **Testing** | ✅ Isolated | ⚠️ Test all queries |
| **Complexity** | ✅ Simple | ⚠️ More complex |

## Recommended Implementation Order

1. **Create guest_purchases table** (new migration, zero risk)
2. **Create guest checkout endpoint** (new file, zero risk)
3. **Create landing page** (new file, zero risk)
4. **Add webhook case** (add, don't modify, low risk)
5. **Add purchase linking** (new function, low risk)
6. **Test thoroughly** (verify no regressions)
7. **Deploy** (can disable easily if needed)

## Summary

**This approach is non-intrusive because:**
- ✅ No changes to existing `purchases` table
- ✅ No changes to existing endpoints
- ✅ No changes to existing queries
- ✅ New functionality is completely separate
- ✅ Easy to disable/rollback
- ✅ Can test in isolation

**Risk level: LOW** - Only new code, existing code untouched.

