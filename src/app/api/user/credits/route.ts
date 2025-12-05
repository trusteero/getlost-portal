import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { purchases, books } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/user/credits
 * Get user's credits and upload count
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all upload purchases for this user (any status)
    const allUploadPurchases = await db
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.userId, session.user.id),
          eq(purchases.featureType, "book-upload")
        )
      );

    console.log(`[Credits] User ${session.user.id}: Found ${allUploadPurchases.length} total upload purchase(s)`);
    if (allUploadPurchases.length > 0) {
      console.log(`[Credits] All purchase details:`, JSON.stringify(allUploadPurchases.map(p => ({
        id: p.id,
        bookId: p.bookId,
        status: p.status,
        amount: p.amount,
        createdAt: p.createdAt,
        completedAt: p.completedAt,
        paymentMethod: p.paymentMethod,
      })), null, 2));
    }

    // Filter for user-level purchases (bookId is null, undefined, or empty string)
    const userLevelPurchases = allUploadPurchases.filter(p => 
      p.bookId === null || 
      p.bookId === undefined || 
      p.bookId === ""
    );
    
    console.log(`[Credits] User ${session.user.id}: Found ${userLevelPurchases.length} user-level purchase(s) (after filtering)`);
    if (userLevelPurchases.length > 0) {
      console.log(`[Credits] User-level purchase statuses:`, userLevelPurchases.map(p => ({
        id: p.id,
        status: p.status,
        paymentMethod: p.paymentMethod,
        createdAt: p.createdAt,
        completedAt: p.completedAt,
      })));
    }

    // Count completed purchases for the credits display
    const completedPurchases = userLevelPurchases.filter(p => p.status === "completed");
    
    // Also check for pending purchases that have a payment method
    // (these went through checkout and should be valid, even if webhook hasn't processed them yet)
    // Accept any pending purchase with payment method (regardless of age) to match upload-permission logic
    const validPendingPurchases = userLevelPurchases.filter(p => {
      if (p.status !== "pending") return false;
      if (!p.paymentMethod) return false; // Must have payment method (went through checkout)
      const createdAt = typeof p.createdAt === 'number' ? p.createdAt : (p.createdAt ? new Date(p.createdAt).getTime() / 1000 : 0);
      return createdAt > 0; // Valid timestamp
    });
    
    // Also check for any other statuses that might indicate a valid purchase
    // (e.g., if webhook set it to a different status)
    const otherValidPurchases = userLevelPurchases.filter(p => {
      if (p.status === "completed" || p.status === "pending") return false; // Already counted
      // If it has a payment method and completedAt, it's likely valid
      return !!(p.paymentMethod && p.completedAt);
    });
    
    // Count all valid purchases
    const allValidPurchases = [...completedPurchases, ...validPendingPurchases, ...otherValidPurchases];
    
    console.log(`[Credits] User ${session.user.id}: Found ${completedPurchases.length} completed, ${validPendingPurchases.length} valid pending, ${otherValidPurchases.length} other valid purchase(s)`);
    
    const uploadCount = allValidPurchases.length;
    
    // Calculate total funds spent (in cents, convert to dollars)
    const totalSpent = allValidPurchases.reduce((sum, purchase) => sum + (purchase.amount || 0), 0);
    const totalSpentDollars = totalSpent / 100;

    // Count actual books uploaded by this user (excluding sample books)
    const userBooks = await db
      .select({
        id: books.id,
        title: books.title,
      })
      .from(books)
      .where(eq(books.userId, session.user.id));
    
    // Filter out sample books (Wool and Beach Read)
    const isSampleBook = (title: string | null | undefined): boolean => {
      return !!(title && (title.includes("Wool") || title.includes("Beach Read")));
    };
    
    const userBooksFiltered = userBooks.filter(book => !isSampleBook(book.title));
    const booksUploadedCount = userBooksFiltered.length;

    console.log(`[Credits] User ${session.user.id}: ${uploadCount} valid purchase(s), ${booksUploadedCount} book(s) uploaded, total spent: $${totalSpentDollars.toFixed(2)}`);

    return NextResponse.json({
      uploadPermissionsPurchased: uploadCount, // Number of times user purchased upload permission
      booksUploaded: booksUploadedCount, // Number of books actually uploaded
      totalSpent: totalSpentDollars,
      uploadPurchases: allValidPurchases.map(p => ({
        id: p.id,
        amount: p.amount / 100, // Convert cents to dollars
        completedAt: p.completedAt,
        paymentMethod: p.paymentMethod,
        status: p.status,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch user credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch user credits" },
      { status: 500 }
    );
  }
}

