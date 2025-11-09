import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth";
import { db } from "@/server/db";
import { books, bookFeatures } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/books/[id]/features
 * Get all feature statuses for a book
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

    // Get all features for this book
    const features = await db
      .select()
      .from(bookFeatures)
      .where(eq(bookFeatures.bookId, id));

    return NextResponse.json(features);
  } catch (error) {
    console.error("Failed to get features:", error);
    return NextResponse.json(
      { error: "Failed to get features" },
      { status: 500 }
    );
  }
}

