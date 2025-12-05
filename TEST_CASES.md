# Test Cases Documentation

This document outlines all test cases for the Get Lost Portal application.

## Test Structure

- **Unit/Integration Tests** (`src/__tests__/api/`): Vitest tests for API routes and utilities
- **E2E Tests** (`src/__tests__/e2e/`): Playwright tests for full user flows

## Running Tests

```bash
# Run all unit/integration tests
npm run test

# Run with UI
npm run test:ui

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test:all

# Run with coverage
npm run test:coverage
```

## Test Coverage

### Precanned Content System

#### Unit/Integration Tests (`precanned-content.test.ts`)

1. **Package Discovery**
   - ✅ Find package by matching filename
   - ✅ Find package by alternative filename
   - ✅ Return null for non-matching filename
   - ✅ Handle empty/null filenames
   - ✅ Find package by key

2. **Content Import**
   - ✅ Import reports when package is found
   - ✅ Import covers when package is found
   - ✅ Import marketing assets when package is found
   - ✅ Import landing page when package is found
   - ✅ Import all features when no flags specified
   - ✅ Set manuscript status to ready_to_purchase when reports are imported
   - ✅ Return null when no matching package is found
   - ✅ Handle missing bookVersionId gracefully

3. **Cover Image Matching**
   - ✅ Find cover image for matching filename
   - ✅ Return null for non-matching filename
   - ✅ Handle null filename

4. **Integration Flow**
   - ✅ Import all content types in one call
   - ✅ Not duplicate content on multiple imports

#### E2E Tests (`precanned-content.spec.ts`)

1. **Automatic Import on Upload**
   - ✅ Import precanned content when uploading matching filename

2. **Content Display**
   - ✅ Display precanned reports after import
   - ✅ Display precanned covers after import

3. **API Route**
   - ✅ Serve precanned assets via API route

4. **File Extension Handling**
   - ✅ Handle different file extensions

5. **Admin View**
   - ✅ Admin can see books with precanned content

### Authentication (`auth.test.ts`, `auth.spec.ts`)

#### Unit Tests
- ✅ User creation
- ✅ Password hashing
- ✅ Session management
- ✅ Email verification
- ✅ OAuth integration

#### E2E Tests
- ✅ Sign up flow
- ✅ Login flow
- ✅ Logout flow
- ✅ Email verification flow
- ✅ Google OAuth flow

### Books API (`books.test.ts`)

- ✅ Create book
- ✅ Create book version
- ✅ Query books by user
- ✅ Update book metadata
- ✅ Delete book

### Book Upload (`book-upload-flow.spec.ts`, `upload.test.ts`)

#### E2E Tests
- ✅ Upload book and see it in dashboard
- ✅ Show book with Queued status after upload
- ✅ Extract metadata from EPUB

#### Unit Tests
- ✅ Validate file types
- ✅ Handle large files
- ✅ Extract EPUB metadata

### Purchase Flow (`purchase.test.ts`, `purchase-flow.spec.ts`)

#### Unit Tests
- ✅ Create purchase record
- ✅ Update purchase status
- ✅ Calculate prices

#### E2E Tests
- ✅ Purchase feature (simulated)
- ✅ View purchase status
- ✅ Handle Stripe integration

### Upload Permissions & Credits (`credits.test.ts`, `upload-permission.test.ts`)

#### Unit Tests
- ✅ Count books uploaded excluding sample books
- ✅ Track purchased upload permissions
- ✅ Consumption-based permission logic (1 purchase = 1 upload)
- ✅ Include pending purchases with payment method
- ✅ Filter out sample books from count ("Wool", "Beach Read")
- ✅ Calculate remaining permissions correctly

#### E2E Tests
- ✅ Display correct "Books Uploaded" count (excluding samples)
- ✅ Prompt for purchase when no permissions remain
- ✅ Allow upload after purchasing permission
- ✅ Decrement permissions after upload

### Admin Panel (`admin-panel.spec.ts`, `admin-upload.test.ts`)

#### E2E Tests
- ✅ Admin access control
- ✅ Upload reports
- ✅ Upload marketing assets
- ✅ Upload covers
- ✅ Upload landing pages
- ✅ View all books
- ✅ View all users
- ✅ Manage user roles

#### Unit Tests
- ✅ Authorization checks
- ✅ File upload validation

### View Report Flow (`view-report-flow.spec.ts`)

- ✅ View report after admin uploads it
- ✅ Preview report
- ✅ Full report display
- ✅ Report navigation

### Email Verification (`email-verification.spec.ts`, `email.test.ts`)

- ✅ Send verification email
- ✅ Verify email token
- ✅ Handle expired tokens
- ✅ Resend verification email

### Session Management (`session-management.spec.ts`)

