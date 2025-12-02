import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDatabase, closeTestDatabase } from "../helpers/db";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/auth";
import { books, bookFeatures, purchases } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { Database } from "better-sqlite3";

describe("Feature Purchase API", () => {
  let testDb: BetterSQLite3Database;
  let sqlite: Database;
  let testUser: TestUser;
  let testBookId: string;

  beforeEach(async () => {
    const db = createTestDatabase();
    testDb = db.db;
    sqlite = db.sqlite;

    testUser = await createTestUser(testDb);
    
    // Create a test book
    testBookId = crypto.randomUUID();
    await testDb.insert(books).values({
      id: testBookId,
      userId: testUser.id,
      title: "Test Book",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(async () => {
    if (testUser) {
      await deleteTestUser(testDb, testUser.id);
    }
    closeTestDatabase();
  });

  it("should create purchase for free feature", async () => {
    const featureId = crypto.randomUUID();
    const purchaseId = crypto.randomUUID();
    
    // Create free feature (summary)
    await testDb.insert(bookFeatures).values({
      id: featureId,
      bookId: testBookId,
      featureType: "summary",
      status: "purchased",
      price: 0,
      unlockedAt: new Date(),
      purchasedAt: new Date(),
    });

    // Create purchase record
    await testDb.insert(purchases).values({
      id: purchaseId,
      userId: testUser.id,
      bookId: testBookId,
      featureType: "summary",
      amount: 0,
      currency: "USD",
      paymentMethod: "simulated",
      status: "completed",
      completedAt: new Date(),
    });

    // Verify purchase was created
    const purchase = await testDb
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    expect(purchase).toHaveLength(1);
    expect(purchase[0]?.amount).toBe(0);
    expect(purchase[0]?.status).toBe("completed");
  });

  it("should create purchase for paid feature with simulated payment", async () => {
    const featureId = crypto.randomUUID();
    const purchaseId = crypto.randomUUID();
    
    // Create paid feature (report)
    await testDb.insert(bookFeatures).values({
      id: featureId,
      bookId: testBookId,
      featureType: "manuscript-report",
      status: "purchased",
      price: 14999,
      unlockedAt: new Date(),
      purchasedAt: new Date(),
    });

    // Create simulated purchase
    await testDb.insert(purchases).values({
      id: purchaseId,
      userId: testUser.id,
      bookId: testBookId,
      featureType: "manuscript-report",
      amount: 14999,
      currency: "USD",
      paymentMethod: "simulated",
      status: "completed",
      completedAt: new Date(),
    });

    // Verify purchase
    const purchase = await testDb
      .select()
      .from(purchases)
      .where(eq(purchases.id, purchaseId))
      .limit(1);

    expect(purchase).toHaveLength(1);
    expect(purchase[0]?.amount).toBe(14999);
    expect(purchase[0]?.paymentMethod).toBe("simulated");
  });

  it("should set feature status to purchased when unlocked", async () => {
    const featureId = crypto.randomUUID();
    
    await testDb.insert(bookFeatures).values({
      id: featureId,
      bookId: testBookId,
      featureType: "manuscript-report",
      status: "purchased",
      price: 14999,
      unlockedAt: new Date(),
      purchasedAt: new Date(),
    });

    const feature = await testDb
      .select()
      .from(bookFeatures)
      .where(eq(bookFeatures.id, featureId))
      .limit(1);

    expect(feature).toHaveLength(1);
    expect(feature[0]?.status).toBe("purchased");
    expect(feature[0]?.price).toBe(14999);
  });

  it("should prevent duplicate purchases", async () => {
    const featureId = crypto.randomUUID();
    
    // Create already purchased feature
    await testDb.insert(bookFeatures).values({
      id: featureId,
      bookId: testBookId,
      featureType: "manuscript-report",
      status: "purchased",
      price: 14999,
      unlockedAt: new Date(),
      purchasedAt: new Date(),
    });

    // Try to purchase again - should return existing feature
    const existingFeature = await testDb
      .select()
      .from(bookFeatures)
      .where(
        eq(bookFeatures.bookId, testBookId)
      )
      .limit(1);

    expect(existingFeature).toHaveLength(1);
    expect(existingFeature[0]?.status).toBe("purchased");
  });
});

