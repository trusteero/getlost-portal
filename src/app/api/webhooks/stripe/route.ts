import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { purchases, bookFeatures } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
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
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const purchaseId = session.client_reference_id || session.metadata?.purchaseId;

        if (!purchaseId) {
          console.error("[Webhook] No purchase ID in session");
          break;
        }

        // Idempotency check: Get purchase details first to check if already processed
        const [existingPurchase] = await db
          .select()
          .from(purchases)
          .where(eq(purchases.id, purchaseId))
          .limit(1);

        if (!existingPurchase) {
          console.error(`[Webhook] Purchase ${purchaseId} not found in database`);
          break;
        }

        // Idempotency: Skip if already completed
        if (existingPurchase.status === "completed") {
          console.log(`[Webhook] Purchase ${purchaseId} already completed, skipping duplicate event ${event.id}`);
          return NextResponse.json({ 
            received: true, 
            message: "Already processed",
            purchaseId 
          });
        }

        // Wrap all database operations in a transaction for data integrity
        await db.transaction(async (tx) => {
          // Update purchase status (only if not already completed)
          await tx
            .update(purchases)
            .set({
              status: "completed",
              paymentIntentId: session.payment_intent as string,
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(purchases.id, purchaseId));

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
              console.log(`[Webhook] Book upload permission purchased for user ${purchase.userId}`);
              return; // No bookFeatures needed for user-level purchases
            }

            // Create or update feature record for book-specific features
            if (!purchase.bookId) {
              console.warn(`[Webhook] Purchase ${purchaseId} has no bookId but is not book-upload`);
              return;
            }

            // Idempotency: Check if feature already exists and is purchased
            const existingFeature = await tx
              .select()
              .from(bookFeatures)
              .where(
                and(
                  eq(bookFeatures.bookId, purchase.bookId),
                  eq(bookFeatures.featureType, purchase.featureType)
                )
              )
              .limit(1);

            if (existingFeature.length > 0) {
              // Idempotency: Only update if not already purchased
              if (existingFeature[0]!.status === "purchased") {
                console.log(`[Webhook] Feature ${purchase.featureType} for book ${purchase.bookId} already purchased, skipping duplicate processing`);
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
                console.log(`[Webhook] Updated feature ${purchase.featureType} for book ${purchase.bookId} to purchased`);
              }
            } else {
              await tx.insert(bookFeatures).values({
                bookId: purchase.bookId,
                featureType: purchase.featureType,
                status: "purchased",
                unlockedAt: new Date(),
                purchasedAt: new Date(),
                price: purchase.amount,
              });
              console.log(`[Webhook] Created feature ${purchase.featureType} for book ${purchase.bookId}`);
            }
          }
        });

        break;
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

