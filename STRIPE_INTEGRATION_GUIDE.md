# Stripe Integration Guide

## Overview

This guide explains how to integrate Stripe payments for feature purchases in the GetLost Portal.

## Current Flow

1. User clicks "Purchase" button on a feature
2. Confirmation dialog appears
3. User confirms → POST `/api/books/[id]/features/[featureType]`
4. Purchase is auto-completed (no payment processing)

## Stripe Integration Flow

### 1. Install Stripe

```bash
npm install stripe @stripe/stripe-js
```

### 2. Environment Variables

Add to `.env`:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 3. Create Checkout Session API Route

**File: `src/app/api/checkout/create/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, purchases } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

const FEATURE_PRICES: Record<string, number> = {
  "summary": 0,
  "manuscript-report": 14999, // $149.99
  "marketing-assets": 14999,
  "book-covers": 14999,
  "landing-page": 14999,
};

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { bookId, featureType } = await request.json();

    // Verify book ownership
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    if (!book || book.userId !== session.user.id) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const price = FEATURE_PRICES[featureType] ?? 0;

    // Free features don't need payment
    if (price === 0) {
      return NextResponse.json({ 
        error: "This feature is free. Use the direct unlock endpoint." 
      }, { status: 400 });
    }

    // Create purchase record with pending status
    const purchaseId = crypto.randomUUID();
    await db.insert(purchases).values({
      id: purchaseId,
      userId: session.user.id,
      bookId,
      featureType,
      amount: price,
      currency: "USD",
      paymentMethod: "stripe",
      status: "pending",
    });

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: getFeatureName(featureType),
              description: `Purchase ${getFeatureName(featureType)} for "${book.title}"`,
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${request.nextUrl.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}&purchase_id=${purchaseId}`,
      cancel_url: `${request.nextUrl.origin}/dashboard/book/${bookId}`,
      client_reference_id: purchaseId,
      metadata: {
        userId: session.user.id,
        bookId,
        featureType,
        purchaseId,
      },
    });

    return NextResponse.json({ 
      sessionId: checkoutSession.id,
      url: checkoutSession.url 
    });
  } catch (error) {
    console.error("Failed to create checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

function getFeatureName(featureType: string): string {
  const names: Record<string, string> = {
    "manuscript-report": "Manuscript Report",
    "marketing-assets": "Marketing Assets",
    "book-covers": "Book Covers",
    "landing-page": "Landing Page",
  };
  return names[featureType] || featureType;
}
```

### 4. Webhook Handler

**File: `src/app/api/webhooks/stripe/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/server/db";
import { purchases, bookFeatures } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const purchaseId = session.client_reference_id || session.metadata?.purchaseId;

        if (!purchaseId) {
          console.error("No purchase ID in session");
          break;
        }

        // Update purchase status
        await db
          .update(purchases)
          .set({
            status: "completed",
            paymentIntentId: session.payment_intent as string,
            completedAt: new Date(),
          })
          .where(eq(purchases.id, purchaseId));

        // Get purchase details
        const [purchase] = await db
          .select()
          .from(purchases)
          .where(eq(purchases.id, purchaseId))
          .limit(1);

        if (purchase) {
          // Create or update feature record
          const existingFeature = await db
            .select()
            .from(bookFeatures)
            .where(
              and(
                eq(bookFeatures.bookId, purchase.bookId),
                eq(bookFeatures.featureType, purchase.featureType)
              )
            )
            .limit(1);

          if (existingFeature.length > 0) {
            await db
              .update(bookFeatures)
              .set({
                status: "purchased",
                unlockedAt: new Date(),
                purchasedAt: new Date(),
                price: purchase.amount,
                updatedAt: new Date(),
              })
              .where(eq(bookFeatures.id, existingFeature[0]!.id));
          } else {
            await db.insert(bookFeatures).values({
              bookId: purchase.bookId,
              featureType: purchase.featureType,
              status: "purchased",
              unlockedAt: new Date(),
              purchasedAt: new Date(),
              price: purchase.amount,
            });
          }
        }

        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const purchaseId = session.client_reference_id || session.metadata?.purchaseId;

        if (purchaseId) {
          await db
            .update(purchases)
            .set({ status: "failed" })
            .where(eq(purchases.id, purchaseId));
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
```

### 5. Update Purchase Flow in Frontend

**File: `src/components/manuscript-card.tsx`**

Update `handleConfirmPurchase`:

```typescript
const handleConfirmPurchase = async () => {
  if (!pendingFeature) return;
  
  const featureId = pendingFeature.id;
  
  try {
    // Create Stripe checkout session
    const response = await fetch('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId: id,
        featureType: featureId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { url } = await response.json();
    
    // Redirect to Stripe Checkout
    window.location.href = url;
  } catch (error) {
    console.error('Failed to initiate payment:', error);
    alert('Failed to start payment. Please try again.');
  } finally {
    setShowPurchaseDialog(false);
    setPendingFeature(null);
  }
};
```

### 6. Handle Return from Stripe

**File: `src/app/dashboard/page.tsx`**

Add to `useEffect`:

```typescript
useEffect(() => {
  // Check for Stripe return
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  const purchaseId = params.get('purchase_id');

  if (sessionId && purchaseId) {
    // Payment was successful, refresh books
    fetchBooks();
    
    // Clean up URL
    window.history.replaceState({}, '', '/dashboard');
    
    // Show success message
    // You can add a toast notification here
  }
}, []);
```

### 7. Update Existing Purchase Endpoint

**File: `src/app/api/books/[id]/features/[featureType]/route.ts`**

Keep the POST endpoint for free features, but for paid features, redirect to checkout:

```typescript
const price = FEATURE_PRICES[featureType] ?? 0;

// For paid features, redirect to Stripe Checkout
if (price > 0) {
  return NextResponse.json(
    { 
      error: "Payment required",
      redirectToCheckout: true,
      price 
    },
    { status: 402 } // Payment Required
  );
}

// For free features, continue with existing logic...
```

## Testing

### Test Mode
- Use Stripe test keys (`sk_test_...`, `pk_test_...`)
- Use test card: `4242 4242 4242 4242`
- Any future expiry date, any CVC

### Webhook Testing
- Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- Or use Stripe Dashboard webhook testing

## Security Considerations

1. **Webhook Verification**: Always verify webhook signatures
2. **Server-Side Only**: Never expose secret keys to client
3. **Idempotency**: Handle duplicate webhook events
4. **Error Handling**: Log failures and notify admins
5. **Refunds**: Implement refund handling if needed

## Database Schema

The existing `purchases` table already has the necessary fields:
- `paymentMethod`: "stripe"
- `paymentIntentId`: Stripe payment intent ID
- `status`: "pending", "completed", "failed", "refunded"

## Next Steps

1. Install Stripe package
2. Add environment variables
3. Create checkout session endpoint
4. Create webhook handler
5. Update frontend purchase flow
6. Test with Stripe test mode
7. Deploy and configure production webhook

