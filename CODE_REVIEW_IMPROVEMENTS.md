# Code Review - Suggested Improvements

## 🔴 Critical Issues (Fix Immediately)

### 1. **N+1 Query Problems**

**Location**: `src/app/api/books/route.ts` (lines 60-101), `src/app/api/books/[id]/route.ts` (lines 49-96)

**Issue**: Multiple database queries inside loops causing N+1 problem.

```typescript
// ❌ BAD: N+1 queries
const booksWithDetails = await Promise.all(
  userBooks.map(async (book: any) => {
    const latestVersion = await db.select()... // Query 1
    const [report] = await db.select()...      // Query 2
    const features = await db.select()...      // Query 3
    // Multiple more queries per book...
  })
);
```

**Impact**: 
- For 10 books = 30+ database queries
- Slow response times
- High database load

**Fix**: Batch queries using `IN` clauses or joins:

```typescript
// ✅ GOOD: Batch queries
const bookIds = userBooks.map(b => b.id);
const [allVersions, allReports, allFeatures] = await Promise.all([
  db.select().from(bookVersions).where(inArray(bookVersions.bookId, bookIds)),
  db.select().from(reports).where(inArray(reports.bookVersionId, versionIds)),
  db.select().from(bookFeatures).where(inArray(bookFeatures.bookId, bookIds))
]);

// Then group by bookId in memory
```

**Priority**: High - Performance impact

---

### 2. **Excessive Use of `any` Type**

**Location**: Multiple files, especially `src/app/admin/page.tsx`, `src/app/api/books/route.ts`

**Issue**: Using `any` defeats TypeScript's type safety.

```typescript
// ❌ BAD
const [reports, setReports] = useState<any[]>([]);
const booksWithDetails = await Promise.all(
  userBooks.map(async (book: any) => {
```

**Fix**: Define proper types:

```typescript
// ✅ GOOD
interface Report {
  id: string;
  status: string;
  // ... other fields
}
const [reports, setReports] = useState<Report[]>([]);

interface BookWithDetails extends Book {
  latestVersion?: BookVersion;
  latestReport?: Report;
  features: BookFeature[];
}
```

**Priority**: Medium - Code quality and maintainability

---

### 3. **Missing Rate Limiting on Critical Endpoints**

**Location**: Multiple API routes

**Issue**: Several endpoints lack rate limiting:
- `/api/user/purchase-upload`
- `/api/user/credits`
- `/api/user/settings`
- `/api/books/[id]` (GET/PATCH)
- `/api/admin/books/[id]` (PATCH)

**Fix**: Add rate limiting to all user-facing endpoints:

```typescript
import { rateLimitMiddleware, RATE_LIMITS } from "@/server/utils/rate-limit";

export async function GET(request: NextRequest) {
  const rateLimitResponse = rateLimitMiddleware(
    request,
    "user:credits",
    RATE_LIMITS.API,
    session.user.id
  );
  if (rateLimitResponse) return rateLimitResponse;
  // ... rest of handler
}
```

**Priority**: High - Security and abuse prevention

---

### 4. **Direct `process.env` Access**

**Location**: `src/server/services/email.ts`, `src/app/api/covers/[filename]/route.ts`

**Issue**: Direct `process.env` access bypasses validation.

```typescript
// ❌ BAD
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const coverStoragePath = process.env.COVER_STORAGE_PATH || path.join(...);
```

**Fix**: Use validated `env` object:

```typescript
// ✅ GOOD
import { env } from "@/env";
const coverStoragePath = env.COVER_STORAGE_PATH || path.join(...);
```

**Priority**: Medium - Type safety and validation

---

## 🟡 Important Issues (Fix Soon)

### 5. **Inconsistent Error Handling**

**Location**: Multiple API routes

**Issue**: Some endpoints return different error formats.

**Examples**:
- Some return `{ error: "message" }`
- Some return `{ message: "error" }`
- Some include stack traces in production

**Fix**: Create standardized error response utility:

```typescript
// src/server/utils/api-response.ts
export function errorResponse(
  message: string,
  status: number = 500,
  details?: unknown
) {
  return NextResponse.json(
    {
      error: message,
      ...(process.env.NODE_ENV === "development" && details ? { details } : {}),
    },
    { status }
  );
}
```