- ✅ Session persistence
- ✅ Session timeout
- ✅ Multiple device sessions

### Form Validation (`form-validation.spec.ts`)

- ✅ Book upload form validation
- ✅ Sign up form validation
- ✅ Login form validation

### Error Handling (`error-handling.spec.ts`)

- ✅ Handle API errors gracefully
- ✅ Display error messages
- ✅ Handle network errors

### Dashboard (`dashboard.spec.ts`)

#### Basic Display
- ✅ Display user's books
- ✅ Filter books
- ✅ Search books
- ✅ Sort books

#### Example Books & Sample Content
- ✅ Create example books for new credentials users
- ✅ Create example books for new OAuth users
- ✅ Display "Setting up your library" message while creating example books
- ✅ Wait for example books to appear before showing dashboard
- ✅ Display sample books with "SAMPLE" label on covers
- ✅ Display sample books with "Sample" badge in condensed library
- ✅ Display sample books with "Sample Report" badge in manuscript cards

#### Book Ordering & Layout
- ✅ Display books with newest on the right in condensed library
- ✅ Display "+" button on the right side of condensed library
- ✅ "+" button is part of scrollable area (no overlap)
- ✅ Leftmost books slide off screen when scrolling
- ✅ Books can scroll horizontally to reach "+" button

#### Statistics & Counting
- ✅ Exclude sample books from "unlocked insights" count
- ✅ Exclude sample books from "total insights" count
- ✅ Exclude sample books from "active manuscripts" count
- ✅ Exclude sample books from "Books Uploaded" count in Account Settings
- ✅ Only count user-uploaded books in statistics

#### Upload Permissions
- ✅ Track purchased upload permissions correctly
- ✅ Count uploaded books excluding samples
- ✅ Prompt for purchase when no permissions remain
- ✅ Consumption-based permission logic (1 purchase = 1 upload)

### Manuscript Status (`manuscript-status.spec.ts`)

- ✅ Update manuscript status
- ✅ Display status correctly
- ✅ Handle status transitions

## Test Data

Test files and fixtures are located in:
- `test-fixtures/` - Test EPUB files, images, etc.
- Test database: `test.db` (created automatically, cleaned up after tests)

## Writing New Tests

### Unit/Integration Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase, closeTestDatabase } from "../helpers/db";
import { createTestUser, deleteTestUser } from "../helpers/auth";

describe("Feature Name", () => {
  let testDb: BetterSQLite3Database;
  let testUser: TestUser;

  beforeEach(async () => {
    const db = createTestDatabase();
    testDb = db.db;
    testUser = await createTestUser(testDb);
  });

  afterEach(async () => {
    if (testUser) {
      await deleteTestUser(testDb, testUser.id);
    }
    closeTestDatabase();
  });

  it("should do something", async () => {
    // Test implementation
  });
});
```

### E2E Test Template

```typescript
import { test, expect } from "@playwright/test";
import { loginUser, signUpUser } from "./helpers/auth";

test.describe("Feature Name", () => {
  let testEmail: string;
  let testPassword: string;

  test.beforeEach(async ({ page }) => {
    testEmail = `test-${Date.now()}@example.com`;
    testPassword = "TestPassword123!";
    await signUpUser(page, testEmail, testPassword);
  });

  test("should do something", async ({ page }) => {
    await page.goto("/dashboard");
    // Test implementation
  });
});
```

## Test Helpers

### Database Helpers (`helpers/db.ts`)
- `createTestDatabase()` - Create fresh test database
- `closeTestDatabase()` - Close and clean up test database
- `cleanTestDatabase()` - Clean all tables

### Auth Helpers (`helpers/auth.ts`)
- `createTestUser()` - Create test user in database
- `deleteTestUser()` - Delete test user
- `signUpUser()` - E2E sign up helper
- `loginUser()` - E2E login helper

## Known Issues & Limitations

1. **Email Verification**: E2E tests may skip email verification steps
2. **File Uploads**: Some E2E tests use mock files instead of real uploads
3. **Stripe**: Tests use simulated purchases instead of real Stripe transactions
4. **OAuth**: Google OAuth tests may require manual setup

## Coverage Goals

- **Unit/Integration**: 80%+ coverage for critical paths
- **E2E**: Cover all major user flows
- **Precanned Content**: 100% coverage (critical for demo functionality)

## CI/CD Integration

Tests should run on:
- Pre-commit hooks (optional)
- Pull requests
- Before deployment

## Debugging Tests

```bash
# Run specific test file
npm run test src/__tests__/api/precanned-content.test.ts

# Run tests in watch mode
npm run test -- --watch

# Debug E2E tests
npm run test:e2e:debug

# Run E2E tests with UI
npm run test:e2e:ui
```

