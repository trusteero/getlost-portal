import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase, closeTestDatabase } from "../helpers/db";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/auth";
import { user as betterAuthUser } from "@/server/db/better-auth-schema";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { Database } from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

describe("Authentication", () => {
  let testDb: BetterSQLite3Database;
  let sqlite: Database;
  let testUser: TestUser;

  beforeEach(async () => {
    const db = createTestDatabase();
    testDb = db.db;
    sqlite = db.sqlite;

    // Create a test user
    testUser = await createTestUser(testDb, {
      email: "test@example.com",
      name: "Test User",
    });
  });

  afterEach(async () => {
    // Clean up
    if (testUser) {
      await deleteTestUser(testDb, testUser.id);
    }
    closeTestDatabase();
  });

  it("should create a user with correct properties", () => {
    expect(testUser).toHaveProperty("id");
    expect(testUser).toHaveProperty("email");
    expect(testUser).toHaveProperty("name");
    expect(testUser.email).toBe("test@example.com");
    expect(testUser.name).toBe("Test User");
  });

  it("should have default role of 'user'", () => {
    expect(testUser.role).toBe("user");
  });

  it("should create user in the database", async () => {
    // Check user table (Better Auth and portal share the same table)
    const dbUsers = await testDb
      .select()
      .from(users)
      .where(eq(users.id, testUser.id));

    expect(dbUsers).toHaveLength(1);
    expect(dbUsers[0]?.email).toBe(testUser.email);
    expect(dbUsers[0]?.name).toBe(testUser.name);
  });
});

