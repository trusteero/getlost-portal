# Test Cases to Add

## Recently Implemented Features (To Be Tested)

### Sample Books & Example Books
- ✅ Example books creation for new users (credentials and OAuth)
- ✅ Sample books labeling ("Wool" and "Beach Read" with SAMPLE labels)
- ✅ Sample books exclusion from statistics (unlocked insights, active manuscripts)
- ✅ Sample books exclusion from "Books Uploaded" count
- ✅ Cover image extraction from reports for example books

### UI/UX Improvements
- ✅ Books ordered with newest on the right
- ✅ "+" button positioned on right side of condensed library
- ✅ Horizontal scrolling without overlap
- ✅ Loading state while creating example books

### Upload Permission System
- ✅ Consumption-based upload permissions (1 purchase = 1 upload)
- ✅ Correct counting of uploaded books (excluding samples)
- ✅ Purchase prompt when no permissions remain

## Priority 1: Critical User Flows (High Impact)

### E2E Tests (Playwright)

#### 1. Complete Book Upload Flow
```typescript
test("should upload a book and see it in dashboard", async ({ page }) => {
  // 1. Login
  // 2. Navigate to dashboard
  // 3. Click upload button
  // 4. Fill in book details (title, author, etc.)
  // 5. Select EPUB file
  // 6. Submit upload
  // 7. Verify book appears in dashboard
  // 8. Verify book shows "Queued" status
});
```

#### 2. Email Verification Flow
```typescript
test("should verify email after signup", async ({ page }) => {
  // 1. Sign up with email
  // 2. Check for verification email message
  // 3. Simulate clicking verification link
  // 4. Verify redirect to login
  // 5. Verify can now login
});
```

#### 3. Feature Purchase Flow
```typescript
test("should purchase a feature (simulated)", async ({ page }) => {
  // 1. Login
  // 2. Upload a book
  // 3. Click "Purchase" on a feature (e.g., Report)
  // 4. Verify feature goes to "Processing" state
  // 5. Verify purchase is recorded
});
```

#### 4. View Report Flow
```typescript
test("should view a report after admin uploads it", async ({ page }) => {
  // 1. Login as user
  // 2. Upload book
  // 3. Purchase report (goes to processing)
  // 4. Login as admin (separate session)
  // 5. Upload report for book
  // 6. Switch back to user
  // 7. Verify report is now "Ready to View"
  // 8. Click to view report
  // 9. Verify report displays correctly
});
```

#### 5. Admin Panel Access Control
```typescript
test("should prevent non-admin from accessing admin panel", async ({ page }) => {
  // 1. Login as regular user
  // 2. Try to navigate to /admin
  // 3. Verify redirect or error message
});

test("should allow admin to access admin panel", async ({ page }) => {
  // 1. Login as admin
  // 2. Navigate to /admin
  // 3. Verify admin dashboard loads
});
```

### Unit/Integration Tests (Vitest)

#### 6. Book Upload API
```typescript
describe("Book Upload API", () => {
  it("should create book with metadata", async () => {
    // Test POST /api/books
    // Verify book is created with correct metadata
    // Verify manuscript status is 'queued'
  });

  it("should extract EPUB metadata", async () => {
    // Test EPUB metadata extraction
    // Verify title, author, cover are extracted
  });

  it("should handle missing metadata gracefully", async () => {
    // Test with EPUB that has no metadata
    // Verify uses filename as fallback
  });
});
```

#### 7. Feature Purchase API
```typescript
describe("Feature Purchase API", () => {
  it("should create purchase for free feature", async () => {
    // Test free feature unlock
    // Verify status changes immediately
  });

  it("should create Stripe checkout for paid feature", async () => {
    // Test paid feature with Stripe
    // Verify checkout session is created
  });

  it("should use simulated purchase when Stripe unavailable", async () => {
    // Test paid feature without Stripe
    // Verify simulated purchase completes
  });
});
```

#### 8. Admin Asset Upload API
```typescript
describe("Admin Asset Upload", () => {
  it("should upload report HTML", async () => {
    // Test POST /api/admin/books/[id]/report
    // Verify report is saved
    // Verify book status changes to 'ready_to_purchase'
  });

  it("should upload ZIP with HTML and assets", async () => {
    // Test ZIP upload
    // Verify HTML is extracted
    // Verify assets are bundled
  });

  it("should set active version", async () => {
    // Test setting active report version
    // Verify only one version is active
  });
});
```

## Priority 2: Important Features (Medium Impact)

### E2E Tests

#### 9. Manuscript Status Workflow
```typescript
test("should show correct manuscript status progression", async ({ page }) => {
  // 1. Upload book → "Queued"
  // 2. Admin moves to "Working on Report" → User sees "Working on Report"
  // 3. Admin uploads report → User sees "Ready to Purchase"
  // 4. User purchases → Feature unlocked
});
```

#### 10. Multiple Asset Types
```typescript
test("should handle all asset types (report, marketing, cover, landing)", async ({ page }) => {
  // Test upload and viewing of each asset type
  // Verify correct status updates
});
```

