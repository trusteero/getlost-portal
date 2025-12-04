import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { purchases } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/admin/fix-pending-purchases
 * Admin endpoint to fix pending purchases that should be completed
 * This is a temporary fix for purchases stuck in pending status
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const isAdmin = (session.user as any)?.role === "admin" || (session.user as any)?.role === "super_admin";
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    // Get all pending book-upload purchases older than 5 minutes
    // (these should have been processed by webhook by now)
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60; // Unix timestamp in seconds
    
    const pendingPurchases = await db
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.featureType, "book-upload"),
          eq(purchases.status, "pending")
        )
      );

    console.log(`[Fix Pending] Found ${pendingPurchases.length} pending book-upload purchases`);

    const purchasesToFix = pendingPurchases.filter(p => {
      // Check if purchase is older than 5 minutes
      const createdAt = typeof p.createdAt === 'number' ? p.createdAt : (p.createdAt ? new Date(p.createdAt).getTime() / 1000 : 0);
      return createdAt > 0 && createdAt < fiveMinutesAgo;
    });

    console.log(`[Fix Pending] Found ${purchasesToFix.length} purchases to fix (older than 5 minutes)`);

    let fixedCount = 0;
    for (const purchase of purchasesToFix) {
      // Only fix purchases with paymentMethod (meaning they went through checkout)
      if (purchase.paymentMethod) {
        await db
          .update(purchases)
          .set({
            status: "completed",
            completedAt: new Date(),
          })
          .where(eq(purchases.id, purchase.id));
        
        fixedCount++;
        console.log(`[Fix Pending] Fixed purchase ${purchase.id} for user ${purchase.userId}`);
      }
    }

    return NextResponse.json({
      message: `Fixed ${fixedCount} pending purchases`,
      totalPending: pendingPurchases.length,
      fixed: fixedCount,
    });
  } catch (error) {
    console.error("Failed to fix pending purchases:", error);
    return NextResponse.json(
      { error: "Failed to fix pending purchases" },
      { status: 500 }
    );
  }
}

