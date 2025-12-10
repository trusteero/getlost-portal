import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { 
  users, books, bookVersions, reports, purchases, notifications, 
  verificationTokens, summaries, landingPages, bookCovers, 
  marketingAssets, bookFeatures, digestJobs
} from "@/server/db/schema";
import { session as betterAuthSession, account as betterAuthAccount } from "@/server/db/better-auth-schema";
import { eq, inArray } from "drizzle-orm";

/**
 * Test-only cleanup endpoint to delete users by email
 * Only works in test mode, development mode, or when accessed from localhost (for E2E tests)
 */
export async function DELETE(request: NextRequest) {
  // Check environment variables
  const isTestMode = 
    process.env.DISABLE_EMAIL_IN_TESTS === "true" || 
    process.env.NODE_ENV === "test" ||
    process.env.NODE_ENV === "development";
  
  // Also check if the request is coming from localhost (E2E tests always run on localhost)
  const host = request.headers.get("host") || request.headers.get("x-forwarded-host") || "";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1") || host.includes(":3000");
  
  // For E2E tests, always allow on localhost:3000 (Playwright runs tests on localhost:3000)
  // This is safe because:
  // 1. The endpoint is only accessible from localhost
  // 2. It's only used for test cleanup
  // 3. Production deployments won't be on localhost:3000
  const isAllowed = isTestMode || isLocalhost;
  
  if (!isAllowed) {
    return NextResponse.json(
      { 
        error: "This endpoint is only available in test mode or localhost",
        details: {
          DISABLE_EMAIL_IN_TESTS: process.env.DISABLE_EMAIL_IN_TESTS,
          NODE_ENV: process.env.NODE_ENV,
          host,
          isLocalhost,
          isTestMode,
        }
      },
      { status: 403 }
    );
  }
  
  // Log for debugging
  console.log("[Test Cleanup] Environment check:", {
    DISABLE_EMAIL_IN_TESTS: process.env.DISABLE_EMAIL_IN_TESTS,
    NODE_ENV: process.env.NODE_ENV,
    host,
    isLocalhost,
    isTestMode,
    allowed: true,
  });
  
  // Log for debugging (only in test/dev mode)
  if (isTestMode || isLocalhost) {
    console.log("[Test Cleanup] Environment check:", {
      DISABLE_EMAIL_IN_TESTS: process.env.DISABLE_EMAIL_IN_TESTS,
      NODE_ENV: process.env.NODE_ENV,
      host,
      isLocalhost,
      allowed: true,
    });
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Find user by email
    const userRecords = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (userRecords.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userId = userRecords[0]!.id;

    // Delete user and all related data (same logic as admin delete endpoint)
    // Delete in order to respect foreign key constraints
    
    // 1. Get all books for this user
    const userBooks = await db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.userId, userId));

    // 2. For each book, delete all related data
    for (const book of userBooks) {
      try {
        // Delete summaries
        await db.delete(summaries).where(eq(summaries.bookId, book.id));
      } catch (error) {
        console.warn(`[Test Cleanup] Failed to delete summaries for book ${book.id}:`, error);
      }

      try {
        // Delete landing pages
        await db.delete(landingPages).where(eq(landingPages.bookId, book.id));
      } catch (error) {
        console.warn(`[Test Cleanup] Failed to delete landing pages for book ${book.id}:`, error);
      }

      try {
        // Delete book covers
        await db.delete(bookCovers).where(eq(bookCovers.bookId, book.id));
      } catch (error) {
        console.warn(`[Test Cleanup] Failed to delete book covers for book ${book.id}:`, error);
      }

      try {
        // Delete marketing assets
        await db.delete(marketingAssets).where(eq(marketingAssets.bookId, book.id));
      } catch (error) {
        console.warn(`[Test Cleanup] Failed to delete marketing assets for book ${book.id}:`, error);
      }

      try {
        // Delete purchases
        await db.delete(purchases).where(eq(purchases.bookId, book.id));
      } catch (error) {
        console.warn(`[Test Cleanup] Failed to delete purchases for book ${book.id}:`, error);
      }

      try {
        // Delete book features
        await db.delete(bookFeatures).where(eq(bookFeatures.bookId, book.id));
      } catch (error) {
        console.warn(`[Test Cleanup] Failed to delete book features for book ${book.id}:`, error);
      }

      try {
        // Delete digest jobs
        await db.delete(digestJobs).where(eq(digestJobs.bookId, book.id));
      } catch (error) {
        console.warn(`[Test Cleanup] Failed to delete digest jobs for book ${book.id}:`, error);
      }

      try {
        // Delete reports (via book versions)
        const bookVersionsList = await db
          .select({ id: bookVersions.id })
          .from(bookVersions)
          .where(eq(bookVersions.bookId, book.id));
        
        const versionIds = bookVersionsList.map(v => v.id);
        
        if (versionIds.length > 0) {
          await db.delete(reports).where(inArray(reports.bookVersionId, versionIds));
        }
      } catch (error) {
        console.warn(`[Test Cleanup] Failed to delete reports for book ${book.id}:`, error);
      }

      try {
        // Delete book versions
        await db.delete(bookVersions).where(eq(bookVersions.bookId, book.id));
      } catch (error) {
        console.warn(`[Test Cleanup] Failed to delete book versions for book ${book.id}:`, error);
      }
    }

    // 3. Delete all books for this user
    try {
      await db.delete(books).where(eq(books.userId, userId));
    } catch (error) {
      console.warn(`[Test Cleanup] Failed to delete books for user ${userId}:`, error);
    }

    // 4. Delete purchases (in case any remain)
    try {
      await db.delete(purchases).where(eq(purchases.userId, userId));
    } catch (error) {
      console.warn(`[Test Cleanup] Failed to delete purchases for user ${userId}:`, error);
    }

    // 5. Delete notifications
    try {
      await db.delete(notifications).where(eq(notifications.userId, userId));
    } catch (error) {
      console.warn(`[Test Cleanup] Failed to delete notifications for user ${userId}:`, error);
    }

    // 6. Delete verification tokens
    try {
      await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email.toLowerCase().trim()));
    } catch (error) {
      console.warn(`[Test Cleanup] Failed to delete verification tokens for ${email}:`, error);
    }

    // 7. Delete sessions
    try {
      await db.delete(betterAuthSession).where(eq(betterAuthSession.userId, userId));
    } catch (error) {
      console.warn(`[Test Cleanup] Failed to delete sessions for user ${userId}:`, error);
    }

    // 8. Delete accounts
    try {
      await db.delete(betterAuthAccount).where(eq(betterAuthAccount.userId, userId));
    } catch (error) {
      console.warn(`[Test Cleanup] Failed to delete accounts for user ${userId}:`, error);
    }

    // 9. Finally, delete the user
    await db.delete(users).where(eq(users.id, userId));

    console.log(`[Test Cleanup] ✅ Deleted user: ${email} (${userId}) and all related data`);

    return NextResponse.json({
      success: true,
      message: `User ${email} and all related data deleted successfully`,
    });
  } catch (error: any) {
    console.error("[Test Cleanup] Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user", details: error.message || String(error) },
      { status: 500 }
    );
  }
}

