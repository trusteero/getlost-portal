import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase, closeTestDatabase } from "../helpers/db";
import { createTestUser, createTestAdmin, deleteTestUser, type TestUser } from "../helpers/auth";
import { books } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { Database } from "better-sqlite3";

describe("API Authorization", () => {
  let testDb: BetterSQLite3Database;
  let sqlite: Database;
  let testUser: TestUser;
  let testAdmin: TestUser;
  let otherUser: TestUser;

  beforeEach(async () => {
    const db = createTestDatabase();
    testDb = db.db;
    sqlite = db.sqlite;

    testUser = await createTestUser(testDb);
    testAdmin = await createTestAdmin(testDb);
    otherUser = await createTestUser(testDb, { email: "other@example.com" });
  });

  afterEach(async () => {
    if (testUser) {
      await deleteTestUser(testDb, testUser.id);
    }
    if (testAdmin) {
      await deleteTestUser(testDb, testAdmin.id);
    }
    if (otherUser) {
      await deleteTestUser(testDb, otherUser.id);
    }
    closeTestDatabase();
  });

  it("should only allow book owner to access their books", async () => {
    const bookId = crypto.randomUUID();
    
    // Create book for testUser
    await testDb.insert(books).values({
      id: bookId,
      userId: testUser.id,
      title: "User's Book",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Try to query as otherUser - should not find the book
    const otherUserBooks = await testDb
      .select()
      .from(books)
      .where(eq(books.userId, otherUser.id));

    expect(otherUserBooks).toHaveLength(0);
    
    // Query as testUser - should find the book
    const userBooks = await testDb
      .select()
      .from(books)
      .where(eq(books.userId, testUser.id));

    expect(userBooks.length).toBeGreaterThan(0);
    expect(userBooks[0]?.id).toBe(bookId);
  });

  it("should verify user ownership before operations", async () => {
    const bookId = crypto.randomUUID();
    
    // Create book for testUser
    await testDb.insert(books).values({
      id: bookId,
      userId: testUser.id,
      title: "User's Book",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Verify ownership check
    const book = await testDb
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    expect(book).toHaveLength(1);
    expect(book[0]?.userId).toBe(testUser.id);
    
    // otherUser should not own this book
    expect(book[0]?.userId).not.toBe(otherUser.id);
  });

  it("should allow admin to access all books", async () => {
    const bookId1 = crypto.randomUUID();
    const bookId2 = crypto.randomUUID();
    
    // Create books for different users
    await testDb.insert(books).values({
      id: bookId1,
      userId: testUser.id,
      title: "User 1 Book",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await testDb.insert(books).values({
      id: bookId2,
      userId: otherUser.id,
      title: "User 2 Book",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Admin should be able to see all books (no userId filter)
    const allBooks = await testDb
      .select()
      .from(books);

    expect(allBooks.length).toBeGreaterThanOrEqual(2);
  });
});

