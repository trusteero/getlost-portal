import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, purchases, bookFeatures } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

const FEATURE_PRICES: Record<string, number> = {
  "summary": 0,
  "manuscript-report": 14999, // $149.99
  "marketing-assets": 14999,
  "book-covers": 14999,
  "landing-page": 14999,
};

function getFeatureName(featureType: string): string {
  const names: Record<string, string> = {
    "summary": "Summary",
    "manuscript-report": "Manuscript Report",
    "marketing-assets": "Marketing Assets",
    "book-covers": "Book Covers",
    "landing-page": "Landing Page",
  };
  return names[featureType] || featureType;
}

// Get base URL for redirects - prefer env vars over request origin
function getBaseURL(request: NextRequest): string {
  // Check for custom domain first (production)
  const customDomain = process.env.CUSTOM_DOMAIN || process.env.NEXT_PUBLIC_CUSTOM_DOMAIN;
  if (customDomain) {
    return customDomain.startsWith("http") ? customDomain : `https://${customDomain}`;
  }
  
  // Check for explicit app URL (from environment)
  const appUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    return appUrl;
  }
  
  // Fallback to request origin (for local development)
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { bookId, featureType } = await request.json();

    // Verify book ownership
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    if (!book || book.userId !== session.user.id) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const price = FEATURE_PRICES[featureType] ?? 0;

    // Free features don't need payment
    if (price === 0) {
      return NextResponse.json({ 
        error: "This feature is free. Use the direct unlock endpoint." 
      }, { status: 400 });
    }

    // Check if we should force simulated purchases (for testing)
    const useSimulatedPurchases = process.env.USE_SIMULATED_PURCHASES === "true";

    // Check if Stripe is configured
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (useSimulatedPurchases || !stripeSecretKey || !stripePublishableKey) {
      // Simulated purchases forced or Stripe not configured, return error to use simulated purchase
      return NextResponse.json({ 
        error: useSimulatedPurchases 
          ? "Simulated purchases enabled. Use simulated purchase." 
          : "Stripe not configured. Use simulated purchase.",
        useSimulated: true
      }, { status: 503 }); // Service Unavailable
    }

    // Initialize Stripe
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-11-17.clover", // Use API version expected by Stripe package types
    });

    // Create purchase record with pending status
    const purchaseId = crypto.randomUUID();
    await db.insert(purchases).values({
      id: purchaseId,
      userId: session.user.id,
      bookId,
      featureType,
      amount: price,
      currency: "USD",
      paymentMethod: "stripe",
      status: "pending",
    });

    // Create or update feature record immediately with "purchased" status
    // This ensures the UI shows "Processing..." immediately, even before webhook processes
    const existingFeature = await db
      .select()
      .from(bookFeatures)
      .where(
        and(
          eq(bookFeatures.bookId, bookId),
          eq(bookFeatures.featureType, featureType)
        )
      )
      .limit(1);

    if (existingFeature.length > 0) {
      await db
        .update(bookFeatures)
        .set({
          status: "purchased",
          purchasedAt: new Date(),
          price,
          updatedAt: new Date(),
        })
        .where(eq(bookFeatures.id, existingFeature[0]!.id));
    } else {
      await db.insert(bookFeatures).values({
        id: crypto.randomUUID(),
        bookId,
        featureType,
        status: "purchased",
        purchasedAt: new Date(),
        price,
      });
    }

    // Get base URL for redirects
    const baseURL = getBaseURL(request);
    
    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: getFeatureName(featureType),
              description: `Purchase ${getFeatureName(featureType)} for "${book.title}"`,
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseURL}/dashboard?session_id={CHECKOUT_SESSION_ID}&purchase_id=${purchaseId}`,
      cancel_url: `${baseURL}/dashboard/book/${bookId}`,
      client_reference_id: purchaseId,
      metadata: {
        userId: session.user.id,
        bookId,
        featureType,
        purchaseId,
      },
    });

    return NextResponse.json({ 
      sessionId: checkoutSession.id,
      url: checkoutSession.url 
    });
  } catch (error: any) {
    console.error("Failed to create checkout session:", error);
    
    // Provide more detailed error information
    const errorMessage = error?.message || "Failed to create checkout session";
    const errorCode = error?.code || "CHECKOUT_ERROR";
    
    // If it's a Stripe-specific error, include more details
    if (error?.type) {
      console.error("Stripe error type:", error.type);
      console.error("Stripe error code:", error.code);
      console.error("Stripe error message:", error.message);
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        code: errorCode,
        details: process.env.NODE_ENV === "development" ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

