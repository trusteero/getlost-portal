# Testing Guide

## Overview

The project uses **Vitest** for unit and integration testing. Tests are located in `src/__tests__/`.

## Running Tests

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

## Test Structure

```
src/__tests__/
├── setup.ts              # Global test setup
├── helpers/
│   ├── db.ts            # Test database utilities
│   └── auth.ts          # Auth test helpers
└── api/
    ├── auth.test.ts     # Authentication tests
    └── books.test.ts    # Books API tests
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

### Priority 1: Critical Paths
- ✅ Authentication (sign up, login, email verification)
- ✅ Book creation and management
- ✅ API route authorization
- ✅ Database operations

### Priority 2: Business Logic
- Feature purchases
- Admin operations
- File uploads
- Email notifications

### Priority 3: UI Components
- Form validation
- User interactions
- Error handling

## Coverage Goals

- **Critical paths**: 80%+ coverage
- **Business logic**: 70%+ coverage
- **UI components**: 60%+ coverage

## CI/CD Integration

Tests should run automatically on:
- Pull requests
- Before deployment
- On every commit (optional)

## Troubleshooting

### Tests failing with database errors
- Make sure test database is properly closed between tests
- Check that tables are created correctly in `helpers/db.ts`

### Tests failing with import errors
- Verify path aliases in `vitest.config.ts` match `tsconfig.json`
- Check that all dependencies are installed

### Slow tests
- Use in-memory database (`createTestDatabase(true)`)
- Clean up test data properly
- Avoid unnecessary setup/teardown

