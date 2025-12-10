import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { purchases, books } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/user/upload-permission
 * Check if user has paid for book upload permission
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if user has a completed purchase for book-upload
    // book-upload is a user-level feature (no bookId required, bookId is null)
    const uploadPurchases = await db
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.userId, session.user.id),
          eq(purchases.featureType, "book-upload")
        )
      );

    // Filter for purchases with null/undefined/empty bookId (user-level purchases)
    const userLevelPurchases = uploadPurchases.filter(p => 
      p.bookId === null || 
      p.bookId === undefined || 
      p.bookId === ""
    );
    
    console.log(`[Upload Permission] User ${session.user.id}: Found ${uploadPurchases.length} total upload purchase(s), ${userLevelPurchases.length} user-level purchase(s)`);
    if (userLevelPurchases.length > 0) {
      console.log(`[Upload Permission] Purchase details:`, userLevelPurchases.map(p => ({
        id: p.id,
        status: p.status,
        bookId: p.bookId,
        paymentMethod: p.paymentMethod,
        createdAt: p.createdAt,
        completedAt: p.completedAt,
      })));
    }
    
    // Count valid upload permissions purchased (ONLY completed purchases)
    // Pending purchases do NOT grant permission - user must wait for payment to complete
    const completedPurchases = userLevelPurchases.filter(p => p.status === "completed");
    
    const totalPermissionsPurchased = completedPurchases.length;
    
    // Count books uploaded by this user (excluding sample books)
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
    
    const booksUploaded = userBooks.filter(book => !isSampleBook(book.title)).length;
    
    // Check if user has remaining upload permissions
    // One purchase = one upload permission
    const hasPermission = booksUploaded < totalPermissionsPurchased;
    const remainingPermissions = totalPermissionsPurchased - booksUploaded;
    
    console.log(`[Upload Permission] User ${session.user.id}: ${totalPermissionsPurchased} permission(s) purchased, ${booksUploaded} book(s) uploaded, remaining: ${remainingPermissions}, hasPermission: ${hasPermission}`);
    
    if (!hasPermission) {
      // No permission - user has used all their upload permissions
      console.log(`[Upload Permission] User ${session.user.id}: No remaining upload permissions (${booksUploaded} books uploaded >= ${totalPermissionsPurchased} permissions purchased)`);
      
      return NextResponse.json({
        hasPermission: false,
        purchase: null,
        permissionsPurchased: totalPermissionsPurchased,
        booksUploaded: booksUploaded,
        remainingPermissions: 0,
      });
    }
    
    // User has permission - return purchase details (only completed purchases)
    let purchaseToReturn = null;
    
    if (completedPurchases.length > 0) {
      // Return most recent completed purchase
      purchaseToReturn = completedPurchases.sort((a, b) => {
        const aTime = a.completedAt?.getTime() || 0;
        const bTime = b.completedAt?.getTime() || 0;
        return bTime - aTime; // Most recent first
      })[0];
    }
    
    return NextResponse.json({
      hasPermission: true,
      purchase: purchaseToReturn,
      pending: false, // Always false - only completed purchases grant permission
      permissionsPurchased: totalPermissionsPurchased,
      booksUploaded: booksUploaded,
      remainingPermissions: remainingPermissions,
    });
  } catch (error) {
    console.error("Failed to check upload permission:", error);
    return NextResponse.json(
      { error: "Failed to check upload permission" },
      { status: 500 }
    );
  }
}

