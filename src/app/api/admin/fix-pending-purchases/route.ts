import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { purchases } from "@/server/db/schema";
import { eq, and, inArray } from "drizzle-orm";

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
  const userRole = (session.user as { role?: string })?.role;
  const isAdmin = userRole === "admin" || userRole === "super_admin";
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    // Get all pending purchases older than 30 minutes.
    // We intentionally do NOT auto-complete anything here; we mark as failed to avoid granting entitlements incorrectly.
    const cutoffSeconds = Math.floor(Date.now() / 1000) - 30 * 60; // Unix timestamp in seconds

    const PENDING_CLEANUP_FEATURE_TYPES = [
      "book-upload",
      "dna-report",
      "market-validation-report",
      "market-ready-pack",
      "growth-partnership",
    ] as const;

    const pendingPurchases = await db
      .select()
      .from(purchases)
      .where(
        and(
          inArray(purchases.featureType, PENDING_CLEANUP_FEATURE_TYPES as unknown as string[]),
          eq(purchases.status, "pending")
        )
      );

    console.log(`[Fix Pending] Found ${pendingPurchases.length} pending purchase(s) in scope`);

    const purchasesToMarkFailed = pendingPurchases.filter((p) => {
      const createdAtSeconds =
        typeof p.createdAt === "number"
          ? p.createdAt
          : p.createdAt
            ? new Date(p.createdAt).getTime() / 1000
            : 0;
      return createdAtSeconds > 0 && createdAtSeconds < cutoffSeconds;
    });

    console.log(`[Fix Pending] Found ${purchasesToMarkFailed.length} pending purchase(s) to mark failed (older than 30 minutes)`);

    let failedCount = 0;
    for (const purchase of purchasesToMarkFailed) {
      await db
        .update(purchases)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(purchases.id, purchase.id));

      failedCount++;
      console.log(`[Fix Pending] Marked purchase ${purchase.id} as failed (featureType=${purchase.featureType}, user=${purchase.userId})`);
    }

    return NextResponse.json({
      message: `Marked ${failedCount} stale pending purchases as failed`,
      totalPendingInScope: pendingPurchases.length,
      markedFailed: failedCount,
    });
  } catch (error) {
    console.error("Failed to fix pending purchases:", error);
    return NextResponse.json(
      { error: "Failed to fix pending purchases" },
      { status: 500 }
    );
  }
}