**Priority**: Medium - Developer experience and debugging

---

### 6. **Console.log in Production Code**

**Location**: Throughout codebase (100+ instances)

**Issue**: Debug logs should not be in production.

**Examples**:
- `console.log('[Upload Permission] User ${id}: Found ${count}...')`
- `console.log('[Covers API] File not found...')`

**Fix**: Use structured logging with levels:

```typescript
// src/server/utils/logger.ts
const logger = {
  debug: (msg: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEBUG] ${msg}`, ...args);
    }
  },
  info: (msg: string, ...args: unknown[]) => {
    console.log(`[INFO] ${msg}`, ...args);
  },
  error: (msg: string, error?: Error) => {
    console.error(`[ERROR] ${msg}`, error);
    // Send to error tracking service
  },
};
```

**Priority**: Medium - Logging and debugging

---

### 7. **Missing Input Validation**

**Location**: Some API endpoints

**Issue**: Not all endpoints validate inputs properly.

**Examples**:
- Email format validation could be stricter
- URL validation for `coverImageUrl`
- UUID format validation for IDs

**Fix**: Add comprehensive validation:

```typescript
import { z } from "zod";

const bookIdSchema = z.string().uuid();
const emailSchema = z.string().email().toLowerCase();
const urlSchema = z.string().url();

// Validate before processing
const validatedId = bookIdSchema.parse(id);
```

**Priority**: Medium - Security and data integrity

---

### 8. **Missing Query Limits**

**Location**: `src/app/api/admin/books/route.ts`, `src/app/api/admin/users/route.ts`

**Issue**: Some queries don't have `LIMIT` clauses.

**Fix**: Add reasonable limits:

```typescript
// ✅ GOOD
const allBooks = await db
  .select()
  .from(books)
  .limit(1000); // Prevent excessive data loading
```

**Priority**: Medium - Performance and memory usage

---

### 9. **Inefficient Data Filtering**

**Location**: `src/app/api/user/credits/route.ts`, `src/app/api/user/upload-permission/route.ts`

**Issue**: Filtering in JavaScript instead of SQL.

```typescript
// ❌ BAD: Fetch all, then filter
const allUploadPurchases = await db.select().from(purchases).where(...);
const userLevelPurchases = allUploadPurchases.filter(p => 
  p.bookId === null || p.bookId === undefined || p.bookId === ""
);
```

**Fix**: Filter in SQL query:

```typescript
// ✅ GOOD: Filter in database
const userLevelPurchases = await db
  .select()
  .from(purchases)
  .where(
    and(
      eq(purchases.userId, session.user.id),
      eq(purchases.featureType, "book-upload"),
      isNull(purchases.bookId) // Use SQL null check
    )
  );
```

**Priority**: Medium - Performance

---

## 🟢 Code Quality Improvements

### 10. **Type Safety Improvements**

**Location**: Multiple files

**Issues**:
- Using `any` types
- Missing return type annotations
- Missing parameter types

**Fix**: Add proper types throughout:

```typescript
// Define interfaces
interface BookResponse {
  id: string;
  title: string;
  // ... other fields
}

// Use in functions
async function getBook(id: string): Promise<BookResponse | null> {
  // ...
}
```

**Priority**: Low - Code quality

---

### 11. **Code Duplication**

**Location**: Multiple files

**Issue**: Similar logic repeated in multiple places.

**Examples**:
- Book ownership checks repeated
- Asset status determination logic duplicated
- Error handling patterns repeated

**Fix**: Extract to utility functions:

```typescript
// src/server/utils/book-ownership.ts
export async function verifyBookOwnership(
  bookId: string,
  userId: string,
  isAdmin: boolean
): Promise<boolean> {
  const [book] = await db
    .select()
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);
  
  return book?.userId === userId || isAdmin;
}
```

**Priority**: Low - Maintainability

---

### 12. **Magic Numbers and Strings**

**Location**: Throughout codebase

**Issue**: Hardcoded values without constants.

**Examples**:
- `500` (timeout)
- `"completed"`, `"pending"` (status strings)
- `5 * 1024 * 1024` (file size)

**Fix**: Extract to constants:

```typescript
// src/server/constants.ts
export const FILE_SIZE_LIMITS = {
  COVER_IMAGE: 5 * 1024 * 1024, // 5MB
  MANUSCRIPT: 50 * 1024 * 1024, // 50MB
} as const;

