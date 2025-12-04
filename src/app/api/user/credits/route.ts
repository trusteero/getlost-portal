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

    // Count completed purchases for the credits display
    const completedPurchases = userLevelPurchases.filter(p => p.status === "completed");
    
    // Also check for pending purchases that are older than 5 minutes
    // (these should have been completed by webhook, but might be stuck)
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60;
    const stuckPendingPurchases = userLevelPurchases.filter(p => {
      if (p.status !== "pending") return false;
      const createdAt = typeof p.createdAt === 'number' ? p.createdAt : (p.createdAt ? new Date(p.createdAt).getTime() / 1000 : 0);
      return createdAt > 0 && createdAt < fiveMinutesAgo && p.paymentMethod; // Has payment method means it went through checkout
    });
    
    // Count both completed and stuck pending purchases
    const allValidPurchases = [...completedPurchases, ...stuckPendingPurchases];
    
    console.log(`[Credits] User ${session.user.id}: Found ${completedPurchases.length} completed, ${stuckPendingPurchases.length} stuck pending purchase(s)`);
    
    const uploadCount = allValidPurchases.length;
    
    // Calculate total funds spent (in cents, convert to dollars)
    const totalSpent = allValidPurchases.reduce((sum, purchase) => sum + (purchase.amount || 0), 0);
    const totalSpentDollars = totalSpent / 100;

    // Count actual books uploaded by this user
    const userBooks = await db
      .select()
      .from(books)
      .where(eq(books.userId, session.user.id));
    
    const booksUploadedCount = userBooks.length;

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

