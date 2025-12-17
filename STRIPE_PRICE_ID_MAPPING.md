## Stripe as source of truth (Price ID mapping)

To make **all prices come from Stripe**, configure Stripe **Products/Prices** in the Stripe Dashboard and set **Price IDs** in the portal environment.

### Required env vars (per featureType)

Set these in Render (and in local `.env` if needed):

- `STRIPE_PRICE_DNA_REPORT=price_...`
- `STRIPE_PRICE_MARKET_VALIDATION_REPORT=price_...`
- `STRIPE_PRICE_MARKET_READY_PACK=price_...`
- `STRIPE_PRICE_GROWTH_PARTNERSHIP=price_...` (recurring €999/month)

### How it works

- The portal calls Stripe Checkout with `line_items: [{ price: priceId, quantity: 1 }]`.
- The portal also **retrieves the Stripe Price** before creating the `purchase` row, and stores:
  - `purchase.amount` = Stripe `unit_amount`
  - `purchase.currency` = Stripe `currency` (uppercased)

### Notes

- Test and Live mode have **different** `price_...` ids. Set the correct ones for each environment.
- For now, buying any of: `dna-report`, `market-validation-report`, `market-ready-pack` grants the same portal entitlement as `manuscript-report` (report access).
- If something in the UI still tries to purchase `manuscript-report`, the portal will charge the `market-ready-pack` price (no separate `STRIPE_PRICE_MANUSCRIPT_REPORT` needed).


