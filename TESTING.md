# Testing Guide

## Overview

The project uses **Vitest** for unit and integration testing, and **Playwright** for end-to-end (E2E) testing.

- **Vitest**: Fast unit/integration tests for API routes, utilities, and business logic
- **Playwright**: E2E tests that run in real browsers to test user flows

## Running Tests

### Unit/Integration Tests (Vitest)

```bash
# Run tests in watch mode (recommended for development)
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### E2E Tests (Playwright)

```bash
# Run E2E tests (starts dev server automatically)
npm run test:e2e

# Run E2E tests with UI mode
npm run test:e2e:ui

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# Debug E2E tests
npm run test:e2e:debug

# Run all tests (unit + E2E)
npm run test:all
```

## Test Structure

```
src/__tests__/
├── setup.ts              # Vitest global setup
├── helpers/
│   ├── db.ts            # Test database utilities
│   └── auth.ts          # Auth test helpers
├── api/                  # Unit/Integration tests
│   ├── auth.test.ts     # Authentication tests
│   └── books.test.ts    # Books API tests
└── e2e/                  # E2E tests (Playwright)
    ├── auth.spec.ts     # Authentication E2E tests
    ├── dashboard.spec.ts # Dashboard E2E tests
    └── book-upload.spec.ts # Book upload E2E tests
```

## Test Database

Tests use an **in-memory SQLite database** by default for speed. Tables are created automatically from the schema.

### Test Database Helpers

```typescript
import { createTestDatabase, closeTestDatabase } from "../helpers/db";

// Create a fresh test database
const { db, sqlite } = createTestDatabase();

// Use the database in your tests
// ...

// Clean up
closeTestDatabase();
```

## Test Utilities

### Creating Test Users

```typescript
import { createTestUser, createTestAdmin } from "../helpers/auth";

const user = await createTestUser(db, {
  email: "test@example.com",
  name: "Test User",
});

const admin = await createTestAdmin(db);
```

### Mocking

Next.js router is automatically mocked in `setup.ts`. Additional mocks can be added there.

## Writing Tests

### Example: Testing API Routes

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase, closeTestDatabase } from "../helpers/db";
import { createTestUser, deleteTestUser } from "../helpers/auth";

describe("My Feature", () => {
  let testDb: BetterSQLite3Database;
  let testUser: TestUser;

  beforeEach(async () => {
    const db = createTestDatabase();
    testDb = db.db;
    testUser = await createTestUser(testDb);
  });

  afterEach(async () => {
    await deleteTestUser(testDb, testUser.id);
    closeTestDatabase();
  });

  it("should do something", async () => {
    // Your test here
    expect(true).toBe(true);
  });
});
```

## What to Test

### Unit/Integration Tests (Vitest)
- ✅ Authentication (sign up, login, email verification)
- ✅ Book creation and management
- ✅ API route authorization
- ✅ Database operations
- Feature purchases
- Admin operations
- File uploads
- Email notifications

### E2E Tests (Playwright)
- ✅ User flows (sign up → verify → login → dashboard)
- ✅ Book upload flow
- ✅ Feature purchase flow
- ✅ Admin panel access
- ✅ Form validation
- ✅ Navigation
- ✅ Responsive design
- ✅ Error handling in UI

## Coverage Goals

- **Critical paths**: 80%+ coverage
- **Business logic**: 70%+ coverage
- **UI components**: 60%+ coverage

## CI/CD Integration

Tests should run automatically on:
- Pull requests
- Before deployment
- On every commit (optional)

## Writing E2E Tests

### Example: Testing User Flow

```typescript
import { test, expect } from "@playwright/test";

test("should complete sign up flow", async ({ page }) => {
  // Navigate to sign up
  await page.goto("/signup");
  
  // Fill form
  await page.fill('input[name="name"]', "Test User");
  await page.fill('input[name="email"]', "test@example.com");
  await page.fill('input[name="password"]', "password123");
  
  // Submit
  await page.click('button[type="submit"]');
  
  // Verify redirect or success message
  await expect(page).toHaveURL(/.*verify|.*dashboard/);
});
```

### Playwright Configuration

- **Base URL**: `http://localhost:3000` (auto-starts dev server)
- **Browsers**: Chromium (can add Firefox, Safari)
- **Screenshots**: Taken on test failure
- **Traces**: Collected on retry

## Troubleshooting

### Vitest Issues

**Tests failing with database errors**
- Make sure test database is properly closed between tests
- Check that tables are created correctly in `helpers/db.ts`

**Tests failing with import errors**
- Verify path aliases in `vitest.config.ts` match `tsconfig.json`
- Check that all dependencies are installed

**Slow tests**
- Use in-memory database (`createTestDatabase(true)`)
- Clean up test data properly
- Avoid unnecessary setup/teardown

### Playwright Issues

**Tests failing to start**
- Make sure dev server can start on port 3000
- Check that no other process is using port 3000
- Verify `npm run dev` works manually

**Tests timing out**
- Increase timeout in `playwright.config.ts`
- Check that the app is actually running
- Verify base URL is correct

**Browser not found**
- Run `npx playwright install` to install browsers
- Or `npx playwright install chromium` for just Chromium

