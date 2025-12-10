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

    // Count ONLY completed purchases for the credits display
    // Pending purchases do NOT count - user must wait for payment to complete
    const completedPurchases = userLevelPurchases.filter(p => p.status === "completed");
    
    console.log(`[Credits] User ${session.user.id}: Found ${completedPurchases.length} completed purchase(s)`);
    
    const uploadCount = completedPurchases.length;
    
    // Calculate total funds spent (in cents, convert to dollars) - only from completed purchases
    const totalSpent = completedPurchases.reduce((sum, purchase) => sum + (purchase.amount || 0), 0);
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
      uploadPermissionsPurchased: uploadCount, // Number of times user purchased upload permission (only completed)
      booksUploaded: booksUploadedCount, // Number of books actually uploaded
      totalSpent: totalSpentDollars,
      uploadPurchases: completedPurchases.map(p => ({
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

