# Stripe Integration Troubleshooting Guide

## 🔍 Common Issues & Fixes

### Issue 1: "Failed to create checkout session"

**Symptoms:**
- Error when clicking "Purchase" button
- Console shows checkout creation errors
- Users can't proceed to payment

**Possible Causes:**
1. **Stripe API keys not configured**
   - Check: `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are set
   - Verify keys start with `sk_` and `pk_` respectively

2. **Invalid API keys**
   - Test keys must start with `sk_test_` and `pk_test_`
   - Live keys must start with `sk_live_` and `pk_live_`
   - Keys must match (both test or both live)

3. **API version mismatch**
   - Fixed: Now using `2024-11-20.acacia`
   - Check server logs for API version errors

**Solution:**
```bash
# Verify environment variables are set
echo $STRIPE_SECRET_KEY
echo $NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

# Check Render dashboard environment variables
# Go to: Service → Environment → Verify Stripe keys are set
```

---

### Issue 2: "Stripe not configured" error

**Symptoms:**
- Always falls back to simulated purchases
- Never redirects to Stripe checkout

**Possible Causes:**
1. **Environment variables not set in Render**
   - Variables must be set in Render dashboard
   - Local `.env` doesn't apply to Render

2. **Variable names incorrect**
   - Must be: `STRIPE_SECRET_KEY` (not `STRIPE_API_KEY`)
   - Must be: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (with `NEXT_PUBLIC_` prefix)

3. **USE_SIMULATED_PURCHASES is set**
   - If `USE_SIMULATED_PURCHASES=true`, Stripe is disabled
   - Remove or set to `false`

**Solution:**
1. Go to Render dashboard → Your service → Environment
2. Verify these variables are set:
   - `STRIPE_SECRET_KEY=sk_test_...` (or `sk_live_...`)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` (or `pk_live_...`)
3. Remove or unset `USE_SIMULATED_PURCHASES`
4. Redeploy service

---

### Issue 3: Payment completes but feature not unlocked

**Symptoms:**
- Payment succeeds on Stripe
- User redirected back to dashboard
- Feature still shows as locked

**Possible Causes:**
1. **Webhook not configured**
   - Webhook endpoint not set up in Stripe dashboard
   - Webhook secret not configured

2. **Webhook not receiving events**
   - Check Stripe dashboard → Webhooks → Events
   - Verify events are being sent

3. **Webhook verification failing**
   - `STRIPE_WEBHOOK_SECRET` not set or incorrect
   - Webhook signature verification failing

**Solution:**

1. **Set up webhook in Stripe Dashboard:**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
   - Click "Add endpoint"
   - URL: `https://your-render-url.onrender.com/api/webhooks/stripe`
   - Select events: `checkout.session.completed`
   - Copy webhook signing secret (starts with `whsec_`)

2. **Add webhook secret to Render:**
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

3. **Test webhook:**
   - Use Stripe CLI locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   - Or check Stripe dashboard for webhook events

---

### Issue 4: Checkout redirect fails

**Symptoms:**
- Checkout session created successfully
- But redirect to Stripe doesn't work
- Or redirects to wrong URL

**Possible Causes:**
1. **Checkout URL is null**
   - Stripe session creation failed silently
   - Check server logs for errors

2. **CORS or redirect issues**
   - Browser blocking redirect
   - Check browser console for errors

**Solution:**
- Check server logs for checkout session creation errors
- Verify `checkoutSession.url` is not null
- Test with browser DevTools network tab

---

### Issue 5: API Version Errors

**Symptoms:**
- Build errors about Stripe API version
- Runtime errors about unsupported API version

**Fixed:**
- Updated to stable API version: `2024-11-20.acacia`
- Applied to both checkout and webhook routes

---

## 🔧 Diagnostic Steps

### Step 1: Check Environment Variables

```bash
# Local testing
cat .env | grep STRIPE

# Render dashboard
# Go to: Service → Environment → Search for "STRIPE"
```

**Required Variables:**
- ✅ `STRIPE_SECRET_KEY` (server-side)
- ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client-side)
- ✅ `STRIPE_WEBHOOK_SECRET` (for webhooks)

### Step 2: Test Checkout Creation

```bash
# Test the checkout endpoint directly
curl -X POST https://your-render-url.onrender.com/api/checkout/create \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{"bookId": "test-id", "featureType": "manuscript-report"}'
```

### Step 3: Check Server Logs

1. Go to Render dashboard → Your service → Logs
2. Look for:
   - `[Stripe]` or `[Checkout]` prefixed logs
   - Error messages about checkout creation
   - Webhook events

### Step 4: Verify Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Check:
   - **API Keys**: Verify test/live keys are active
   - **Webhooks**: Verify endpoint is configured
   - **Events**: Check if webhook events are being received
   - **Payments**: Check if checkout sessions are being created

---

## 🐛 Common Error Messages

### "Stripe not configured. Use simulated purchase."
- **Cause**: Stripe environment variables not set
- **Fix**: Set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### "Failed to create checkout session"
- **Cause**: Stripe API error or invalid keys
- **Fix**: Check server logs for detailed error, verify API keys

### "No signature" (webhook error)
- **Cause**: Webhook request missing signature header
- **Fix**: Verify webhook is configured in Stripe dashboard

### "Invalid signature" (webhook error)
- **Cause**: Webhook secret mismatch
- **Fix**: Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard

---

## ✅ Quick Fix Checklist

- [ ] Stripe keys set in Render environment variables
- [ ] Keys are correct format (`sk_test_...`, `pk_test_...`)
- [ ] `USE_SIMULATED_PURCHASES` is not set (or set to `false`)
- [ ] Webhook endpoint configured in Stripe dashboard
- [ ] Webhook secret set in Render environment
- [ ] API version updated (should be `2024-11-20.acacia`)
- [ ] Service redeployed after changes

---

## 📞 Getting Help

If issues persist:

1. **Check Render Logs:**
   - Go to Render dashboard → Logs
   - Look for Stripe-related errors
   - Copy error messages

2. **Check Stripe Dashboard:**
   - Go to Stripe Dashboard → Logs
   - Check for API errors
   - Verify webhook events

3. **Test Locally:**
   - Set up Stripe keys in `.env`
   - Test checkout creation
   - Verify webhook with Stripe CLI

---

## 🔄 Recent Fixes Applied

1. ✅ Updated Stripe API version to stable version
2. ✅ Improved error handling in checkout route
3. ✅ Added detailed error logging
4. ✅ Fixed TypeScript errors with type assertions

**Status**: Stripe integration fixes deployed to `develop` branch


