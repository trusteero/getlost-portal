import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { purchases } from "@/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";

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

    // Filter for purchases with null bookId (user-level purchases)
    const userLevelPurchases = uploadPurchases.filter(p => p.bookId === null || p.bookId === undefined);
    
    // Check for completed purchases first
    const completedPurchases = userLevelPurchases.filter(p => p.status === "completed");
    
    if (completedPurchases.length > 0) {
      // Get the most recent completed purchase
      const uploadPurchase = completedPurchases.sort((a, b) => {
        const aTime = a.completedAt?.getTime() || 0;
        const bTime = b.completedAt?.getTime() || 0;
        return bTime - aTime; // Most recent first
      })[0];

      console.log(`[Upload Permission] User ${session.user.id}: Found ${completedPurchases.length} completed upload purchase(s), hasPermission: true`);
      return NextResponse.json({
        hasPermission: true,
        purchase: uploadPurchase,
      });
    }

    // Fallback: Check for pending purchases that have a payment method
    // (these went through checkout and should be valid, even if webhook hasn't processed them yet)
    // We'll accept pending purchases that are older than 5 minutes (webhook should have processed by then)
    // OR very recent ones (within 5 minutes, webhook might still be processing)
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60; // Unix timestamp in seconds
    const validPendingPurchases = userLevelPurchases.filter(p => {
      if (p.status !== "pending") return false;
      // Must have a payment method (went through checkout)
      if (!p.paymentMethod) return false;
      
      // Check createdAt timestamp (SQLite stores as integer in seconds)
      const createdAt = typeof p.createdAt === 'number' 
        ? p.createdAt 
        : (p.createdAt ? new Date(p.createdAt).getTime() / 1000 : 0);
      
      // Accept if older than 5 minutes (stuck pending) OR very recent (within 5 minutes)
      // This covers both stuck webhooks and recent purchases
      return createdAt > 0;
    });

    if (validPendingPurchases.length > 0) {
      const validPurchase = validPendingPurchases.sort((a, b) => {
        const aTime = typeof a.createdAt === 'number' 
          ? a.createdAt 
          : (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
        const bTime = typeof b.createdAt === 'number' 
          ? b.createdAt 
          : (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
        return bTime - aTime; // Most recent first
      })[0];

      const createdAt = typeof validPurchase.createdAt === 'number' 
        ? validPurchase.createdAt 
        : (validPurchase.createdAt ? new Date(validPurchase.createdAt).getTime() / 1000 : 0);
      const ageMinutes = createdAt > 0 ? Math.floor((Math.floor(Date.now() / 1000) - createdAt) / 60) : 0;
      
      console.log(`[Upload Permission] User ${session.user.id}: Found valid pending purchase (${validPurchase.id}, age: ${ageMinutes} minutes, paymentMethod: ${validPurchase.paymentMethod}), granting permission`);
      return NextResponse.json({
        hasPermission: true,
        purchase: validPurchase,
        pending: true, // Indicate this is a pending purchase
      });
    }

    console.log(`[Upload Permission] User ${session.user.id}: Found ${userLevelPurchases.length} upload purchase(s) total, but none completed or recent pending, hasPermission: false`);

    return NextResponse.json({
      hasPermission: false,
      purchase: null,
    });
  } catch (error) {
    console.error("Failed to check upload permission:", error);
    return NextResponse.json(
      { error: "Failed to check upload permission" },
      { status: 500 }
    );
  }
}

