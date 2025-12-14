# Next Fix: Add Rate Limiting to Missing Endpoints

## 🎯 Priority: HIGH (Security & Abuse Prevention)

## 📋 Endpoints to Fix

### User Endpoints (High Priority)
1. ✅ `/api/user/purchase-upload` - Purchase endpoint (prevents abuse)
2. ✅ `/api/user/credits` - User data endpoint (prevents scraping)
3. ✅ `/api/user/settings` - User data modification (prevents abuse)

### Book Endpoints (Medium Priority)
4. ✅ `/api/books/[id]` (GET) - Book data access
5. ✅ `/api/books/[id]` (PATCH) - Book data modification

### Admin Endpoints (Medium Priority)
6. ✅ `/api/admin/books/[id]` (PATCH) - Admin operations
7. ✅ `/api/admin/books/[id]/*` (upload endpoints) - Admin uploads

## 🔧 Implementation Pattern

The rate limiting utility already exists at `src/server/utils/rate-limit.ts`. Just add this pattern to each endpoint:

```typescript
import { rateLimitMiddleware, RATE_LIMITS } from "@/server/utils/rate-limit";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Add rate limiting
  const rateLimitResponse = rateLimitMiddleware(
    request,
    "user:credits", // Unique identifier for this endpoint
    RATE_LIMITS.API, // Use appropriate rate limit config
    session.user.id // User ID for authenticated requests
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // ... rest of handler
}
```

## 📊 Rate Limit Configs Available

From `src/server/utils/rate-limit.ts`:
- `RATE_LIMITS.API` - General API endpoints (100 requests per minute)
- `RATE_LIMITS.UPLOAD` - Upload endpoints (10 requests per minute)
- `RATE_LIMITS.AUTH` - Authentication endpoints (5 requests per minute)
- `RATE_LIMITS.WEBHOOK` - Webhook endpoints (100 requests per minute)

## 🎯 Recommended Rate Limits

- **User data endpoints** (`/api/user/*`) → `RATE_LIMITS.API` (100/min)
- **Book GET endpoints** → `RATE_LIMITS.API` (100/min)
- **Book PATCH endpoints** → `RATE_LIMITS.API` (100/min)
- **Admin endpoints** → `RATE_LIMITS.API` (100/min)
- **Admin upload endpoints** → `RATE_LIMITS.UPLOAD` (10/min)

## ⏱️ Estimated Time

- **Quick fix:** 30-45 minutes
- **Files to modify:** ~7 files
- **Lines of code:** ~5-10 lines per endpoint

## ✅ Success Criteria

- All listed endpoints have rate limiting
- Rate limits are appropriate for each endpoint type
- Rate limiting works for both authenticated and unauthenticated requests
- Error messages are clear when rate limit is exceeded

## 🚀 Next Steps After This

1. **Replace `any` types** - Improve type safety
2. **Use `env` object** - Replace direct `process.env` access
3. **Error monitoring** - Set up Sentry or similar
4. **Structured logging** - Replace `console.log` with proper logging

---

**This is a quick win that significantly improves security!** 🛡️

