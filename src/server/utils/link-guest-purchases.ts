import { db } from "@/server/db";
import { purchases, guestPurchases } from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Link guest purchases to a user account after signup
 * Moves completed guest purchases from guest_purchases to purchases table
 * 
 * @param userId - The user ID to link purchases to
 * @param email - The user's email (used to match guest purchases)
 * @returns Array of linked purchase IDs
 */
export async function linkGuestPurchasesToUser(
  userId: string,
  email: string
): Promise<string[]> {
  const normalizedEmail = email.toLowerCase().trim();

  console.log(`[Link Guest Purchases] Looking for guest purchases with email: ${normalizedEmail}`);

  // Find all guest purchases with matching email (any status)
  const guestPurchasesToLink = await db
    .select()
    .from(guestPurchases)
    .where(
      sql`LOWER(TRIM(guestEmail)) = ${normalizedEmail}`
    );

  if (guestPurchasesToLink.length === 0) {
    console.log(`[Link Guest Purchases] No guest purchases found for email: ${normalizedEmail}`);
    return [];
  }

  console.log(`[Link Guest Purchases] Found ${guestPurchasesToLink.length} guest purchase(s) to link`);

  const linkedPurchaseIds: string[] = [];

  // Move each guest purchase to main purchases table
  for (const guestPurchase of guestPurchasesToLink) {
    try {
      // Insert into main purchases table
      await db.insert(purchases).values({
        id: guestPurchase.id,
        userId,
        bookId: guestPurchase.bookId,
        featureType: guestPurchase.featureType,
        amount: guestPurchase.amount,
        currency: guestPurchase.currency,
        paymentMethod: guestPurchase.paymentMethod,
        paymentIntentId: guestPurchase.paymentIntentId,
        status: guestPurchase.status,
        completedAt: guestPurchase.completedAt,
        createdAt: guestPurchase.createdAt,
        updatedAt: new Date(),
      });

      // Delete from guest purchases table
      await db
        .delete(guestPurchases)
        .where(eq(guestPurchases.id, guestPurchase.id));

      linkedPurchaseIds.push(guestPurchase.id);

      console.log(`[Link Guest Purchases] ✅ Linked purchase ${guestPurchase.id} to user ${userId} (status: ${guestPurchase.status})`);
    } catch (error) {
      console.error(`[Link Guest Purchases] ❌ Failed to link purchase ${guestPurchase.id}:`, error);
      // Continue with other purchases even if one fails
    }
  }

  console.log(`[Link Guest Purchases] ✅ Linked ${linkedPurchaseIds.length} purchase(s) to user ${userId}`);

  return linkedPurchaseIds;
}

