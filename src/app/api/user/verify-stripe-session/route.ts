import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { purchases } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/user/verify-stripe-session
 * Verify a Stripe checkout session and update purchase status if payment completed
 * This is a fallback in case the webhook hasn't processed yet
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId, purchaseId } = await request.json();

    if (!sessionId || !purchaseId) {
      return NextResponse.json(
        { error: "sessionId and purchaseId are required" },
        { status: 400 }
      );
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

    // If already completed, return success
    if (purchase.status === "completed") {
      return NextResponse.json({
        success: true,
        purchase,
        hasPermission: true,
        message: "Purchase already completed",
      });
    }

    // Check Stripe session status
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 503 }
      );
    }

    const StripeLib = (await import("stripe")).default;
    const stripe = new StripeLib(stripeSecretKey, {
      apiVersion: "2025-11-17.clover",
    });

    try {
      const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

      console.log(`[Verify Session] Session ${sessionId} status: ${checkoutSession.payment_status}, status: ${checkoutSession.status}`);

      // If payment is completed, update the purchase
      // Stripe checkout session is complete when:
      // - status is "complete" (session completed)
      // - payment_status is "paid" (payment succeeded)
      // - status is NOT "expired" or "open" (not still in progress)
      const isPaymentComplete = 
        checkoutSession.status === "complete" || 
        (checkoutSession.payment_status === "paid" && checkoutSession.status !== "expired" && checkoutSession.status !== "open");
      
      console.log(`[Verify Session] Payment check: payment_status=${checkoutSession.payment_status}, status=${checkoutSession.status}, isPaymentComplete=${isPaymentComplete}`);
      console.log(`[Verify Session] Full session data:`, {
        id: checkoutSession.id,
        status: checkoutSession.status,
        payment_status: checkoutSession.payment_status,
        payment_intent: checkoutSession.payment_intent,
        client_reference_id: checkoutSession.client_reference_id,
      });
      
      if (isPaymentComplete) {
        // Update purchase status (idempotent - safe to call multiple times)
        // Use direct update (better-sqlite3 doesn't need transaction for single operation)
        await db
          .update(purchases)
          .set({
            status: "completed",
            paymentIntentId: checkoutSession.payment_intent as string,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(purchases.id, purchaseId));

        // Get updated purchase to verify the update worked
        const [updatedPurchase] = await db
          .select()
          .from(purchases)
          .where(eq(purchases.id, purchaseId))
          .limit(1);

        if (!updatedPurchase) {
          console.error(`[Verify Session] ❌ Purchase ${purchaseId} not found after update!`);
          return NextResponse.json({
            success: false,
            error: "Purchase not found after update",
            purchaseId,
          }, { status: 500 });
        }

        if (updatedPurchase.status !== "completed") {
          console.error(`[Verify Session] ❌ Purchase ${purchaseId} status is still "${updatedPurchase.status}", not "completed"!`);
          return NextResponse.json({
            success: false,
            error: "Purchase status update failed",
            purchase: updatedPurchase,
            hasPermission: false,
          }, { status: 500 });
        }

        console.log(`[Verify Session] ✅ Updated purchase ${purchaseId} to completed status`);
        console.log(`[Verify Session] Updated purchase details:`, {
          id: updatedPurchase.id,
          status: updatedPurchase.status,
          completedAt: updatedPurchase.completedAt,
          paymentIntentId: updatedPurchase.paymentIntentId,
        });

        return NextResponse.json({
          success: true,
          purchase: updatedPurchase,
          hasPermission: true,
          message: "Purchase verified and updated",
        });
      } else {
        // Payment not completed yet
        console.log(`[Verify Session] ⚠️  Payment not complete: payment_status=${checkoutSession.payment_status}, status=${checkoutSession.status}`);
        return NextResponse.json({
          success: false,
          purchase,
          hasPermission: false,
          message: `Payment status: ${checkoutSession.payment_status}, session status: ${checkoutSession.status}`,
        });
      }
    } catch (stripeError: any) {
      console.error(`[Verify Session] Failed to retrieve Stripe session:`, stripeError);
      return NextResponse.json(
        {
          error: "Failed to verify Stripe session",
          details: stripeError?.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Failed to verify Stripe session:", error);
    return NextResponse.json(
      { error: "Failed to verify Stripe session" },
      { status: 500 }
    );
  }
}

