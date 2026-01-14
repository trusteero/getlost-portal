import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { guestPurchases } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/env";

/**
 * POST /api/checkout/verify-guest-session
 * Verify a Stripe checkout session for a guest purchase and update status if payment completed
 * This is a fallback in case the webhook hasn't processed yet
 * No authentication required - uses purchaseId and sessionId to verify
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId, purchaseId } = await request.json();

    if (!sessionId || !purchaseId) {
      return NextResponse.json(
        { error: "sessionId and purchaseId are required" },
        { status: 400 }
      );
    }

    // Get the guest purchase
    const [guestPurchase] = await db
      .select()
      .from(guestPurchases)
      .where(eq(guestPurchases.id, purchaseId))
      .limit(1);

    if (!guestPurchase) {
      console.error(`[Verify Guest Session] ❌ Guest purchase ${purchaseId} not found in database`);
      return NextResponse.json({ 
        error: "Guest purchase not found",
        purchaseId,
      }, { status: 404 });
    }

    console.log(`[Verify Guest Session] Found guest purchase ${purchaseId}:`, {
      id: guestPurchase.id,
      status: guestPurchase.status,
      guestEmail: guestPurchase.guestEmail,
      featureType: guestPurchase.featureType,
      createdAt: guestPurchase.createdAt,
    });

    // If already completed, return success
    if (guestPurchase.status === "completed") {
      return NextResponse.json({
        success: true,
        purchase: guestPurchase,
        message: "Purchase already completed",
      });
    }

    // Check Stripe session status
    const stripeSecretKey = env.STRIPE_SECRET_KEY;
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

      console.log(`[Verify Guest Session] Session ${sessionId} status: ${checkoutSession.payment_status}, status: ${checkoutSession.status}`);

      // Verify this session belongs to this purchase
      const sessionPurchaseId = checkoutSession.client_reference_id || checkoutSession.metadata?.purchaseId;
      if (sessionPurchaseId !== purchaseId) {
        console.error(`[Verify Guest Session] ❌ Session purchase ID mismatch: session has ${sessionPurchaseId}, expected ${purchaseId}`);
        return NextResponse.json({
          success: false,
          error: "Session does not match purchase",
          sessionPurchaseId,
          purchaseId,
        }, { status: 400 });
      }

      // Verify it's a guest purchase
      const isGuestPurchase = checkoutSession.metadata?.isGuestPurchase === "true";
      if (!isGuestPurchase) {
        console.error(`[Verify Guest Session] ❌ Session is not marked as guest purchase`);
        return NextResponse.json({
          success: false,
          error: "Session is not a guest purchase",
        }, { status: 400 });
      }

      // Check if payment is completed
      const status = checkoutSession.status as string | null;
      const isPaymentComplete = 
        checkoutSession.payment_status === "paid" && 
        status !== "expired" && 
        status !== "open";
      
      console.log(`[Verify Guest Session] Payment check: payment_status=${checkoutSession.payment_status}, status=${checkoutSession.status}, isPaymentComplete=${isPaymentComplete}`);
      
      if (isPaymentComplete) {
        // Update guest purchase status (idempotent - safe to call multiple times)
        await db
          .update(guestPurchases)
          .set({
            status: "completed",
            paymentIntentId: (checkoutSession.payment_intent as string) || checkoutSession.id,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(guestPurchases.id, purchaseId));

        // Get updated purchase to verify the update worked
        const [updatedPurchase] = await db
          .select()
          .from(guestPurchases)
          .where(eq(guestPurchases.id, purchaseId))
          .limit(1);

        if (!updatedPurchase) {
          console.error(`[Verify Guest Session] ❌ Guest purchase ${purchaseId} not found after update!`);
          return NextResponse.json({
            success: false,
            error: "Purchase not found after update",
            purchaseId,
          }, { status: 500 });
        }

        if (updatedPurchase.status !== "completed") {
          console.error(`[Verify Guest Session] ❌ Guest purchase ${purchaseId} status is still "${updatedPurchase.status}", not "completed"!`);
          return NextResponse.json({
            success: false,
            error: "Purchase status update failed",
            purchase: updatedPurchase,
          }, { status: 500 });
        }

        console.log(`[Verify Guest Session] ✅ Updated guest purchase ${purchaseId} to completed status`);
        console.log(`[Verify Guest Session] Updated purchase details:`, {
          id: updatedPurchase.id,
          status: updatedPurchase.status,
          completedAt: updatedPurchase.completedAt,
          paymentIntentId: updatedPurchase.paymentIntentId,
        });

        return NextResponse.json({
          success: true,
          purchase: updatedPurchase,
          message: "Purchase verified and completed",
        });
      } else {
        // Payment not complete yet
        console.log(`[Verify Guest Session] Payment not complete yet: payment_status=${checkoutSession.payment_status}, status=${checkoutSession.status}`);
        return NextResponse.json({
          success: false,
          purchase: guestPurchase,
          message: "Payment not completed yet",
          paymentStatus: checkoutSession.payment_status,
          sessionStatus: checkoutSession.status,
        });
      }
    } catch (stripeError: any) {
      console.error(`[Verify Guest Session] ❌ Stripe API error:`, stripeError);
      return NextResponse.json({
        success: false,
        error: "Failed to verify Stripe session",
        details: stripeError?.message,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[Verify Guest Session] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to verify guest session",
        details: error?.message 
      },
      { status: 500 }
    );
  }
}

