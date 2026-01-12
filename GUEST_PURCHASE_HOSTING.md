# Guest Purchase Landing Page - Hosting on Same Render

## Yes, It Can Be Hosted on the Same Render Deployment

The guest purchase landing page can be hosted in the same Next.js app on Render. This is actually the **recommended approach** because:

1. ✅ **No additional infrastructure** - Uses existing Render deployment
2. ✅ **Same domain** - Can use your existing domain/subdomain
3. ✅ **Shared codebase** - Reuse components, styles, utilities
4. ✅ **Easy deployment** - Just push code, no separate deployment needed
5. ✅ **Cost effective** - No additional hosting costs

## How Next.js Handles Public Pages

Next.js automatically serves pages in the `app` directory as routes. A page at:
```
src/app/purchase-upload/page.tsx
```

Will be accessible at:
```
https://yourdomain.com/purchase-upload
```

**No authentication required** - Next.js pages are public by default unless you add middleware/checks.

## Implementation Structure

### File Structure
```
src/app/
├── purchase-upload/
│   └── page.tsx          # Public landing page (no auth required)
├── login/
│   └── page.tsx          # Existing login page
├── signup/
│   └── page.tsx          # Existing signup page
└── dashboard/
    └── page.tsx          # Protected page (requires auth)
```

### Route Access
- `/purchase-upload` - **Public** (no auth, anyone can access)
- `/login` - **Public** (no auth)
- `/signup` - **Public** (no auth)
- `/dashboard` - **Protected** (requires auth)

## Example Landing Page Implementation

```typescript
// src/app/purchase-upload/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PurchaseUploadPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Call guest checkout endpoint (no auth required)
      const response = await fetch('/api/checkout/create-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          featureType: 'book-upload',
        }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to create checkout session');
        setLoading(false);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-center mb-4">
          Upload Your Manuscript
        </h1>
        <p className="text-xl text-center text-gray-600 mb-8">
          Get comprehensive analysis and insights for your book
        </p>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handlePurchase}>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="your@email.com"
              />
            </div>

            {error && (
              <div className="mb-4 text-red-600 text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Purchase Upload ($99.99)'}
            </button>
          </form>

          <p className="mt-4 text-sm text-gray-500 text-center">
            You'll create your account after purchase
          </p>
        </div>
      </div>
    </div>
  );
}
```

## Public vs Protected Routes

### Making Routes Public (No Changes Needed)
By default, Next.js pages are **public**. They only become protected if you:
- Add middleware that checks authentication
- Add auth checks in the page component
- Use route groups with specific configurations

### Current Public Routes
- `/login` - Public (no auth required)
- `/signup` - Public (no auth required)
- `/purchase-upload` - Will be public (new page)

### Current Protected Routes
- `/dashboard` - Protected (checks session)
- `/dashboard/*` - Protected (checks session)

## Middleware Considerations

If you have middleware that protects routes, you may need to add an exception:

```typescript
// src/middleware.ts (if it exists)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public routes (no auth required)
  const publicRoutes = [
    '/login',
    '/signup',
    '/purchase-upload',  // Add this
    '/api/checkout/create-guest',  // Add this
  ];

  if (publicRoutes.includes(path)) {
    return NextResponse.next(); // Allow access
  }

  // ... rest of auth logic
}
```

## API Route for Guest Checkout

The API route is also hosted on the same Render deployment:

```typescript
// src/app/api/checkout/create-guest/route.ts
export async function POST(request: NextRequest) {
  // No session required - this is a public endpoint
  // ... guest checkout logic
}
```

Accessible at: `https://yourdomain.com/api/checkout/create-guest`

## Deployment Flow

1. **Add files to codebase**
   - `src/app/purchase-upload/page.tsx`
   - `src/app/api/checkout/create-guest/route.ts`

2. **Push to git**
   ```bash
   git add .
   git commit -m "Add guest purchase landing page"
   git push
   ```

3. **Render auto-deploys**
   - Render detects the push
   - Builds the Next.js app
   - Deploys automatically
   - Page is live at `/purchase-upload`

**No separate deployment needed!**

## Domain Configuration

### Option 1: Same Domain
```
https://yourdomain.com/purchase-upload
```

### Option 2: Subdomain (if configured)
```
https://purchase.yourdomain.com/purchase-upload
```

Both work with the same Render deployment.

## Benefits of Same Deployment

1. **Shared Components**
   - Reuse existing UI components
   - Consistent styling
   - Shared utilities

2. **Shared Environment Variables**
   - Same Stripe keys
   - Same database connection
   - Same configuration

3. **Easier Development**
   - One codebase
   - One deployment
   - One set of logs

4. **Cost Effective**
   - No additional hosting
   - No additional domain setup
   - No additional SSL certificates

## Security Considerations

### Public Page Security
- ✅ No sensitive data exposed
- ✅ Email validation on server
- ✅ Rate limiting on API endpoint
- ✅ Stripe handles payment security

### API Endpoint Security
```typescript
// src/app/api/checkout/create-guest/route.ts
export async function POST(request: NextRequest) {
  // Rate limiting (by IP, not user)
  const rateLimitResponse = rateLimitMiddleware(
    request,
    "checkout:create-guest",
    RATE_LIMITS.PURCHASE
  );
  
  // Email validation
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  
  // ... rest of logic
}
```

## Testing Locally

```bash
# Start dev server
npm run dev

# Access landing page
http://localhost:3000/purchase-upload

# Test guest checkout
# No authentication needed
```

## Production Checklist

- [ ] Create `/purchase-upload/page.tsx`
- [ ] Create `/api/checkout/create-guest/route.ts`
- [ ] Add route to middleware exceptions (if middleware exists)
- [ ] Test locally
- [ ] Push to git
- [ ] Verify Render deployment
- [ ] Test on production domain
- [ ] Verify Stripe checkout works

## Summary

✅ **Yes, host on same Render deployment**
- Same Next.js app
- Same domain
- Same deployment process
- No additional infrastructure needed

The landing page is just another route in your Next.js app, accessible at `/purchase-upload`. It's public by default (no auth required), just like your `/login` and `/signup` pages.

