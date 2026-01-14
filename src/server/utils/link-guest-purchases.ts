import { db, sqlite } from "@/server/db";
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
  console.log(`[Link Guest Purchases] 🔍 Function called for userId: ${userId}, email: ${email}`);
  
  const normalizedEmail = email.toLowerCase().trim();

  console.log(`[Link Guest Purchases] Looking for guest purchases with email: ${normalizedEmail}`);

  // Find all guest purchases with matching email (any status)
  // First, let's check what's actually in the database for debugging
  const allGuestPurchases = await db
    .select()
    .from(guestPurchases)
    .limit(10);
  
  console.log(`[Link Guest Purchases] Debug: Found ${allGuestPurchases.length} total guest purchase(s) in database`);
  allGuestPurchases.forEach((p) => {
    console.log(`[Link Guest Purchases] Debug: Purchase ${p.id} - email: "${p.guestEmail}", normalized: "${p.guestEmail.toLowerCase().trim()}", looking for: "${normalizedEmail}"`);
  });

  // Try Drizzle query first
  let guestPurchasesToLink = await db
    .select()
    .from(guestPurchases)
    .where(
      sql`LOWER(TRIM(guestEmail)) = ${normalizedEmail}`
    );

  console.log(`[Link Guest Purchases] Drizzle query result: Found ${guestPurchasesToLink.length} purchase(s) matching email "${normalizedEmail}"`);

  // If Drizzle query found nothing, try direct SQL as fallback
  if (guestPurchasesToLink.length === 0 && sqlite) {
    console.log(`[Link Guest Purchases] Drizzle query found nothing, trying direct SQL query...`);
    try {
      const directQuery = sqlite
        .prepare(`SELECT * FROM getlostportal_guest_purchase WHERE LOWER(TRIM(guestEmail)) = LOWER(TRIM(?))`)
        .all(normalizedEmail);
      
      console.log(`[Link Guest Purchases] Direct SQL query found ${directQuery.length} purchase(s)`);
      
      if (directQuery.length > 0) {
        // Convert raw SQL results to match Drizzle format
        guestPurchasesToLink = directQuery.map((row: any) => ({
          id: row.id,
          guestEmail: row.guestEmail,
          bookId: row.bookId,
          featureType: row.featureType,
          amount: row.amount,
          currency: row.currency,
          paymentMethod: row.paymentMethod,
          paymentIntentId: row.paymentIntentId,
          status: row.status,
          completedAt: row.completedAt ? new Date(row.completedAt * 1000) : null,
          createdAt: row.createdAt ? new Date(row.createdAt * 1000) : new Date(),
          updatedAt: row.updatedAt ? new Date(row.updatedAt * 1000) : new Date(),
        })) as typeof guestPurchasesToLink;
        console.log(`[Link Guest Purchases] ✅ Using direct SQL query results (${guestPurchasesToLink.length} purchase(s))`);
      }
    } catch (sqlError: any) {
      console.error(`[Link Guest Purchases] Direct SQL query failed:`, sqlError);
    }
  }

  if (guestPurchasesToLink.length === 0) {
    console.log(`[Link Guest Purchases] No guest purchases found for email: ${normalizedEmail}`);
    console.log(`[Link Guest Purchases] Debug: Available emails in database:`, allGuestPurchases.map(p => p.guestEmail));
    return [];
  }

  console.log(`[Link Guest Purchases] Found ${guestPurchasesToLink.length} guest purchase(s) to link`);
  
  // Log details of each purchase being linked
  guestPurchasesToLink.forEach((p) => {
    console.log(`[Link Guest Purchases] Purchase details:`, {
      id: p.id,
      featureType: p.featureType,
      status: p.status,
      amount: p.amount,
      currency: p.currency,
      paymentMethod: p.paymentMethod,
      completedAt: p.completedAt,
    });
  });

  const linkedPurchaseIds: string[] = [];

  // Move each guest purchase to main purchases table
  for (const guestPurchase of guestPurchasesToLink) {
    try {
      // Convert "book-upload" to "market-validation-report" when migrating
      // The guest purchase uses STRIPE_PRICE_BOOK_UPLOAD_PROMO (promo price),
      // but product-wise it's the same as market-validation-report
      const migratedFeatureType = guestPurchase.featureType === "book-upload" 
        ? "market-validation-report" 
        : guestPurchase.featureType;

      if (guestPurchase.featureType === "book-upload") {
        console.log(`[Link Guest Purchases] 🔄 Converting book-upload to market-validation-report for purchase ${guestPurchase.id}`);
      }

      // Check if purchase already exists in purchases table (idempotency)
      const [existingPurchase] = await db
        .select()
        .from(purchases)
        .where(eq(purchases.id, guestPurchase.id))
        .limit(1);

      if (existingPurchase) {
        console.log(`[Link Guest Purchases] ⚠️ Purchase ${guestPurchase.id} already exists in purchases table (userId: ${existingPurchase.userId})`);
        // If it belongs to a different user, that's an error
        if (existingPurchase.userId !== userId) {
          console.error(`[Link Guest Purchases] ❌ Purchase ${guestPurchase.id} already belongs to user ${existingPurchase.userId}, cannot link to ${userId}`);
          // Don't throw - just skip this purchase
          continue;
        }
        // If it already belongs to this user, just delete from guest_purchases and continue
        console.log(`[Link Guest Purchases] ✅ Purchase ${guestPurchase.id} already linked to user ${userId}, just cleaning up guest_purchases table`);
      } else {
        // Insert into main purchases table
        console.log(`[Link Guest Purchases] Attempting to insert purchase ${guestPurchase.id} into purchases table...`);
        try {
          await db.insert(purchases).values({
            id: guestPurchase.id,
            userId,
            bookId: guestPurchase.bookId,
            featureType: migratedFeatureType,
            amount: guestPurchase.amount,
            currency: guestPurchase.currency,
            paymentMethod: guestPurchase.paymentMethod,
            paymentIntentId: guestPurchase.paymentIntentId,
            status: guestPurchase.status,
            completedAt: guestPurchase.completedAt,
            createdAt: guestPurchase.createdAt,
            updatedAt: new Date(),
          });
          console.log(`[Link Guest Purchases] ✅ Successfully inserted purchase ${guestPurchase.id} into purchases table`);
        } catch (insertError: any) {
          console.error(`[Link Guest Purchases] ❌ Failed to insert purchase ${guestPurchase.id} into purchases table:`, insertError);
          console.error(`[Link Guest Purchases] Insert error details:`, {
            message: insertError?.message,
            stack: insertError?.stack,
            code: insertError?.code,
            cause: insertError?.cause,
          });
          throw insertError; // Re-throw to be caught by outer catch
        }
      }

      // Delete from guest purchases table
      console.log(`[Link Guest Purchases] Attempting to delete purchase ${guestPurchase.id} from guest_purchases table...`);
      try {
        await db
          .delete(guestPurchases)
          .where(eq(guestPurchases.id, guestPurchase.id));
        console.log(`[Link Guest Purchases] ✅ Successfully deleted purchase ${guestPurchase.id} from guest_purchases table`);
      } catch (deleteError: any) {
        console.error(`[Link Guest Purchases] ❌ Failed to delete purchase ${guestPurchase.id} from guest_purchases table:`, deleteError);
        // Don't throw - purchase is already in purchases table, so deletion failure is less critical
        // But log it so we know something went wrong
      }

      linkedPurchaseIds.push(guestPurchase.id);

      const statusNote = guestPurchase.status === "completed" 
        ? "✅ (will grant upload permission)" 
        : "⚠️ (pending - webhook will complete it)";
      
      console.log(`[Link Guest Purchases] ✅ Linked purchase ${guestPurchase.id} to user ${userId} (featureType: ${migratedFeatureType}, status: ${guestPurchase.status}) ${statusNote}`);
    } catch (error) {
      console.error(`[Link Guest Purchases] ❌ Failed to link purchase ${guestPurchase.id}:`, error);
      // Continue with other purchases even if one fails
    }
  }

  console.log(`[Link Guest Purchases] ✅ Linked ${linkedPurchaseIds.length} purchase(s) to user ${userId}`);

  return linkedPurchaseIds;
}

