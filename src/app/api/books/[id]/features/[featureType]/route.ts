import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookFeatures, purchases, bookVersions, reports } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { populateDemoDataForBook } from "@/server/utils/populate-demo-data";
import { importPrecannedContentForBook } from "@/server/utils/precanned-content";

const FEATURE_PRICES: Record<string, number> = {
  "summary": 0, // Free
  "manuscript-report": 14999, // $149.99 in cents
  "marketing-assets": 14999, // $149.99 in cents
  "book-covers": 14999, // $149.99 in cents
  "landing-page": 14999, // $149.99 in cents
};

/**
 * GET /api/books/[id]/features/[featureType]
 * Get feature status for a book
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; featureType: string }> }
) {
  const session = await getSessionFromRequest(request);
  const { id, featureType } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify book ownership
    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (book.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (book[0]!.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get feature status
    const feature = await db
      .select()
      .from(bookFeatures)
      .where(
        and(
          eq(bookFeatures.bookId, id),
          eq(bookFeatures.featureType, featureType)
        )
      )
      .limit(1);

    if (feature.length === 0) {
      // Feature doesn't exist yet, return default locked status
      return NextResponse.json({
        status: "locked",
        featureType,
        bookId: id,
      });
    }

    return NextResponse.json(feature[0]);
  } catch (error) {
    console.error("Failed to get feature status:", error);
    return NextResponse.json(
      { error: "Failed to get feature status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/books/[id]/features/[featureType]
 * Purchase/unlock a feature for a book
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; featureType: string }> }
) {
  const session = await getSessionFromRequest(request);
  const { id, featureType } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify book ownership
    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (book.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (book[0]!.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if feature is already unlocked
    const existingFeature = await db
      .select()
      .from(bookFeatures)
      .where(
        and(
          eq(bookFeatures.bookId, id),
          eq(bookFeatures.featureType, featureType)
        )
      )
      .limit(1);

    if (existingFeature.length > 0 && existingFeature[0]!.status !== "locked") {
      return NextResponse.json({
        message: "Feature already unlocked",
        feature: existingFeature[0],
      });
    }

    const price = FEATURE_PRICES[featureType] ?? 0;

    // Check if we should force simulated purchases (for testing)
    const useSimulatedPurchases = process.env.USE_SIMULATED_PURCHASES === "true";

    // Check if Stripe is configured
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    const useStripe = !!(stripeSecretKey && stripePublishableKey) && !useSimulatedPurchases;

    // For paid features, check if we should use Stripe or simulated purchase
    if (price > 0 && useStripe) {
      // Stripe is configured, redirect to checkout
      return NextResponse.json(
        { 
          error: "Payment required",
          redirectToCheckout: true,
          price,
          message: "Please use the checkout endpoint to complete payment"
        },
        { status: 402 } // Payment Required
      );
    }

    // Simulated purchase (Stripe not configured or free feature)
    // Create purchase record
    const purchaseId = crypto.randomUUID();
    await db.insert(purchases).values({
      id: purchaseId,
      userId: session.user.id,
      bookId: id,
      featureType,
      amount: price,
      currency: "USD",
      paymentMethod: useSimulatedPurchases ? "simulated" : (useStripe ? "stripe" : "simulated"),
      status: "completed", // Auto-complete for simulated purchases
      completedAt: new Date(),
    });

    // Create or update feature record
    const featureId = existingFeature.length > 0 
      ? existingFeature[0]!.id 
      : crypto.randomUUID();

    if (existingFeature.length > 0) {
      await db
        .update(bookFeatures)
        .set({
          status: "purchased", // Changed from "unlocked" to "purchased" to indicate asset is requested
          unlockedAt: new Date(),
          purchasedAt: new Date(),
          price,
          updatedAt: new Date(),
        })
        .where(eq(bookFeatures.id, featureId));
    } else {
      await db.insert(bookFeatures).values({
        id: featureId,
        bookId: id,
        featureType,
        status: "purchased", // Changed from "unlocked" to "purchased" to indicate asset is requested
        unlockedAt: new Date(),
        purchasedAt: new Date(),
        price,
      });
    }

    // Fetch updated feature
    const updatedFeature = await db
      .select()
      .from(bookFeatures)
      .where(eq(bookFeatures.id, featureId))
      .limit(1);

    // Don't import precanned content automatically when user purchases a feature
    // This ensures the asset stays in "requested" (processing) state until admin uploads
    // Precanned content should only be imported when the book is first uploaded (for demo purposes)
    // if (featureType === "manuscript-report") {
    //   try {
    //     const [latestVersion] = await db
    //       .select()
    //       .from(bookVersions)
    //       .where(eq(bookVersions.bookId, id))
    //       .orderBy(desc(bookVersions.uploadedAt))
    //       .limit(1);
    //
    //     if (latestVersion) {
    //       const existingReports = await db
    //         .select()
    //         .from(reports)
    //         .where(eq(reports.bookVersionId, latestVersion.id))
    //         .limit(1);
    //
    //       if (existingReports.length === 0) {
    //         const importResult = await importPrecannedContentForBook({
    //           bookId: id,
    //           bookVersionId: latestVersion.id,
    //           fileName: latestVersion.fileName,
    //           features: { reports: true, marketing: false, covers: false, landingPage: false },
    //         });
    //
    //         if (importResult) {
    //           console.log(
    //             `[Purchase] Imported precanned report package "${importResult.packageKey}" for book ${id}`
    //           );
    //         } else {
    //           console.log(`[Purchase] No precanned report matched "${latestVersion.fileName}"`);
    //         }
    //       } else {
    //         console.log(`[Purchase] Report already exists for book ${id}, skipping precanned import`);
    //       }
    //     }
    //   } catch (error) {
    //     console.error(`[Purchase] Failed to import precanned report:`, error);
    //   }
    // }

    // Don't populate demo data automatically - wait for admin to upload assets
    // This ensures the asset stays in "requested" (processing) state until admin uploads
    // try {
    //   await populateDemoDataForBook(id, featureType);
    //   console.log(`[Purchase] Populated demo data for ${featureType} on book ${id}`);
    // } catch (error) {
    //   console.error(`[Purchase] Failed to populate demo data:`, error);
    //   // Don't fail the purchase if demo data population fails
    // }

    return NextResponse.json({
      message: "Feature unlocked successfully",
      feature: updatedFeature[0],
    });
  } catch (error) {
    console.error("Failed to unlock feature:", error);
    return NextResponse.json(
      { error: "Failed to unlock feature" },
      { status: 500 }
    );
  }
}

