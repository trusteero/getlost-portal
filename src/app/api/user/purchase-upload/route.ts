import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { purchases } from "@/server/db/schema";
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
    // Check if user already has upload permission
    // First get all book-upload purchases for this user
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

    // Filter for user-level purchases (bookId is null or undefined)
    const userLevelPurchases = allUploadPurchases.filter(p => p.bookId === null || p.bookId === undefined);
    
    if (userLevelPurchases.length > 0) {
      const existingPurchase = userLevelPurchases[0];
      if (existingPurchase) {
        console.log(`[Purchase Upload] User ${session.user.id} already has upload permission (purchase: ${existingPurchase.id})`);
        return NextResponse.json({
          message: "Upload permission already purchased",
          purchase: existingPurchase,
        });
      }
    }

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

