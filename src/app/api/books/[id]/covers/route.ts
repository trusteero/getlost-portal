import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookCovers, bookFeatures } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/books/[id]/covers
 * Get book covers for a book
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
          eq(bookFeatures.featureType, "book-covers")
        )
      )
      .limit(1);

    if (feature.length === 0 || feature[0]!.status === "locked") {
      return NextResponse.json(
        { error: "Feature not unlocked" },
        { status: 403 }
      );
    }

    // Get book covers - prefer primary one, otherwise get HTML one, otherwise any
    const allCovers = await db
      .select()
      .from(bookCovers)
      .where(eq(bookCovers.bookId, id));

    // Find primary cover
    let primaryCover = allCovers.find(cover => cover.isPrimary);

    // If no primary cover, find HTML cover
    if (!primaryCover) {
      primaryCover = allCovers.find(cover => {
        if (!cover.metadata) return false;
        try {
          const metadata = JSON.parse(cover.metadata);
          return metadata.variant === "html";
        } catch {
          return false;
        }
      });
    }

    // If still no primary cover, use first cover
    if (!primaryCover && allCovers.length > 0) {
      primaryCover = allCovers[0];
    }

    // Update viewedAt timestamp when user views the cover
    if (primaryCover) {
      await db
        .update(bookCovers)
        .set({ viewedAt: new Date() })
        .where(eq(bookCovers.id, primaryCover.id));
    }

    // Return primary cover or first cover, or all covers if none marked
    return NextResponse.json(primaryCover ? [primaryCover] : allCovers);
  } catch (error) {
    console.error("Failed to get book covers:", error);
    return NextResponse.json(
      { error: "Failed to get book covers" },
      { status: 500 }
    );
  }
}

