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
      // Check both payment_status and status - either "paid" or "complete" indicates success
      const isPaymentComplete = 
        (checkoutSession.payment_status === "paid" || checkoutSession.status === "complete") &&
        checkoutSession.status !== "expired" &&
        checkoutSession.status !== "open"; // Not still open/expired
      
      console.log(`[Verify Session] Payment check: payment_status=${checkoutSession.payment_status}, status=${checkoutSession.status}, isPaymentComplete=${isPaymentComplete}`);
      
      if (isPaymentComplete) {
        // Update purchase status (idempotent - safe to call multiple times)
        db.transaction((tx) => {
          tx.update(purchases)
            .set({
              status: "completed",
              paymentIntentId: checkoutSession.payment_intent as string,
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(purchases.id, purchaseId));
        });

        // Get updated purchase
        const [updatedPurchase] = await db
          .select()
          .from(purchases)
          .where(eq(purchases.id, purchaseId))
          .limit(1);

        console.log(`[Verify Session] ✅ Updated purchase ${purchaseId} to completed status`);
        console.log(`[Verify Session] Updated purchase details:`, {
          id: updatedPurchase?.id,
          status: updatedPurchase?.status,
          completedAt: updatedPurchase?.completedAt,
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

