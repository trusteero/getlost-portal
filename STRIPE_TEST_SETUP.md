# Stripe Test Setup Guide

## Quick Setup for Testing

> **Tip**: If you want to test without Stripe (simulated purchases), you can either:
> - Don't set Stripe environment variables, OR
> - Set `USE_SIMULATED_PURCHASES=true` in your `.env` file (this forces simulated purchases even if Stripe keys are present)

### Step 1: Get Stripe Test Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Make sure you're in **Test mode** (toggle in top right)
3. Copy your keys:
   - **Publishable key**: `pk_test_...` (starts with `pk_test_`)
   - **Secret key**: `sk_test_...` (starts with `sk_test_`)

### Step 2: Add to Your `.env` File

Add these to your `.env` file in the project root:

```env
# Stripe Test Keys
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE

# Webhook Secret (we'll set this up in Step 4)
# STRIPE_WEBHOOK_SECRET=whsec_...
```

**Important:**
- Don't commit `.env` to git (it should be in `.gitignore`)
- Use `NEXT_PUBLIC_` prefix for the publishable key (needed for client-side)
- Don't use `NEXT_PUBLIC_` for the secret key (server-side only)

### Step 3: Restart Your Dev Server

After adding the keys, restart your dev server:

```bash
npm run dev
```

### Step 4: Set Up Webhook Testing (Local Development)

For local testing, use Stripe CLI to forward webhooks:

#### Install Stripe CLI

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Other platforms:**
See [Stripe CLI Installation](https://stripe.com/docs/stripe-cli)

#### Login to Stripe CLI

```bash
stripe login
```

This will open your browser to authorize the CLI.

#### Forward Webhooks to Local Server

In a **separate terminal**, run:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This will:
- Show you a webhook signing secret (starts with `whsec_`)
- Forward all Stripe events to your local server
- Display webhook events in real-time

**Copy the webhook secret** and add it to your `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
```

Then restart your dev server again.

### Step 5: Test the Flow

1. **Start your dev server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Start Stripe webhook forwarding** (in a separate terminal):
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

3. **Test a purchase**:
   - Go to `http://localhost:3000`
   - Log in
   - Upload a book (or use an existing one)
   - Click "Purchase" on a paid feature (e.g., "Manuscript Report")
   - You should be redirected to Stripe Checkout

4. **Use test card**:
   - Card number: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)

5. **Complete payment**:
   - Click "Pay" in Stripe Checkout
   - You'll be redirected back to your dashboard
   - The feature should be unlocked

### Step 6: Verify It Worked

Check:
- ✅ Feature is unlocked in the dashboard
- ✅ Webhook terminal shows `checkout.session.completed` event
- ✅ Database has a purchase record with `status: "completed"`
- ✅ Database has a `bookFeatures` record with `status: "purchased"`

## Testing Different Scenarios

### Test Successful Payment
- Use card: `4242 4242 4242 4242`
- Should complete successfully

### Test Declined Card
- Use card: `4000 0000 0000 0002`
- Should show decline message

### Test 3D Secure (if enabled)
- Use card: `4000 0027 6000 3184`
- Will require authentication

### Test Insufficient Funds
- Use card: `4000 0000 0000 9995`
- Should show insufficient funds

## Troubleshooting

### "Stripe not configured" Error

**Check:**
1. Environment variables are set in `.env`
2. Dev server was restarted after adding variables
3. Variable names are correct:
   - `STRIPE_SECRET_KEY` (not `STRIPE_SECRET`)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (with `NEXT_PUBLIC_` prefix)
4. `USE_SIMULATED_PURCHASES` is not set to `true` (this forces simulated purchases even with Stripe configured)

### Webhooks Not Working

**Check:**
1. Stripe CLI is running: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
2. Webhook secret is set in `.env`
3. Server was restarted after adding webhook secret
4. Check server logs for webhook errors

### Payment Completes But Feature Not Unlocked

**Check:**
1. Webhook is receiving events (check Stripe CLI terminal)
2. Webhook handler is working (check server logs)
3. Database is accessible
4. Check `purchases` table for the purchase record
5. Check `bookFeatures` table for the feature record

### Can't See Stripe Checkout

**Check:**
1. Checkout endpoint is accessible: `POST /api/checkout/create`
2. Check browser console for errors
3. Check server logs for checkout creation errors
4. Verify Stripe keys are correct (test keys start with `sk_test_` and `pk_test_`)

## Quick Test Checklist

- [ ] Stripe test keys added to `.env`
- [ ] Dev server restarted
- [ ] Stripe CLI installed and logged in
- [ ] Webhook forwarding running (`stripe listen`)
- [ ] Webhook secret added to `.env`
- [ ] Dev server restarted again (after webhook secret)
- [ ] Tested a purchase with test card `4242 4242 4242 4242`
- [ ] Payment completed successfully
- [ ] Feature unlocked in dashboard
- [ ] Webhook event received in Stripe CLI terminal

## Next Steps

Once testing works:
1. Test all payment scenarios (success, decline, etc.)
2. Test webhook retries (stop server, send event, restart server)
3. Test error handling
4. Set up production keys when ready
5. Configure production webhook endpoint in Stripe Dashboard

