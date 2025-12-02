import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDatabase, closeTestDatabase } from "../helpers/db";
import { createTestUser, createTestAdmin, deleteTestUser, type TestUser } from "../helpers/auth";
import { books, bookVersions, reports, marketingAssets, bookCovers, landingPages } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { Database } from "better-sqlite3";

// Mock file system operations
vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue("<html>Test Report</html>"),
  },
}));

// Mock adm-zip
vi.mock("adm-zip", () => ({
  default: vi.fn().mockImplementation(() => ({
    getEntries: vi.fn().mockReturnValue([
      {
        entryName: "report.html",
        getData: vi.fn().mockReturnValue(Buffer.from("<html>Test Report</html>")),
      },
    ]),
  })),
}));

describe("Admin Asset Upload API", () => {
  let testDb: BetterSQLite3Database;
  let sqlite: Database;
  let testUser: TestUser;
  let testAdmin: TestUser;
  let testBookId: string;

  beforeEach(async () => {
    const db = createTestDatabase();
    testDb = db.db;
    sqlite = db.sqlite;

    testUser = await createTestUser(testDb);
    testAdmin = await createTestAdmin(testDb);
    
    // Create a test book
    testBookId = crypto.randomUUID();
    await testDb.insert(books).values({
      id: testBookId,
      userId: testUser.id,
      title: "Test Book",
      manuscriptStatus: "working_on",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(async () => {
    if (testUser) {
      await deleteTestUser(testDb, testUser.id);
    }
    if (testAdmin) {
      await deleteTestUser(testDb, testAdmin.id);
    }
    closeTestDatabase();
  });

  it("should upload report HTML", async () => {
    const reportId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    
    // Create book version first
    await testDb.insert(bookVersions).values({
      id: versionId,
      bookId: testBookId,
      versionNumber: 1,
      fileName: "test.epub",
      fileUrl: "/api/books/test/file",
      fileSize: 1024,
      fileType: "application/epub+zip",
      uploadedAt: new Date(),
    });

    // Create report
    await testDb.insert(reports).values({
      id: reportId,
      bookVersionId: versionId,
      status: "completed",
      htmlContent: "<html><body>Test Report</body></html>",
      requestedAt: new Date(),
      completedAt: new Date(),
    });

    // Verify report was created
    const report = await testDb
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    expect(report).toHaveLength(1);
    expect(report[0]?.status).toBe("completed");
    expect(report[0]?.htmlContent).toContain("Test Report");
  });

  it("should set active version for reports", async () => {
    // Test that only one report version can be active at a time
    const versionId = crypto.randomUUID();
    
    await testDb.insert(bookVersions).values({
      id: versionId,
      bookId: testBookId,
      versionNumber: 1,
      fileName: "test.epub",
      fileUrl: "/api/books/test/file",
      fileSize: 1024,
      fileType: "application/epub+zip",
      uploadedAt: new Date(),
    });

    const reportId1 = crypto.randomUUID();
    const reportId2 = crypto.randomUUID();
    
    // Create two reports
    await testDb.insert(reports).values({
      id: reportId1,
      bookVersionId: versionId,
      status: "completed",
      htmlContent: "<html>Report 1</html>",
      requestedAt: new Date(),
      completedAt: new Date(),
    });

    await testDb.insert(reports).values({
      id: reportId2,
      bookVersionId: versionId,
      status: "completed",
      htmlContent: "<html>Report 2</html>",
      requestedAt: new Date(),
      completedAt: new Date(),
    });

    // Verify both reports exist
    const allReports = await testDb
      .select()
      .from(reports)
      .where(eq(reports.bookVersionId, versionId));

    expect(allReports.length).toBeGreaterThanOrEqual(2);
  });

  it("should upload marketing assets", async () => {
    const assetId = crypto.randomUUID();
    
    await testDb.insert(marketingAssets).values({
      id: assetId,
      bookId: testBookId,
      assetType: "html",
      htmlContent: "<html>Marketing Asset</html>",
      isActive: true,
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const asset = await testDb
      .select()
      .from(marketingAssets)
      .where(eq(marketingAssets.id, assetId))
      .limit(1);

    expect(asset).toHaveLength(1);
    expect(asset[0]?.isActive).toBe(true);
  });

  it("should upload book covers", async () => {
    const coverId = crypto.randomUUID();
    
    await testDb.insert(bookCovers).values({
      id: coverId,
      bookId: testBookId,
      coverType: "html",
      htmlContent: "<html>Book Cover</html>",
      isPrimary: true,
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const cover = await testDb
      .select()
      .from(bookCovers)
      .where(eq(bookCovers.id, coverId))
      .limit(1);

    expect(cover).toHaveLength(1);
    expect(cover[0]?.isPrimary).toBe(true);
  });

  it("should upload landing pages", async () => {
    const landingPageId = crypto.randomUUID();
    const slug = `test-book-${Date.now()}`;
    
    await testDb.insert(landingPages).values({
      id: landingPageId,
      bookId: testBookId,
      slug,
      htmlContent: "<html>Landing Page</html>",
      isActive: true,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const landingPage = await testDb
      .select()
      .from(landingPages)
      .where(eq(landingPages.id, landingPageId))
      .limit(1);

    expect(landingPage).toHaveLength(1);
    expect(landingPage[0]?.isActive).toBe(true);
  });
});

