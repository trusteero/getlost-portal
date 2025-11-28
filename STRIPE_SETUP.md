# Stripe Integration Setup

## Overview

The GetLost Portal now supports **optional** Stripe integration for payments. If Stripe is not configured, the system will automatically use simulated purchases (for testing/demo purposes).

## Configuration

### Option 1: Use Stripe (Production/Real Payments)

Add these environment variables to your `.env` file:

```bash
# Stripe Secret Key (server-side only)
STRIPE_SECRET_KEY=sk_test_...  # or sk_live_... for production

# Stripe Publishable Key (client-side)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # or pk_live_... for production

# Webhook Secret (for verifying webhook events)
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Option 2: Use Simulated Purchases (Testing/Demo)

**Method A: Don't set Stripe variables**

Simply **don't** set the Stripe environment variables. The system will automatically:
- Use simulated purchases (no real payment)
- Mark purchases as completed immediately
- Use `paymentMethod: "simulated"` in the database

**Method B: Force simulated purchases (even with Stripe configured)**

Add this environment variable to force simulated purchases, even if Stripe keys are present:

```bash
# Force simulated purchases (useful for testing)
USE_SIMULATED_PURCHASES=true
```

This is useful when:
- You have Stripe keys configured but want to test without real payments
- You want to quickly switch between Stripe and simulated purchases
- You're doing development/testing and don't want to process payments

## How It Works

### With Stripe Configured

1. User clicks "Purchase" on a paid feature
2. System creates a Stripe Checkout Session
3. User is redirected to Stripe's payment page
4. After payment, Stripe webhook updates the purchase status
5. User is redirected back to dashboard
6. Feature is unlocked

### Without Stripe (Simulated)

1. User clicks "Purchase" on a paid feature
2. System immediately completes the purchase (simulated)
3. Feature is unlocked instantly
4. Purchase is marked as `paymentMethod: "simulated"`

## API Endpoints

### Create Checkout Session
**POST** `/api/checkout/create`
- Creates a Stripe checkout session for paid features
- Returns `503` if Stripe is not configured (triggers simulated purchase)

### Stripe Webhook
**POST** `/api/webhooks/stripe`
- Handles Stripe webhook events
- Updates purchase status when payment completes
- Unlocks features automatically

### Feature Purchase (Direct)
**POST** `/api/books/[id]/features/[featureType]`
- For free features: unlocks immediately
- For paid features with Stripe: returns `402 Payment Required` (redirects to checkout)
- For paid features without Stripe: completes simulated purchase

## Testing

### Stripe Test Mode

1. Get test keys from [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Use test card: `4242 4242 4242 4242`
3. Any future expiry date, any CVC
4. Use Stripe CLI for webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

### Simulated Mode

1. Don't set Stripe environment variables
2. All purchases complete instantly
3. No payment processing required
4. Perfect for development and demos

## Frontend Flow

The frontend automatically detects if Stripe is available:

```typescript
// In manuscript-card.tsx
const checkoutResponse = await fetch('/api/checkout/create', {
  method: 'POST',
  body: JSON.stringify({ bookId, featureType }),
});

if (checkoutResponse.ok) {
  // Stripe available, redirect to checkout
  const { url } = await checkoutResponse.json();
  window.location.href = url;
} else if (checkoutResponse.status === 503) {
  // Stripe not configured, use simulated purchase
  await handleUnlockFeature(featureType);
}
```

## Database

Purchases are tracked in the `purchases` table:
- `paymentMethod`: `"stripe"` or `"simulated"`
- `status`: `"pending"`, `"completed"`, or `"failed"`
- `paymentIntentId`: Stripe payment intent ID (if using Stripe)

## Security

1. **Webhook Verification**: All webhook events are verified using the webhook secret
2. **Server-Side Only**: Stripe secret keys are never exposed to the client
3. **Idempotency**: Webhook handlers are idempotent (safe to retry)

## Switching Between Modes

You can switch between Stripe and simulated purchases at any time:

- **Enable Stripe**: Add Stripe environment variables and restart the server
- **Disable Stripe**: Remove Stripe environment variables and restart the server
- **Force Simulated (even with Stripe)**: Set `USE_SIMULATED_PURCHASES=true` and restart the server

The system automatically detects which mode to use based on environment variables:
1. If `USE_SIMULATED_PURCHASES=true`, always use simulated purchases
2. If Stripe keys are present and `USE_SIMULATED_PURCHASES` is not set, use Stripe
3. If Stripe keys are not present, use simulated purchases

## Production Deployment

1. Get production Stripe keys from [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Set up webhook endpoint in Stripe Dashboard:
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_failed`
3. Add webhook secret to environment variables
4. Test with real payments (use small amounts first)

## Troubleshooting

### Webhooks Not Working

1. Check webhook secret is correct
2. Verify webhook URL is accessible
3. Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
4. Check server logs for webhook errors

### Payments Not Completing

1. Check Stripe Dashboard for payment status
2. Verify webhook is receiving events
3. Check database for purchase records
4. Review server logs for errors

### Simulated Purchases Not Working

1. Ensure Stripe environment variables are **not** set
2. Check server logs for errors
3. Verify purchase endpoint is accessible
4. Check database for purchase records

