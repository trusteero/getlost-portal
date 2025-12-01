/**
 * Auth test utilities
 * Helpers for creating test users and sessions
 */

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { user as betterAuthUser } from "@/server/db/better-auth-schema";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role?: "user" | "admin" | "super_admin";
}

/**
 * Create a test user
 * Note: Better Auth and portal users share the same table (getlostportal_user)
 */
export async function createTestUser(
  db: BetterSQLite3Database,
  overrides?: Partial<TestUser>
): Promise<TestUser> {
  const id = overrides?.id || randomUUID();
  const email = overrides?.email || `test-${randomUUID()}@example.com`;
  const name = overrides?.name || "Test User";
  const role = overrides?.role || "user";

  // Create user (Better Auth and portal share the same table)
  // Use the users table from schema.ts which has all fields
  await db.insert(users).values({
    id,
    email,
    name,
    role,
    emailVerified: new Date(), // Convert boolean to timestamp
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { id, email, name, role };
}

/**
 * Create an admin test user
 */
export async function createTestAdmin(
  db: BetterSQLite3Database,
  overrides?: Partial<TestUser>
): Promise<TestUser> {
  return createTestUser(db, { ...overrides, role: "admin" });
}

/**
 * Delete a test user
 */
export async function deleteTestUser(
  db: BetterSQLite3Database,
  userId: string
): Promise<void> {
  // Better Auth and portal share the same table, so only delete once
  await db.delete(users).where(eq(users.id, userId));
}

/**
 * Create a mock session object for testing
 */
export function createMockSession(user: TestUser) {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "user",
    },
    session: {
      id: randomUUID(),
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  };
}

