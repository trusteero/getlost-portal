import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { purchases, books } from "@/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";

const UPLOAD_PRICE = 9999; // $99.99 in cents

/**
 * POST /api/user/purchase-upload
 * Purchase book upload permission (simulated or Stripe)
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if user already has REMAINING upload permission
    // Get all completed book-upload purchases for this user
    // Note: Only completed purchases grant permission
    const allUploadPurchases = await db
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.userId, session.user.id),
          eq(purchases.featureType, "book-upload"),
          eq(purchases.status, "completed")
        )
      );
    
    console.log(`[Purchase Upload] User ${session.user.id}: Found ${allUploadPurchases.length} completed purchase(s)`);

    // Filter for user-level purchases (bookId is null or undefined)
    const userLevelPurchases = allUploadPurchases.filter(p => p.bookId === null || p.bookId === undefined);
    
    console.log(`[Purchase Upload] User ${session.user.id}: Found ${userLevelPurchases.length} user-level completed purchase(s)`);
    
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
    
    const allBooks = userBooks.map(b => b.title).filter(Boolean);
    const booksUploaded = userBooks.filter(book => !isSampleBook(book.title)).length;
    const totalPermissionsPurchased = userLevelPurchases.length;
    const remainingPermissions = totalPermissionsPurchased - booksUploaded;
    
    console.log(`[Purchase Upload] User ${session.user.id}: Calculation details:`);
    console.log(`  - Completed purchases: ${totalPermissionsPurchased}`);
    console.log(`  - All books: ${allBooks.join(", ") || "none"}`);
    console.log(`  - Books uploaded (excluding samples): ${booksUploaded}`);
    console.log(`  - Remaining permissions: ${remainingPermissions}`);
    
    // Only return "already purchased" if they have REMAINING permissions
    if (remainingPermissions > 0) {
      const existingPurchase = userLevelPurchases[0];
      if (existingPurchase) {
        console.log(`[Purchase Upload] ✅ User ${session.user.id} already has ${remainingPermissions} remaining upload permission(s) - no new purchase needed`);
        return NextResponse.json({
          message: "Upload permission already purchased",
          purchase: existingPurchase,
          remainingPermissions,
        });
      }
    }
    
    // User has used all their permissions (or has none), allow new purchase
    console.log(`[Purchase Upload] ➕ User ${session.user.id} needs new purchase (${totalPermissionsPurchased} purchased, ${booksUploaded} used, ${remainingPermissions} remaining) - proceeding with purchase`);

    // Check if we should force simulated purchases (for testing)
    const useSimulatedPurchases = process.env.USE_SIMULATED_PURCHASES === "true";

    // Check if Stripe is configured
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (useSimulatedPurchases || !stripeSecretKey || !stripePublishableKey) {
      // Simulated purchase
      const purchaseId = crypto.randomUUID();
      const purchaseData = {
        id: purchaseId,
        userId: session.user.id,
        bookId: null as string | null, // Explicitly set to null for user-level purchase
        featureType: "book-upload" as const,
        amount: UPLOAD_PRICE,
        currency: "USD" as const,
        paymentMethod: "simulated" as const,
        status: "completed" as const,
        completedAt: new Date(),
      };
      
      console.log(`[Purchase Upload] Creating simulated purchase for user ${session.user.id}:`, purchaseData);
      await db.insert(purchases).values(purchaseData);

      console.log(`[Purchase Upload] Purchase created successfully: ${purchaseId}`);
      return NextResponse.json({
        message: "Upload permission purchased (simulated)",
        purchase: {
          id: purchaseId,
          status: "completed",
        },
      });
    }

    // Stripe purchase - redirect to checkout
    // For user-level purchases, we'll use a special checkout flow
    return NextResponse.json({
      error: "Payment required",
      redirectToCheckout: true,
      price: UPLOAD_PRICE,
      message: "Please use the checkout endpoint to complete payment",
    }, { status: 402 });
  } catch (error) {
    console.error("Failed to purchase upload permission:", error);
    return NextResponse.json(
      { error: "Failed to purchase upload permission" },
      { status: 500 }
    );
  }
}

