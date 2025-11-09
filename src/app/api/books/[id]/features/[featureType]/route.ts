import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookFeatures, purchases } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { populateDemoDataForBook } from "@/server/utils/populate-demo-data";

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

    // For now, we'll unlock features without payment processing
    // In production, you would integrate with Stripe/PayPal here
    // TODO: Add payment processing integration

    // Create purchase record
    const purchaseId = crypto.randomUUID();
    await db.insert(purchases).values({
      id: purchaseId,
      userId: session.user.id,
      bookId: id,
      featureType,
      amount: price,
      currency: "USD",
      status: price === 0 ? "completed" : "completed", // For now, auto-complete
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
          status: "unlocked",
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
        status: "unlocked",
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

    // Populate demo data for the unlocked feature
    try {
      await populateDemoDataForBook(id, featureType);
      console.log(`[Purchase] Populated demo data for ${featureType} on book ${id}`);
    } catch (error) {
      console.error(`[Purchase] Failed to populate demo data:`, error);
      // Don't fail the purchase if demo data population fails
    }

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

