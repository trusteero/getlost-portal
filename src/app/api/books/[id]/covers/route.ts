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

    // Get book covers
    const covers = await db
      .select()
      .from(bookCovers)
      .where(eq(bookCovers.bookId, id));

    return NextResponse.json(covers);
  } catch (error) {
    console.error("Failed to get book covers:", error);
    return NextResponse.json(
      { error: "Failed to get book covers" },
      { status: 500 }
    );
  }
}

