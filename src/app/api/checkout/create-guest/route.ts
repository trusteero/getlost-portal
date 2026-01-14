import { NextRequest, NextResponse } from "next/server";
import { db, sqlite } from "@/server/db";
import { guestPurchases } from "@/server/db/schema";
import { rateLimitMiddleware, RATE_LIMITS } from "@/server/utils/rate-limit";
import { apiErrors } from "@/server/utils/api-response";
import { env } from "@/env";
import crypto from "crypto";
import { initializeMigrations } from "@/server/db/migrations";

const UPLOAD_PRICE = 9999; // $99.99 in cents

// Get base URL for redirects
function getBaseURL(request: NextRequest): string {
  const customDomain = process.env.CUSTOM_DOMAIN || process.env.NEXT_PUBLIC_CUSTOM_DOMAIN;
  if (customDomain) {
    return customDomain.startsWith("http") ? customDomain : `https://${customDomain}`;
  }
  
  const appUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    return appUrl;
  }
  
  return request.nextUrl.origin;
}

// Simple email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * POST /api/checkout/create-guest
 * Create Stripe checkout session for guest purchase (no authentication required)
 */
export async function POST(request: NextRequest) {
  // Rate limiting by IP (not user, since no auth)
  const rateLimitResponse = rateLimitMiddleware(
    request,
    "checkout:create-guest",
    RATE_LIMITS.PURCHASE
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Ensure migrations have run and table exists
    try {
      initializeMigrations();
    } catch (migrateError) {
      console.warn("[Guest Checkout] Migration check failed, continuing anyway:", migrateError);
    }

    // Double-check table exists before proceeding
    if (sqlite) {
      const tableCheck = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='guest_purchase'")
        .get();
      
      if (!tableCheck) {
        console.log("[Guest Checkout] ⚠️ Table doesn't exist, creating it now...");
        // Create table immediately as fallback
        try {
          sqlite.exec(`
            CREATE TABLE IF NOT EXISTS guest_purchase (
              id text(255) PRIMARY KEY NOT NULL,
              guestEmail text(255) NOT NULL,
              bookId text(255),
              featureType text(50) NOT NULL,
              amount integer NOT NULL,
              currency text(10) NOT NULL DEFAULT 'USD',
              paymentMethod text(50),
              paymentIntentId text(255),
              status text(50) NOT NULL DEFAULT 'pending',
              completedAt integer,
              createdAt integer NOT NULL DEFAULT (unixepoch()),
              updatedAt integer NOT NULL DEFAULT (unixepoch()),
              FOREIGN KEY (bookId) REFERENCES getlostportal_book(id) ON UPDATE no action ON DELETE no action
            )
          `);
          sqlite.exec(`CREATE INDEX IF NOT EXISTS guest_purchase_email_idx ON guest_purchase(guestEmail)`);
          sqlite.exec(`CREATE INDEX IF NOT EXISTS guest_purchase_status_idx ON guest_purchase(status)`);
          sqlite.exec(`CREATE INDEX IF NOT EXISTS guest_purchase_feature_idx ON guest_purchase(featureType)`);
          console.log("[Guest Checkout] ✅ Created guest_purchase table");
        } catch (createError: any) {
          console.error("[Guest Checkout] ❌ Failed to create table:", createError);
          return NextResponse.json(
            { 
              error: "Database setup error",
              details: "Failed to create guest_purchase table",
              hint: "Please ensure migrations have run or contact support",
              errorMessage: createError?.message
            },
            { status: 500 }
          );
        }
      } else {
        console.log("[Guest Checkout] ✅ guest_purchase table exists");
      }
    }

    const { email, featureType = "book-upload" } = await request.json();

    // Validate email
    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      );
    }

    // Only allow book-upload for guest purchases (for now)
    if (featureType !== "book-upload") {
      return NextResponse.json(
        { error: "Only book-upload is available for guest purchases" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const baseURL = getBaseURL(request);

    // Check Stripe configuration
    const stripeSecretKey = env.STRIPE_SECRET_KEY;
    const useSimulatedPurchases = process.env.USE_SIMULATED_PURCHASES === "true";

    // Create purchase record first
    const purchaseId = crypto.randomUUID();

    if (useSimulatedPurchases || !stripeSecretKey) {
      // Simulated purchase for testing
      await db.insert(guestPurchases).values({
        id: purchaseId,
        guestEmail: normalizedEmail,
        bookId: null,
        featureType: "book-upload",
        amount: UPLOAD_PRICE,
        currency: "USD",
        paymentMethod: "simulated",
        status: "completed",
        completedAt: new Date(),
      });

      console.log(`[Guest Checkout] ✅ Created simulated guest purchase ${purchaseId} for ${normalizedEmail}`);

      return NextResponse.json({
        message: "Purchase completed (simulated)",
        purchaseId,
        status: "completed",
        redirectUrl: `${baseURL}/signup?purchase_id=${purchaseId}&email=${encodeURIComponent(normalizedEmail)}`,
      });
    }

    // Real Stripe checkout
    const StripeLib = (await import("stripe")).default;
    const stripe = new StripeLib(stripeSecretKey, {
      apiVersion: "2025-11-17.clover",
    });

    // Create guest purchase record with pending status
    await db.insert(guestPurchases).values({
      id: purchaseId,
      guestEmail: normalizedEmail,
      bookId: null,
      featureType: "book-upload",
      amount: UPLOAD_PRICE,
      currency: "USD",
      paymentMethod: "stripe",
      status: "pending",
    });

    console.log(`[Guest Checkout] ✅ Created guest purchase ${purchaseId} for ${normalizedEmail}`);

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Book Upload Permission",
              description: "Upload and analyze your manuscript",
            },
            unit_amount: UPLOAD_PRICE,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseURL}/signup?purchase_id=${purchaseId}&email=${encodeURIComponent(normalizedEmail)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseURL}/purchase-upload`,
      client_reference_id: purchaseId,
      customer_email: normalizedEmail, // Pre-fill email in Stripe checkout
      metadata: {
        purchaseId,
        guestEmail: normalizedEmail,
        isGuestPurchase: "true", // Flag for webhook
        featureType: "book-upload",
      },
    });

    console.log(`[Guest Checkout] ✅ Created Stripe checkout session ${checkoutSession.id} for purchase ${purchaseId}`);

    if (!checkoutSession.url) {
      return apiErrors.internal("Failed to create checkout session");
    }

    return NextResponse.json({
      url: checkoutSession.url,
      purchaseId,
    });
  } catch (error: any) {
    console.error("[Guest Checkout] Error:", error);
    console.error("[Guest Checkout] Error details:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
    });
    
    // Check if it's a table not found error
    if (error?.message?.includes("no such table") || error?.message?.includes("guest_purchase")) {
      return NextResponse.json(
        { 
          error: "Database table not found",
          details: "The guest_purchase table needs to be created.",
          hint: "The table should be created automatically via migrations. If this persists, the migration may not have run yet.",
          errorMessage: error?.message,
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      {
        error: "Failed to create checkout session",
        details: error?.message || "Unknown error",
        errorType: error?.name || "Error",
      },
      { status: 500 }
    );
  }
}

