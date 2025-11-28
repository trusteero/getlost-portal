import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, marketingAssets, bookFeatures } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/books/[id]/marketing-assets
 * Get marketing assets for a book
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  const { id } = await params;

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

    // Check if feature is unlocked
    const feature = await db
      .select()
      .from(bookFeatures)
      .where(
        and(
          eq(bookFeatures.bookId, id),
          eq(bookFeatures.featureType, "marketing-assets")
        )
      )
      .limit(1);

    if (feature.length === 0 || feature[0]!.status === "locked") {
      return NextResponse.json(
        { error: "Feature not unlocked" },
        { status: 403 }
      );
    }

    // Get marketing assets - prefer active one (from database column), otherwise get HTML one, otherwise any
    const allAssets = await db
      .select()
      .from(marketingAssets)
      .where(eq(marketingAssets.bookId, id));

    // Find active asset using database column (not metadata)
    let activeAsset = allAssets.find(asset => asset.isActive === true);

    // If no active asset, find HTML asset
    if (!activeAsset) {
      activeAsset = allAssets.find(asset => {
        if (!asset.metadata) return false;
        try {
          const metadata = JSON.parse(asset.metadata);
          return metadata.variant === "html";
        } catch {
          return false;
        }
      });
    }

    // If still no active asset, use first asset
    if (!activeAsset && allAssets.length > 0) {
      activeAsset = allAssets[0];
    }

    // Update viewedAt timestamp when user views the marketing asset
    if (activeAsset) {
      console.log(`[Marketing Assets] Updating viewedAt for asset ${activeAsset.id}`);
      await db
        .update(marketingAssets)
        .set({ viewedAt: new Date() })
        .where(eq(marketingAssets.id, activeAsset.id));
      console.log(`[Marketing Assets] Updated viewedAt for asset ${activeAsset.id}`);
    } else {
      console.log(`[Marketing Assets] No active asset found for book ${id}`);
    }

    // Return active asset or first asset, or empty array
    return NextResponse.json(activeAsset ? [activeAsset] : []);
  } catch (error) {
    console.error("Failed to get marketing assets:", error);
    return NextResponse.json(
      { error: "Failed to get marketing assets" },
      { status: 500 }
    );
  }
}

