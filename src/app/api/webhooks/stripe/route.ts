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
    apiVersion: "2024-11-20.acacia", // Use stable API version
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
          console.error("No purchase ID in session");
          break;
        }

        // Update purchase status
        await db
          .update(purchases)
          .set({
            status: "completed",
            paymentIntentId: session.payment_intent as string,
            completedAt: new Date(),
          })
          .where(eq(purchases.id, purchaseId));

        // Get purchase details
        const [purchase] = await db
          .select()
          .from(purchases)
          .where(eq(purchases.id, purchaseId))
          .limit(1);

        if (purchase) {
          // Create or update feature record
          const existingFeature = await db
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
            await db
              .update(bookFeatures)
              .set({
                status: "purchased",
                unlockedAt: new Date(),
                purchasedAt: new Date(),
                price: purchase.amount,
                updatedAt: new Date(),
              })
              .where(eq(bookFeatures.id, existingFeature[0]!.id));
          } else {
            await db.insert(bookFeatures).values({
              bookId: purchase.bookId,
              featureType: purchase.featureType,
              status: "purchased",
              unlockedAt: new Date(),
              purchasedAt: new Date(),
              price: purchase.amount,
            });
          }
        }

        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const purchaseId = session.client_reference_id || session.metadata?.purchaseId;

        if (purchaseId) {
          await db
            .update(purchases)
            .set({ status: "failed" })
            .where(eq(purchases.id, purchaseId));
        }
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

