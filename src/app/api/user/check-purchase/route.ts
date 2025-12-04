import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { purchases } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/user/check-purchase?purchaseId=xxx
 * Check if a specific purchase exists and its status
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const purchaseId = searchParams.get("purchaseId");

    if (!purchaseId) {
      return NextResponse.json({ error: "purchaseId required" }, { status: 400 });
    }

    // Get the purchase
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.id, purchaseId),
          eq(purchases.userId, session.user.id)
        )
      )
      .limit(1);

    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    // For book-upload, check if bookId is null
    const isUserLevelPurchase = purchase.featureType === "book-upload" && 
                                 (purchase.bookId === null || purchase.bookId === undefined);

    return NextResponse.json({
      purchase,
      isUserLevelPurchase,
      hasPermission: purchase.status === "completed" || 
                     (purchase.status === "pending" && isUserLevelPurchase), // Grant permission for pending user-level purchases
    });
  } catch (error) {
    console.error("Failed to check purchase:", error);
    return NextResponse.json(
      { error: "Failed to check purchase" },
      { status: 500 }
    );
  }
}

