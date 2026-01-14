import { NextRequest, NextResponse } from "next/server";
import { db, sqlite } from "@/server/db";
import { guestPurchases } from "@/server/db/schema";
import { rateLimitMiddleware, RATE_LIMITS } from "@/server/utils/rate-limit";
import { apiErrors } from "@/server/utils/api-response";
import { env } from "@/env";
import crypto from "crypto";
import { initializeMigrations } from "@/server/db/migrations";
import { getStripePriceIdForFeature, type FeatureType } from "@/server/utils/stripe-price-ids";

// Fallback price if Stripe Price ID is not configured (in cents)
const UPLOAD_PRICE_FALLBACK = 9999; // $99.99 in cents

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
    if (!sqlite) {
      console.error("[Guest Checkout] ❌ SQLite connection not available");
      return NextResponse.json(
        { 
          error: "Database connection error",
          details: "SQLite connection is not available",
          hint: "Please check database configuration"
        },
        { status: 500 }
      );
    }

    // Check if table exists, create if not
    // NOTE: Drizzle adds getlostportal_ prefix, so the actual table name is getlostportal_guest_purchase
    const actualTableName = "getlostportal_guest_purchase";
    let tableExists = false;
    try {
      const tableCheck = sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${actualTableName}'`)
        .get();
      tableExists = !!tableCheck;
      console.log(`[Guest Checkout] Table check for ${actualTableName}: ${tableExists ? 'exists' : 'not found'}`);
    } catch (checkError: any) {
      console.error("[Guest Checkout] Error checking table:", checkError);
      return NextResponse.json(
        { 
          error: "Database query error",
          details: "Failed to check if table exists",
          errorMessage: checkError?.message
        },
        { status: 500 }
      );
    }
    
    if (!tableExists) {
      console.log(`[Guest Checkout] ⚠️ Table ${actualTableName} doesn't exist, creating it now...`);
      // Create table immediately as fallback
      try {
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS ${actualTableName} (
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
        sqlite.exec(`CREATE INDEX IF NOT EXISTS guest_purchase_email_idx ON ${actualTableName}(guestEmail)`);
        sqlite.exec(`CREATE INDEX IF NOT EXISTS guest_purchase_status_idx ON ${actualTableName}(status)`);
        sqlite.exec(`CREATE INDEX IF NOT EXISTS guest_purchase_feature_idx ON ${actualTableName}(featureType)`);
        console.log(`[Guest Checkout] ✅ Created ${actualTableName} table`);
        
        // Verify it was created
        const verifyCheck = sqlite
          .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${actualTableName}'`)
          .get();
        if (!verifyCheck) {
          throw new Error("Table creation appeared to succeed but table still not found");
        }
        console.log(`[Guest Checkout] ✅ Verified ${actualTableName} exists after creation`);
      } catch (createError: any) {
        console.error("[Guest Checkout] ❌ Failed to create table:", createError);
        console.error("[Guest Checkout] Create error details:", {
          message: createError?.message,
          stack: createError?.stack,
          code: createError?.code
        });
        return NextResponse.json(
          { 
            error: "Database setup error",
            details: `Failed to create ${actualTableName} table`,
            hint: "Please ensure migrations have run or contact support",
            errorMessage: createError?.message,
            errorCode: createError?.code
          },
          { status: 500 }
        );
      }
    } else {
      console.log(`[Guest Checkout] ✅ ${actualTableName} table exists`);
      
      // Debug: List all guest_purchase related tables
      if (sqlite) {
        try {
          const allTables = sqlite
            .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%guest%'`)
            .all();
          console.log(`[Guest Checkout] Debug: Found tables with 'guest' in name:`, allTables);
        } catch (debugError) {
          console.warn(`[Guest Checkout] Could not list tables for debugging:`, debugError);
        }
      }
    }

        const { email, featureType = "book-upload" } = await request.json();

        // Email is optional - Stripe will collect it
        // Use placeholder email if not provided, will be updated from Stripe webhook
        let normalizedEmail: string;
        if (email && typeof email === "string" && isValidEmail(email)) {
          normalizedEmail = email.toLowerCase().trim();
        } else {
          // Use placeholder - will be updated when we get email from Stripe checkout
          normalizedEmail = `pending-${crypto.randomUUID()}@stripe-pending.getlost.ink`;
        }

        // Only allow book-upload for guest purchases (for now)
        if (featureType !== "book-upload") {
          return NextResponse.json(
            { error: "Only book-upload is available for guest purchases" },
            { status: 400 }
          );
        }
    const baseURL = getBaseURL(request);

    // Check Stripe configuration
    const stripeSecretKey = env.STRIPE_SECRET_KEY;
    const useSimulatedPurchases = process.env.USE_SIMULATED_PURCHASES === "true";

    // Get Stripe Price ID for book-upload feature
    let stripePriceId: string | undefined;
    let price = UPLOAD_PRICE_FALLBACK;
    let currency = "usd";

    if (!useSimulatedPurchases && stripeSecretKey) {
      stripePriceId = getStripePriceIdForFeature("book-upload" as FeatureType);
      
      if (stripePriceId) {
        // Fetch price from Stripe to get the actual amount and currency
        const StripeLib = (await import("stripe")).default;
        const stripe = new StripeLib(stripeSecretKey, {
          apiVersion: "2025-11-17.clover",
        });
        
        try {
          const stripePrice = await stripe.prices.retrieve(stripePriceId);
          if (stripePrice.active === false) {
            console.error(`[Guest Checkout] ❌ Stripe price inactive: priceId=${stripePriceId}`);
            return NextResponse.json(
              { 
                error: "Stripe price inactive",
                details: `Stripe price ${stripePriceId} is inactive. Activate it in Stripe or update the env var to an active price.`,
              },
              { status: 400 }
            );
          }

          // Validate it's a one-time price (not recurring)
          if (stripePrice.recurring) {
            console.error(`[Guest Checkout] ❌ Stripe price type mismatch: book-upload requires one-time. priceId=${stripePriceId}`);
            return NextResponse.json(
              { 
                error: "Invalid price type",
                details: `Stripe price ${stripePriceId} is recurring, but book-upload requires a one-time price.`,
              },
              { status: 400 }
            );
          }

          if (stripePrice.unit_amount == null || !stripePrice.currency) {
            console.error(`[Guest Checkout] ❌ Stripe price missing unit_amount/currency: priceId=${stripePriceId}`);
            return NextResponse.json(
              { 
                error: "Invalid Stripe price",
                details: `Stripe price ${stripePriceId} missing unit_amount or currency`,
              },
              { status: 400 }
            );
          }

          price = stripePrice.unit_amount;
          currency = stripePrice.currency.toLowerCase();
          console.log(`[Guest Checkout] ✅ Using Stripe Price ID ${stripePriceId}: ${price} ${currency.toUpperCase()}`);
        } catch (stripeError: any) {
          console.error(`[Guest Checkout] ❌ Failed to retrieve Stripe price ${stripePriceId}:`, stripeError);
          return NextResponse.json(
            { 
              error: "Stripe price retrieval failed",
              details: `Failed to retrieve Stripe price ${stripePriceId}: ${stripeError?.message}`,
            },
            { status: 500 }
          );
        }
      } else {
        console.warn(`[Guest Checkout] ⚠️ No Stripe Price ID configured for book-upload, using fallback price ${UPLOAD_PRICE_FALLBACK}`);
      }
    }

    // Create purchase record first
    const purchaseId = crypto.randomUUID();

    if (useSimulatedPurchases || !stripeSecretKey) {
      // Simulated purchase for testing
      try {
        console.log(`[Guest Checkout] Attempting to insert simulated guest purchase:`, {
          id: purchaseId,
          guestEmail: normalizedEmail,
          featureType: "book-upload",
          amount: price,
          currency: currency.toUpperCase(),
          status: "completed",
        });

        await db.insert(guestPurchases).values({
          id: purchaseId,
          guestEmail: normalizedEmail,
          bookId: null,
          featureType: "book-upload",
          amount: price,
          currency: currency.toUpperCase(),
          paymentMethod: "simulated",
          status: "completed",
          completedAt: new Date(),
        });

        console.log(`[Guest Checkout] ✅ Created simulated guest purchase ${purchaseId} for ${normalizedEmail}`);
        
        // Verify the insert worked
        if (sqlite) {
          const verifyPurchase = sqlite
            .prepare(`SELECT id, guestEmail, status FROM getlostportal_guest_purchase WHERE id = ?`)
            .get(purchaseId);
          if (verifyPurchase) {
            console.log(`[Guest Checkout] ✅ Verified purchase exists in database:`, verifyPurchase);
          } else {
            console.error(`[Guest Checkout] ❌ Purchase ${purchaseId} was not found in database after insert!`);
          }
        }

        return NextResponse.json({
          message: "Purchase completed (simulated)",
          purchaseId,
          status: "completed",
          redirectUrl: `${baseURL}/signup?purchase_id=${purchaseId}&email=${encodeURIComponent(normalizedEmail)}`,
        });
      } catch (insertError: any) {
        console.error("[Guest Checkout] ❌ Failed to insert simulated purchase:", insertError);
        console.error("[Guest Checkout] Insert error details:", {
          message: insertError?.message,
          stack: insertError?.stack,
          code: insertError?.code,
        });
        
        // Check if it's a table not found error
        if (insertError?.message?.includes("no such table") || insertError?.message?.includes("guest_purchase")) {
          return NextResponse.json(
            { 
              error: "Database table not found",
              details: "The guest_purchase table does not exist and could not be created automatically.",
              hint: "Please ensure migrations have run. The table should be created automatically.",
              errorMessage: insertError?.message,
            },
            { status: 500 }
          );
        }
        
        throw insertError; // Re-throw to be caught by outer catch
      }
    }

    // Real Stripe checkout
    const StripeLib = (await import("stripe")).default;
    const stripe = new StripeLib(stripeSecretKey, {
      apiVersion: "2025-11-17.clover",
    });

    // Create guest purchase record with pending status
    try {
      console.log(`[Guest Checkout] Attempting to insert guest purchase:`, {
        id: purchaseId,
        guestEmail: normalizedEmail,
        featureType: "book-upload",
        amount: price,
        currency: currency.toUpperCase(),
        status: "pending",
      });

      await db.insert(guestPurchases).values({
        id: purchaseId,
        guestEmail: normalizedEmail,
        bookId: null,
        featureType: "book-upload",
        amount: price,
        currency: currency.toUpperCase(),
        paymentMethod: "stripe",
        status: "pending",
      });

      console.log(`[Guest Checkout] ✅ Created guest purchase ${purchaseId} for ${normalizedEmail}`);
      
      // Verify the insert worked
      if (sqlite) {
        const verifyPurchase = sqlite
          .prepare(`SELECT id, guestEmail, status FROM getlostportal_guest_purchase WHERE id = ?`)
          .get(purchaseId);
        if (verifyPurchase) {
          console.log(`[Guest Checkout] ✅ Verified purchase exists in database:`, verifyPurchase);
        } else {
          console.error(`[Guest Checkout] ❌ Purchase ${purchaseId} was not found in database after insert!`);
        }
      }
    } catch (insertError: any) {
      console.error("[Guest Checkout] ❌ Failed to insert guest purchase:", insertError);
      console.error("[Guest Checkout] Insert error details:", {
        message: insertError?.message,
        stack: insertError?.stack,
        code: insertError?.code,
      });
      
      // Check if it's a table not found error
      if (insertError?.message?.includes("no such table") || insertError?.message?.includes("guest_purchase")) {
        return NextResponse.json(
          { 
            error: "Database table not found",
            details: "The guest_purchase table does not exist and could not be created automatically.",
            hint: "Please ensure migrations have run. The table should be created automatically.",
            errorMessage: insertError?.message,
          },
          { status: 500 }
        );
      }
      
      throw insertError; // Re-throw to be caught by outer catch
    }

    // Create Stripe checkout session
    // Use Stripe Price ID if available, otherwise fall back to price_data
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      line_items: stripePriceId
        ? [{ price: stripePriceId, quantity: 1 }]
        : [
            {
              price_data: {
                currency: currency,
                product_data: {
                  name: "Book Upload Permission",
                  description: "Upload and analyze your manuscript",
                },
                unit_amount: price,
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
        ...(stripePriceId ? { stripePriceId } : {}),
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