#### 11. Form Validation
```typescript
test("should validate book upload form", async ({ page }) => {
  // Test required fields
  // Test file type validation
  // Test file size limits
});
```

#### 12. Session Management
```typescript
test("should maintain session across page navigation", async ({ page }) => {
  // Login
  // Navigate between pages
  // Verify session persists
});

test("should logout and clear session", async ({ page }) => {
  // Login
  // Logout
  // Verify redirected to home
  // Verify cannot access dashboard
});
```

### Unit/Integration Tests

#### 13. Email Service
```typescript
describe("Email Service", () => {
  it("should send verification email", async () => {
    // Mock Resend API
    // Verify email is sent with correct content
  });

  it("should send manuscript queued notification", async () => {
    // Test notification email
  });

  it("should send report ready notification", async () => {
    // Test notification email
  });
});
```

#### 14. Database Migrations
```typescript
describe("Database Migrations", () => {
  it("should add missing columns safely", async () => {
    // Test columnExists check
    // Test addColumnIfMissing
  });

  it("should handle migration failures gracefully", async () => {
    // Test error handling in migrations
  });
});
```

#### 15. Precanned Content
```typescript
describe("Precanned Content", () => {
  it("should load precanned books", async () => {
    // Test precanned content loading
  });

  it("should match precanned assets to books", async () => {
    // Test asset matching logic
  });
});
```

## Priority 3: Edge Cases & Error Handling (Lower Priority)

### E2E Tests

#### 16. Error Handling
```typescript
test("should handle network errors gracefully", async ({ page }) => {
  // Simulate network failure
  // Verify error message appears
  // Verify app doesn't crash
});

test("should handle invalid file uploads", async ({ page }) => {
  // Try to upload non-EPUB file
  // Verify error message
});

test("should handle expired sessions", async ({ page }) => {
  // Login
  // Wait for session to expire (or simulate)
  // Try to access protected route
  // Verify redirect to login
});
```

#### 17. Responsive Design
```typescript
test("should work on mobile viewport", async ({ page }) => {
  // Set mobile viewport
  // Test key flows
  // Verify UI is usable
});
```

### Unit/Integration Tests

#### 18. API Authorization
```typescript
describe("API Authorization", () => {
  it("should reject unauthorized requests", async () => {
    // Test API routes without auth
    // Verify 401/403 responses
  });

  it("should allow admin-only routes for admins", async () => {
    // Test admin routes with admin user
    // Test admin routes with regular user
  });
});
```

#### 19. File Upload Validation
```typescript
describe("File Upload Validation", () => {
  it("should validate file type", async () => {
    // Test various file types
  });

  it("should validate file size", async () => {
    // Test file size limits
  });

  it("should handle corrupted files", async () => {
    // Test invalid EPUB files
  });
});
```

#### 20. Custom Domain Handling
```typescript
describe("Custom Domain", () => {
  it("should trust custom domain origin", async () => {
    // Test trustedOrigins configuration
  });

  it("should use custom domain as baseURL", async () => {
    // Test baseURL selection
  });
});
```

## Priority 4: Performance & Load (Future)

#### 21. Performance Tests
- Page load times
- API response times
- Large file uploads
- Multiple concurrent users

#### 22. Load Tests
- Multiple simultaneous uploads
- Database query performance
- Session management under load

## Test Organization Recommendations

### New Test Files to Create

```
src/__tests__/
├── api/
│   ├── auth.test.ts ✅ (exists)
│   ├── books.test.ts ✅ (exists)
│   ├── upload.test.ts (NEW)
│   ├── purchase.test.ts (NEW)
│   ├── admin.test.ts (NEW)
│   └── email.test.ts (NEW)
├── e2e/
│   ├── auth.spec.ts ✅ (exists)
│   ├── dashboard.spec.ts ✅ (exists)
│   ├── book-upload.spec.ts ✅ (exists)
│   ├── book-upload-flow.spec.ts (NEW - complete flow)
│   ├── purchase-flow.spec.ts (NEW)
│   ├── admin-panel.spec.ts (NEW)
│   └── email-verification.spec.ts (NEW)
└── helpers/
    ├── db.ts ✅ (exists)
    ├── auth.ts ✅ (exists)
    └── files.ts (NEW - file upload helpers)
```

## Implementation Priority

**Week 1:**
1. Complete book upload flow (E2E)
2. Book upload API tests (Unit)
3. Feature purchase flow (E2E)
4. Feature purchase API tests (Unit)

**Week 2:**
5. Admin panel access control (E2E)
6. Admin asset upload API (Unit)
7. Email verification flow (E2E)
8. Email service tests (Unit)

**Week 3:**
9. View report flow (E2E)
10. Manuscript status workflow (E2E)
11. Form validation (E2E)
12. API authorization (Unit)

**Week 4:**
13. Error handling (E2E)
14. Edge cases (Unit)
15. Performance tests (if needed)

## Coverage Goals

- **Critical paths**: 90%+ coverage
- **API routes**: 80%+ coverage
- **User flows**: 70%+ coverage
- **Error handling**: 60%+ coverage