export const PURCHASE_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
```

**Priority**: Low - Maintainability

---

### 13. **Missing JSDoc Comments**

**Location**: Utility functions and complex logic

**Issue**: Functions lack documentation.

**Fix**: Add JSDoc comments:

```typescript
/**
 * Validates and sanitizes user input to prevent XSS attacks
 * 
 * @param input - Raw user input string
 * @param maxLength - Maximum allowed length (default: 1000)
 * @returns Sanitized string or null if invalid
 * 
 * @example
 * ```ts
 * const safe = sanitizeInput("<script>alert('xss')</script>");
 * // Returns: "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
 * ```
 */
export function sanitizeInput(input: string, maxLength = 1000): string | null {
  // ...
}
```

**Priority**: Low - Documentation

---

## 🔧 Performance Optimizations

### 14. **Database Query Optimization**

**Issues**:
1. N+1 queries (see #1)
2. Missing indexes (already documented in PRODUCTION_READINESS_CHECKLIST.md)
3. Fetching unnecessary data

**Fix**: 
- Batch queries
- Add indexes
- Select only needed columns

**Priority**: High - Performance

---

### 15. **Memory Leaks in Frontend**

**Location**: `src/app/dashboard/page.tsx`

**Issue**: Multiple `setInterval` and `setTimeout` calls that may not be cleaned up properly.

**Fix**: Ensure all intervals/timeouts are cleared:

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    // ...
  }, 5000);
  
  return () => clearInterval(interval); // ✅ Always cleanup
}, [dependencies]);
```

**Priority**: Medium - Memory management

---

## 🛡️ Security Improvements

### 16. **SQL Injection Prevention**

**Status**: ✅ Good - Using Drizzle ORM prevents SQL injection

**Note**: Continue using parameterized queries, never string concatenation.

---

### 17. **XSS Prevention**

**Status**: ✅ Good - Input sanitization implemented

**Note**: Continue sanitizing all user inputs before storing/displaying.

---

### 18. **CSRF Protection**

**Status**: ✅ Good - Next.js provides CSRF protection by default

**Note**: Ensure all state-changing operations use POST/PUT/PATCH/DELETE.

---

## 📊 Summary by Priority

### High Priority (Fix Before Production)
1. ✅ N+1 Query Problems
2. ✅ Missing Rate Limiting
3. ✅ Database Query Optimization
4. ✅ Memory Leaks in Frontend

### Medium Priority (Fix Soon)
5. ✅ Excessive `any` Types
6. ✅ Direct `process.env` Access
7. ✅ Inconsistent Error Handling
8. ✅ Console.log in Production
9. ✅ Missing Input Validation
10. ✅ Missing Query Limits
11. ✅ Inefficient Data Filtering

### Low Priority (Nice to Have)
12. ✅ Type Safety Improvements
13. ✅ Code Duplication
14. ✅ Magic Numbers and Strings
15. ✅ Missing JSDoc Comments

---

## 🚀 Quick Wins (Easy Fixes)

1. **Add rate limiting** to missing endpoints (30 min)
2. **Replace `any` types** with proper interfaces (2 hours)
3. **Extract constants** for magic numbers (1 hour)
4. **Add query limits** to admin endpoints (30 min)
5. **Use `env` object** instead of `process.env` (1 hour)

---

## 📝 Implementation Order

1. **Week 1**: Fix N+1 queries and add rate limiting
2. **Week 2**: Replace `any` types and improve error handling
3. **Week 3**: Optimize queries and add input validation
4. **Week 4**: Code quality improvements (constants, JSDoc, etc.)

---

## 🔍 Testing Recommendations

After implementing fixes:
1. Load test endpoints to verify N+1 query fixes
2. Test rate limiting with multiple concurrent requests
3. Verify type safety with TypeScript strict mode
4. Test error handling with various failure scenarios
5. Monitor memory usage for leaks

