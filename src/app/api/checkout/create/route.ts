import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, purchases, bookFeatures } from "@/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { rateLimitMiddleware, RATE_LIMITS } from "@/server/utils/rate-limit";

const FEATURE_PRICES: Record<string, number> = {
  "summary": 0,
  "manuscript-report": 14999, // $149.99
  "marketing-assets": 14999,
  "book-covers": 14999,
  "landing-page": 14999,
  "book-upload": 9999, // $99.99 - user-level purchase
};

function getFeatureName(featureType: string): string {
  const names: Record<string, string> = {
    "summary": "Summary",
    "manuscript-report": "Manuscript Report",
    "marketing-assets": "Marketing Assets",
    "book-covers": "Book Covers",
    "landing-page": "Landing Page",
    "book-upload": "Book Upload Permission",
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

  // Rate limiting for checkout/purchase endpoint
  const rateLimitResponse = rateLimitMiddleware(
    request,
    "checkout:create",
    RATE_LIMITS.PURCHASE,
    session.user.id
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { bookId, featureType } = await request.json();

    // Ensure database migrations are up to date (especially for nullable bookId)
    if (featureType === "book-upload") {
      try {
        const { initializeMigrations } = await import("@/server/db/migrations");
        initializeMigrations();
      } catch (migrateError) {
        console.warn("[Checkout] Migration check failed, continuing anyway:", migrateError);
      }
    }

    // For user-level purchases (book-upload), bookId is not required
    let book = null;
    if (featureType !== "book-upload" && bookId) {
      // Verify book ownership for book-specific features
      const [bookResult] = await db
        .select()
        .from(books)
        .where(eq(books.id, bookId))
        .limit(1);

      if (!bookResult || bookResult.userId !== session.user.id) {
        return NextResponse.json({ error: "Book not found" }, { status: 404 });
      }
      book = bookResult;
    }

    const price = FEATURE_PRICES[featureType] ?? 0;

    // Free features don't need payment
    if (price === 0) {
      return NextResponse.json({ 
        error: "This feature is free. Use the direct unlock endpoint." 
      }, { status: 400 });
    }

    // Concurrent purchase prevention: Check for existing pending purchase
    // This prevents duplicate charges if user clicks multiple times
    const existingPendingPurchase = featureType === "book-upload"
      ? // For user-level purchases, bookId must be null
        await db
          .select()
          .from(purchases)
          .where(
            and(
              eq(purchases.userId, session.user.id),
              eq(purchases.featureType, featureType),
              eq(purchases.status, "pending"),
              isNull(purchases.bookId)
            )
          )
          .limit(1)
      : bookId
        ? // For book-specific features, match the bookId
          await db
            .select()
            .from(purchases)
            .where(
              and(
                eq(purchases.userId, session.user.id),
                eq(purchases.featureType, featureType),
                eq(purchases.status, "pending"),
                eq(purchases.bookId, bookId)
              )
            )
            .limit(1)
        : // No bookId provided for book-specific feature - shouldn't happen, but handle gracefully
          [];

    if (existingPendingPurchase.length > 0) {
      const pending = existingPendingPurchase[0]!;
      console.log(`[Checkout] ⚠️  Found existing pending purchase ${pending.id} for user ${session.user.id}, feature ${featureType}, bookId ${bookId || "null"}`);
      console.log(`[Checkout] Purchase details: status=${pending.status}, paymentIntentId=${pending.paymentIntentId || "null"}`);
      
      // If we have a Stripe session ID stored in paymentIntentId (temporarily stored there),
      // retrieve the checkout URL from Stripe
      if (process.env.STRIPE_SECRET_KEY && pending.paymentIntentId) {
        console.log(`[Checkout] Attempting to retrieve Stripe session ${pending.paymentIntentId}`);
        try {
          const Stripe = (await import("stripe")).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: "2025-11-17.clover",
          });
          
          // Retrieve the session using the stored session ID
          const sessionId = pending.paymentIntentId;
          const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
          
          if (checkoutSession) {
            // Check if session is still valid (not expired and not completed)
            if (checkoutSession.status === "open" && checkoutSession.url) {
              console.log(`[Checkout] ✅ Retrieved existing valid Stripe session ${sessionId} for purchase ${pending.id}`);
              return NextResponse.json({
                message: "Purchase already in progress",
                purchaseId: pending.id,
                existingPurchase: true,
                sessionId: checkoutSession.id,
                url: checkoutSession.url, // Return the checkout URL
              });
            } else {
              // Session is expired or completed, delete the old purchase and create a new one
              console.log(`[Checkout] ⚠️  Stripe session ${sessionId} is ${checkoutSession.status}, deleting old purchase and creating new one`);
              await db
                .delete(purchases)
                .where(eq(purchases.id, pending.id));
              // Fall through to create a new purchase and checkout session
            }
          }
        } catch (stripeError) {
          console.warn(`[Checkout] Failed to retrieve Stripe session for purchase ${pending.id}:`, stripeError);
          // Fall through to try searching by metadata
        }
      }
      
      // Fallback: Search for the session using the purchase ID in metadata
      if (process.env.STRIPE_SECRET_KEY) {
        try {
          const Stripe = (await import("stripe")).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: "2025-11-17.clover",
          });
          
          // Search for the session using the purchase ID in metadata
          const sessions = await stripe.checkout.sessions.list({
            limit: 100,
          });
          
          const matchingSession = sessions.data.find(
            (s) => s.client_reference_id === pending.id || s.metadata?.purchaseId === pending.id
          );
          
          if (matchingSession) {
            // Check if session is still valid (not expired and not completed)
            if (matchingSession.status === "open" && matchingSession.url) {
              console.log(`[Checkout] ✅ Found existing valid Stripe session ${matchingSession.id} for purchase ${pending.id} (via metadata search)`);
              // Update the purchase record with the session ID for future use
              await db
                .update(purchases)
                .set({
                  paymentIntentId: matchingSession.id, // Store session ID temporarily
                  updatedAt: new Date(),
                })
                .where(eq(purchases.id, pending.id));
              
              return NextResponse.json({
                message: "Purchase already in progress",
                purchaseId: pending.id,
                existingPurchase: true,
                sessionId: matchingSession.id,
                url: matchingSession.url, // Return the checkout URL
              });
            } else {
              // Session is expired or completed, delete the old purchase and create a new one
              console.log(`[Checkout] ⚠️  Stripe session ${matchingSession.id} is ${matchingSession.status}, deleting old purchase and creating new one`);
              await db
                .delete(purchases)
                .where(eq(purchases.id, pending.id));
              // Fall through to create a new purchase and checkout session
            }
          } else {
            // No matching session found, delete the old purchase
            console.log(`[Checkout] ⚠️  No matching Stripe session found for purchase ${pending.id}, deleting old purchase`);
            await db
              .delete(purchases)
              .where(eq(purchases.id, pending.id));
            // Fall through to create a new purchase and checkout session
          }
        } catch (stripeError) {
          console.warn(`[Checkout] Failed to search Stripe sessions for purchase ${pending.id}:`, stripeError);
          // If search fails, delete the old purchase and create a new one
          console.log(`[Checkout] ⚠️  Stripe session search failed, deleting old purchase ${pending.id} and creating new one`);
          await db
            .delete(purchases)
            .where(eq(purchases.id, pending.id));
          // Fall through to create a new purchase and checkout session
        }
      } else {
        // No Stripe secret key or no paymentIntentId, delete the old purchase
        console.log(`[Checkout] ⚠️  No Stripe session ID stored for purchase ${pending.id} (STRIPE_SECRET_KEY=${!!process.env.STRIPE_SECRET_KEY}, paymentIntentId=${!!pending.paymentIntentId}), deleting old purchase`);
        try {
          await db
            .delete(purchases)
            .where(eq(purchases.id, pending.id));
          console.log(`[Checkout] ✅ Deleted old purchase ${pending.id}`);
        } catch (deleteError) {
          console.error(`[Checkout] ❌ Failed to delete old purchase ${pending.id}:`, deleteError);
          // Continue anyway - try to create new purchase
        }
        // Fall through to create a new purchase and checkout session
      }
      
      // If we reach here, we've deleted the old purchase and will create a new one
      // Fall through to create a new purchase and checkout session
      console.log(`[Checkout] 🔄 Proceeding to create new purchase after cleaning up old one`);
    }

    console.log(`[Checkout] Creating new checkout session for user ${session.user.id}, feature ${featureType}, bookId ${bookId || "null"}`);

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

    // Wrap purchase and feature creation in a transaction for data integrity
    const purchaseId = crypto.randomUUID();
    
    await db.transaction(async (tx) => {
      // Create purchase record with pending status
      const purchaseValues: any = {
        id: purchaseId,
        userId: session.user.id,
        featureType,
        amount: price,
        currency: "USD",
        paymentMethod: "stripe",
        status: "pending",
      };
      
      // Only include bookId if it's not a user-level purchase
      if (featureType !== "book-upload" && bookId) {
        purchaseValues.bookId = bookId;
      }
      // For book-upload, we don't include bookId at all (it will be null/undefined)
      
      await tx.insert(purchases).values(purchaseValues);

      // For book-specific features, create or update feature record
      // User-level features (book-upload) don't need bookFeatures records
      if (featureType !== "book-upload" && bookId) {
        const existingFeature = await tx
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
          await tx
            .update(bookFeatures)
            .set({
              status: "purchased",
              purchasedAt: new Date(),
              price,
              updatedAt: new Date(),
            })
            .where(eq(bookFeatures.id, existingFeature[0]!.id));
        } else {
          await tx.insert(bookFeatures).values({
            id: crypto.randomUUID(),
            bookId,
            featureType,
            status: "purchased",
            purchasedAt: new Date(),
            price,
          });
        }
      }
    });

    // Get base URL for redirects
    const baseURL = getBaseURL(request);
    
    // Create Stripe Checkout Session
    const productName = getFeatureName(featureType);
    const productDescription = featureType === "book-upload"
      ? `Purchase ${productName} to upload and analyze manuscripts`
      : `Purchase ${productName} for "${book?.title || "your book"}"`;

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseURL}/dashboard?session_id={CHECKOUT_SESSION_ID}&purchase_id=${purchaseId}&feature_type=${featureType}`,
      cancel_url: featureType === "book-upload" 
        ? `${baseURL}/dashboard` 
        : `${baseURL}/dashboard/book/${bookId}`,
      client_reference_id: purchaseId,
      metadata: {
        userId: session.user.id,
        bookId: bookId || "",
        featureType,
        purchaseId,
      },
    });

    // Store the Stripe session ID in the purchase record for future retrieval
    // We'll use paymentIntentId field temporarily to store the session ID
    // (it will be overwritten with the actual payment intent when payment completes)
    if (checkoutSession.id) {
      await db
        .update(purchases)
        .set({
          paymentIntentId: checkoutSession.id, // Temporarily store session ID here
          updatedAt: new Date(),
        })
        .where(eq(purchases.id, purchaseId));
    }

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

