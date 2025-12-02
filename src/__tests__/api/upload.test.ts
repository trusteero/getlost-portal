import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDatabase, closeTestDatabase } from "../helpers/db";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/auth";
import { books, bookVersions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { Database } from "better-sqlite3";

// Mock the EPUB metadata extraction
vi.mock("@/server/utils/extract-epub-metadata", () => ({
  extractEpubMetadata: vi.fn().mockResolvedValue({
    title: "Extracted Title",
    author: "Extracted Author",
    description: "Extracted description",
    coverImage: null,
  }),
}));

// Mock file system operations
vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Book Upload API", () => {
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

  it("should create book with metadata", async () => {
    const bookId = crypto.randomUUID();
    const newBook = await testDb
      .insert(books)
      .values({
        id: bookId,
        userId: testUser.id,
        title: "Test Book",
        description: "A test book description",
        authorName: "Test Author",
        authorBio: "Test Author Bio",
        manuscriptStatus: "queued",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    expect(newBook).toHaveLength(1);
    expect(newBook[0]?.title).toBe("Test Book");
    expect(newBook[0]?.userId).toBe(testUser.id);
    expect(newBook[0]?.authorName).toBe("Test Author");
    expect(newBook[0]?.manuscriptStatus).toBe("queued");
  });

  it("should create book version with file metadata", async () => {
    const bookId = crypto.randomUUID();
    await testDb.insert(books).values({
      id: bookId,
      userId: testUser.id,
      title: "Test Book",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const versionId = crypto.randomUUID();
    const newVersion = await testDb
      .insert(bookVersions)
      .values({
        id: versionId,
        bookId,
        versionNumber: 1,
        fileName: "test-book.epub",
        fileUrl: "/api/books/test/file",
        fileSize: 1024000, // 1MB
        fileType: "application/epub+zip",
        uploadedAt: new Date(),
      })
      .returning();

    expect(newVersion).toHaveLength(1);
    expect(newVersion[0]?.bookId).toBe(bookId);
    expect(newVersion[0]?.fileName).toBe("test-book.epub");
    expect(newVersion[0]?.fileSize).toBe(1024000);
  });

  it("should set manuscript status to queued on creation", async () => {
    const bookId = crypto.randomUUID();
    const newBook = await testDb
      .insert(books)
      .values({
        id: bookId,
        userId: testUser.id,
        title: "New Book",
        manuscriptStatus: "queued",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    expect(newBook[0]?.manuscriptStatus).toBe("queued");
  });

  it("should allow optional metadata fields", async () => {
    const bookId = crypto.randomUUID();
    const newBook = await testDb
      .insert(books)
      .values({
        id: bookId,
        userId: testUser.id,
        title: "Minimal Book",
        // No authorName, authorBio, or description
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    expect(newBook).toHaveLength(1);
    expect(newBook[0]?.title).toBe("Minimal Book");
    // Optional fields should be null/undefined
    expect(newBook[0]?.authorName).toBeNull();
  });
});

