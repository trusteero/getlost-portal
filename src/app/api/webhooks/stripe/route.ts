import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { purchases, bookFeatures, users, books } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type Stripe from "stripe";
import { rateLimitMiddleware, RATE_LIMITS } from "@/server/utils/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limiting for webhook endpoint (by IP, not user)
  // Note: Webhooks should be verified by Stripe signature, but rate limiting adds extra protection
  const rateLimitResponse = rateLimitMiddleware(
    request,
    "webhook:stripe",
    RATE_LIMITS.WEBHOOK
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error("Stripe not configured for webhooks");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  // Initialize Stripe
  const StripeLib = (await import("stripe")).default;
  const stripe = new StripeLib(stripeSecretKey, {
    apiVersion: "2025-11-17.clover", // Use API version expected by Stripe package types
  });

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    console.log(`[Webhook] 📥 Received Stripe webhook event: ${event.type} (id: ${event.id})`);
    const REPORT_PRODUCT_TYPES = new Set([
      "manuscript-report",
      "dna-report",
      "market-validation-report",
      "market-ready-pack",
      "growth-partnership",
    ]);
    const getEntitlementFeatureType = (purchaseFeatureType: string): string => {
      // For now, all report products unlock the same portal entitlement: manuscript-report
      if (REPORT_PRODUCT_TYPES.has(purchaseFeatureType)) return "manuscript-report";
      return purchaseFeatureType;
    };
    
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const purchaseId = session.client_reference_id || session.metadata?.purchaseId;

        console.log(`[Webhook] Processing checkout.session.completed for session ${session.id}`);
        console.log(`[Webhook] Purchase ID from session: ${purchaseId}`);

        if (!purchaseId) {
          console.error("[Webhook] ❌ No purchase ID in session");
          return NextResponse.json({ 
            received: true, 
            error: "No purchase ID in session",
            warning: true
          });
        }

        // Idempotency check: Get purchase details first to check if already processed
        const [existingPurchase] = await db
          .select()
          .from(purchases)
          .where(eq(purchases.id, purchaseId))
          .limit(1);

        if (!existingPurchase) {
          console.error(`[Webhook] ❌ Purchase ${purchaseId} not found in database`);
          return NextResponse.json({ 
            received: true, 
            error: `Purchase ${purchaseId} not found`,
            warning: true
          });
        }

        console.log(`[Webhook] Found purchase ${purchaseId} with status: ${existingPurchase.status}`);

        // Idempotency: Skip if already completed
        if (existingPurchase.status === "completed") {
          console.log(`[Webhook] ✅ Purchase ${purchaseId} already completed, skipping duplicate event ${event.id}`);
          return NextResponse.json({ 
            received: true, 
            message: "Already processed",
            purchaseId 
          });
        }

        // Wrap all database operations in a transaction for data integrity
        try {
          await db.transaction(async (tx) => {
            // Update purchase status (only if not already completed)
            await tx
              .update(purchases)
              .set({
                status: "completed",
                // For subscriptions, payment_intent can be null; store subscription id instead.
                paymentIntentId: (session.payment_intent as string) || (session.subscription as string) || session.id,
                completedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(purchases.id, purchaseId));

            console.log(`[Webhook] ✅ Updated purchase ${purchaseId} to completed status`);

            // Get purchase details after update (within transaction)
            const [purchase] = await tx
              .select()
              .from(purchases)
              .where(eq(purchases.id, purchaseId))
              .limit(1);

            if (purchase) {
              // For user-level purchases (book-upload), we don't need to create bookFeatures
              // The purchase record itself is sufficient
              if (purchase.featureType === "book-upload") {
                console.log(`[Webhook] ✅ Book upload permission purchased for user ${purchase.userId} (purchase ${purchaseId})`);
                return; // No bookFeatures needed for user-level purchases
              }

              // Create or update feature record for book-specific features
              if (!purchase.bookId) {
                console.warn(`[Webhook] Purchase ${purchaseId} has no bookId but is not book-upload`);
                return;
              }

              const entitlementFeatureType = getEntitlementFeatureType(purchase.featureType);

              // Idempotency: Check if feature already exists and is purchased
              const existingFeature = await tx
                .select()
                .from(bookFeatures)
                .where(
                  and(
                    eq(bookFeatures.bookId, purchase.bookId),
                    eq(bookFeatures.featureType, entitlementFeatureType)
                  )
                )
                .limit(1);

              if (existingFeature.length > 0) {
                // Idempotency: Only update if not already purchased
                if (existingFeature[0]!.status === "purchased") {
                  console.log(`[Webhook] Feature ${entitlementFeatureType} for book ${purchase.bookId} already purchased, skipping duplicate processing`);
                } else {
                  await tx
                    .update(bookFeatures)
                    .set({
                      status: "purchased",
                      unlockedAt: new Date(),
                      purchasedAt: new Date(),
                      price: purchase.amount,
                      updatedAt: new Date(),
                    })
                    .where(eq(bookFeatures.id, existingFeature[0]!.id));
                  console.log(`[Webhook] ✅ Updated feature ${entitlementFeatureType} for book ${purchase.bookId} to purchased`);
                }
              } else {
                await tx.insert(bookFeatures).values({
                  bookId: purchase.bookId,
                  featureType: entitlementFeatureType,
                  status: "purchased",
                  unlockedAt: new Date(),
                  purchasedAt: new Date(),
                  price: purchase.amount,
                });
                console.log(`[Webhook] ✅ Created feature ${entitlementFeatureType} for book ${purchase.bookId}`);
              }
            }
          });

          // Send notification to superadmin about completed payment (fire and forget)
          try {
            const { getSuperAdminEmails } = await import("@/server/utils/get-superadmin-emails");
            const { sendSuperAdminPaymentNotification } = await import("@/server/services/email");
            const superAdminEmails = await getSuperAdminEmails();
            
            // Get purchase details for notification (after transaction)
            const [purchaseForNotification] = await db
              .select()
              .from(purchases)
              .where(eq(purchases.id, purchaseId))
              .limit(1);

            if (purchaseForNotification && superAdminEmails.length > 0) {
              // Get user details
              const [user] = await db
                .select({
                  name: users.name,
                  email: users.email,
                })
                .from(users)
                .where(eq(users.id, purchaseForNotification.userId))
                .limit(1);

              const userName = user?.name || "Unknown";
              const userEmail = user?.email || "unknown@example.com";

              // Get book details if bookId exists
              let bookTitle: string | null = null;
              if (purchaseForNotification.bookId) {
                const [book] = await db
                  .select({
                    title: books.title,
                  })
                  .from(books)
                  .where(eq(books.id, purchaseForNotification.bookId))
                  .limit(1);
                bookTitle = book?.title || null;
              }

              // Send to all superadmins
              for (const superAdminEmail of superAdminEmails) {
                sendSuperAdminPaymentNotification(
                  superAdminEmail,
                  purchaseForNotification.id,
                  purchaseForNotification.featureType,
                  purchaseForNotification.amount,
                  purchaseForNotification.currency,
                  userName,
                  userEmail,
                  bookTitle,
                  purchaseForNotification.bookId
                ).catch((error) => {
                  console.error(`[Webhook] Failed to send payment notification to ${superAdminEmail}:`, error);
                });
              }
            }
          } catch (error) {
            console.error("[Webhook] Failed to send superadmin notification:", error);
            // Don't fail the webhook if notification fails
          }

          console.log(`[Webhook] ✅ Successfully processed checkout.session.completed for purchase ${purchaseId}`);
          return NextResponse.json({ 
            received: true, 
            message: "Purchase completed successfully",
            purchaseId 
          });
        } catch (transactionError) {
          console.error(`[Webhook] ❌ Transaction failed for purchase ${purchaseId}:`, transactionError);
          throw transactionError; // Re-throw to be caught by outer try-catch
        }
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const purchaseId = session.client_reference_id || session.metadata?.purchaseId;

        if (!purchaseId) {
          console.error("[Webhook] No purchase ID in failed payment session");
          break;
        }

        // Idempotency check: Get purchase details first
        const [existingPurchase] = await db
          .select()
          .from(purchases)
          .where(eq(purchases.id, purchaseId))
          .limit(1);

        if (!existingPurchase) {
          console.error(`[Webhook] Purchase ${purchaseId} not found for failed payment`);
          break;
        }

        // Idempotency: Only update if not already in final state
        if (existingPurchase.status === "failed" || existingPurchase.status === "refunded") {
          console.log(`[Webhook] Purchase ${purchaseId} already in ${existingPurchase.status} state, skipping duplicate event ${event.id}`);
          return NextResponse.json({ 
            received: true, 
            message: "Already processed",
            purchaseId 
          });
        }

        // Update purchase status to failed
        await db
          .update(purchases)
          .set({ 
            status: "failed",
            updatedAt: new Date(),
          })
          .where(eq(purchases.id, purchaseId));
        
        console.log(`[Webhook] Marked purchase ${purchaseId} as failed`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

