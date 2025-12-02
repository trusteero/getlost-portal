// Vitest setup file - only runs for Vitest tests
// Playwright tests don't use this file

import "@testing-library/jest-dom";
import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock environment variables for tests
process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./test.db";
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-key-for-testing-only";
process.env.NODE_ENV = process.env.NODE_ENV || "test";

// Ensure we're in a server context for tests that import server modules
// This prevents the "server-side environment variable on client" error
if (typeof window === "undefined") {
  // We're in Node.js context (test environment)
  // This is fine for server-side modules
}
