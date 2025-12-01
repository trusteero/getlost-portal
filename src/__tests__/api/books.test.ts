import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase, closeTestDatabase } from "../helpers/db";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/auth";
import { books, bookVersions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { Database } from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

describe("Books API", () => {
  let testDb: BetterSQLite3Database;
  let sqlite: Database;
  let testUser: TestUser;

  beforeEach(async () => {
    const db = createTestDatabase();
    testDb = db.db;
    sqlite = db.sqlite;

    testUser = await createTestUser(testDb);
  });

  afterEach(async () => {
    if (testUser) {
      await deleteTestUser(testDb, testUser.id);
    }
    closeTestDatabase();
  });

  it("should create a book", async () => {
    const bookId = crypto.randomUUID();
    const newBook = await testDb
      .insert(books)
      .values({
        id: bookId,
        userId: testUser.id,
        title: "Test Book",
        description: "A test book",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    expect(newBook).toHaveLength(1);
    expect(newBook[0]?.title).toBe("Test Book");
    expect(newBook[0]?.userId).toBe(testUser.id);
  });

  it("should create a book version", async () => {
    // First create a book
    const bookId = crypto.randomUUID();
    await testDb.insert(books).values({
      id: bookId,
      userId: testUser.id,
      title: "Test Book",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Then create a version
    const versionId = crypto.randomUUID();
    const newVersion = await testDb
      .insert(bookVersions)
      .values({
        id: versionId,
        bookId,
        versionNumber: 1,
        fileName: "test.epub",
        fileUrl: "/api/books/test/file",
        fileSize: 1024,
        fileType: "application/epub+zip",
        uploadedAt: new Date(),
      })
      .returning();

    expect(newVersion).toHaveLength(1);
    expect(newVersion[0]?.bookId).toBe(bookId);
    expect(newVersion[0]?.fileName).toBe("test.epub");
  });

  it("should query books by user", async () => {
    const bookId = crypto.randomUUID();
    await testDb.insert(books).values({
      id: bookId,
      userId: testUser.id,
      title: "User Book",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const userBooks = await testDb
      .select()
      .from(books)
      .where(eq(books.userId, testUser.id));

    expect(userBooks).toHaveLength(1);
    expect(userBooks[0]?.title).toBe("User Book");
  });
});

